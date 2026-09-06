# Fetches and caches SEC filing content — 10-K prose sections, an AI business
# summary, the latest 10-Q's MD&A, and recent 8-K event metadata — for the
# filing analyst worker.
#
# Different caching strategies live here side by side, deliberately:
#
# - Annual (10-K): get_annual_report persists the tracked sections
#   (business, MD&A, risk factors) as FilingSection rows, keyed by the
#   filing's accession number. A new 10-K invalidates the cache; a fetch
#   failure falls back to serving the stale cache rather than nothing.
#   get_business_summary builds on top of it, caching an LLM-generated
#   summary of the business section the same way.
# - Quarterly (10-Q) and current events (8-K): get_quarterly_mda and
#   list_recent_8k_filings are both fetched live on every call and never
#   persisted — small/cheap enough that caching isn't worth the invalidation
#   logic, and there's no stale fallback (a failed fetch just means that
#   call returns nothing extra).
#
# Two LangChain tools are exposed to the filing analyst worker:
# - fetch_filing_section serves the annual sections from the cache, and —
#   only for section=mda — also pulls in the live quarterly MD&A, clearly
#   labeled and extracted separately from the annual passages (never
#   concatenated before extraction, so the extractor never has to split
#   attention across two documents in one pass).
# - list_8k_filings returns cheap 8-K metadata (date, event classification,
#   items) so the worker can decide which specific filing is actually
#   relevant before fetching anything expensive.

import logging
from typing import Sequence

from datetime import date, timedelta

from langchain_core.tools import tool
from sqlmodel import Session, select

from app.services.edgar_client import get_company, get_latest_annual_filing, get_latest_quarterly_filing
from app.services.llm.summarize import retrieve_relevant_context, summarize_business_info
from app.crud import get_or_create_stock, upsert_business_summary, upsert_filing_sections
from app.models import BusinessSummary, FilingSection, FilingSectionTypes, Stock
from app.core.database import session_scope

logger = logging.getLogger(__name__)


# =============================================================================
# Annual report (10-K) — cached
# =============================================================================

def get_annual_report(stock: Stock, session: Session) -> Sequence[FilingSection] | None:
    """Return the stock's latest 10-K sections, using the cache.

    Serves cached sections when they originate from the company's latest annual
    filing. Otherwise re-fetches and persists them. Falls back to stale cache on
    fetch failure, and to ``None`` when nothing is available.
    """
    # Look up any cached sections for this stock.
    existing = session.exec(
        select(FilingSection).where(FilingSection.stock_id == stock.id)
    ).all()

    # Resolve the company on EDGAR; bail if the ticker is unknown.
    company = get_company(stock.ticker)
    if not company:
        return None

    # Latest annual filing drives cache invalidation.
    latest_annual_filing = get_latest_annual_filing(company)

    # No filing available: serve stale sections if we have them, else nothing.
    if not latest_annual_filing:
        return existing if existing else None

    # Cache hit: cached sections came from the current latest filing.
    if existing and existing[0].accession_number == latest_annual_filing.accession_number:
        return existing

    logger.info("Refreshing 10-K sections for %s (existing=%s)", stock.ticker, bool(existing))

    # Cache miss: ingest the latest filing.
    fetched_sections = _ingest_annual_report(stock, latest_annual_filing, session)
    if not fetched_sections:
        if existing:
            logger.warning("Ingestion failed for %s, serving stale sections", stock.ticker)
            return existing
        logger.warning("Ingestion failed for %s and no cached sections exist — returning None", stock.ticker)
        return None

    return fetched_sections


def _ingest_annual_report(stock: Stock, filing, session: Session) -> list[FilingSection] | None:
    """Fetch, parse, and persist the tracked sections from an annual filing.

    Returns ``None`` on fetch failure or if the parsed sections are empty,
    leaving any existing cache untouched.
    """
    fetched_sections = _fetch_annual_report(stock, filing)
    if not fetched_sections:
        return None

    if _are_section_empty(fetched_sections):
        return None

    upsert_filing_sections(session, fetched_sections, stock.id)
    logger.info("Persisted fresh 10-K sections for %s", stock.ticker)

    return fetched_sections


def _fetch_annual_report(stock: Stock, filing) -> list[FilingSection] | None:
    """Fetch and parse the tracked prose sections from an annual filing."""
    try:
        tenk = filing.obj()

        section_accessors = {
            FilingSectionTypes.BUSINESS: tenk.business,
            FilingSectionTypes.MDA:      tenk.management_discussion,
            FilingSectionTypes.RISKS:    tenk.risk_factors,
        }

        sections = [
            FilingSection(
                stock_id=stock.id,
                section=section_type,
                accession_number=filing.accession_number,
                content=text,
            )
            for section_type, text in section_accessors.items()
        ]
    except Exception:
        logger.exception("Unexpected error fetching/parsing 10-K sections for %s", stock.ticker)
        return None

    return sections

def _are_section_empty(sections: list[FilingSection]) -> bool:
    """True if every fetched section came back blank (a parse failure, not a real empty filing)."""
    return all(len(section.content.strip()) == 0  for section in sections)


# =============================================================================
# Business summary — cached, built on the annual report above
# =============================================================================

def get_business_summary(stock: Stock, session: Session) -> str | None:
    """Return an AI-generated summary of the stock's business, using the cache.

    Serves the cached summary when it originates from the company's latest
    annual filing. Otherwise generates and persists a new one. Returns
    ``None`` if no business section is available to summarize.
    """
    # Business section drives both the summary content and its cache key.
    annual_report = get_annual_report(stock, session) or []
    business_section = next(
        (s for s in annual_report if s.section == FilingSectionTypes.BUSINESS), None
    )
    if not business_section or not business_section.content:
        logger.warning("No business section available for %s — cannot summarize", stock.ticker)
        return None

    # Look up any cached summary for this stock.
    existing = session.exec(
        select(BusinessSummary).where(BusinessSummary.stock_id == stock.id)
    ).first()

    # Cache hit: cached summary came from the current latest filing.
    if existing and existing.accession_number == business_section.accession_number:
        return existing.content

    # Cache miss: ask the LLM to summarize the latest business section.
    logger.info("Generating business summary for %s", stock.ticker)

    content = summarize_business_info(business_section.content)

    upsert_business_summary(
        session,
        BusinessSummary(
            stock_id=stock.id,
            accession_number=business_section.accession_number,
            content=content,
        ),
    )
    logger.info("Persisted fresh business summary for %s", stock.ticker)

    return content


# =============================================================================
# Quarterly MD&A (10-Q) — live, never cached
# =============================================================================

def get_quarterly_mda(stock: Stock) -> str | None:
    """Return the latest 10-Q's Item 2 (MD&A) text, fetched live on every call.

    Unlike the annual report path, this is never cached or persisted — a
    10-Q is small enough to fetch on demand, and there's no stale-fallback:
    a failed fetch just returns ``None`` for this call, since it's
    supplementary context rather than something every answer depends on.
    """
    company = get_company(stock.ticker)
    if not company:
        return None

    latest_quarterly_filing = get_latest_quarterly_filing(company)
    if not latest_quarterly_filing:
        return None

    try:
        tenq = latest_quarterly_filing.obj()
        mda = tenq['Part I, Item 2']
    except Exception:
        logger.exception("Unexpected error fetching/parsing 10-Q MD&A for %s", stock.ticker)
        return None

    if not mda or not mda.strip():
        return None

    return mda

# =============================================================================
# Events (8-K) — live, never cached
# =============================================================================

def list_recent_8k_filings(ticker: str, lookback_days: int = 90, max_filings: int = 15) -> list[dict]:
    """Cheap metadata for recent 8-Ks — no full text/exhibit rendering, just date + classification."""
    company = get_company(ticker)
    if not company:
        return []

    clamped_lookback_days = max(7, min(365, lookback_days)) #force lookbackdays to be between 7 days and one year
    cutoff = date.today() - timedelta(days=clamped_lookback_days)

    filings = company.get_filings(
        form=["8-K"],
        amendments=False,
        filing_date=(cutoff.isoformat(), date.today().isoformat()),
    )

    # Materialize and sort explicitly rather than trusting iteration order.
    all_filings = sorted(filings, key=lambda f: f.filing_date, reverse=True)

    results = []
    for filing in all_filings[:max_filings]:
        eight_k = filing.obj()
        results.append({
            "accession_number": filing.accession_number,
            "date": str(eight_k.date_of_report or filing.filing_date),
            "content_type": eight_k.content_type,
            "items": eight_k.items,
        })

    return results


def get_8k_filing_text(ticker: str, accession_number: str) -> str | None:
    """Return the full text (primary document + exhibits) of one specific
    8-K, identified by the accession number a prior list_8k_filings call
    returned.
    """
    company = get_company(ticker)
    if not company:
        return None

    filing = company.get_filings(form=["8-K"], accession_number=accession_number).latest()
    if not filing:
        return None

    try:
        eight_k = filing.obj()
        text = eight_k.text()
    except Exception:
        logger.exception("Unexpected error fetching/parsing 8-K %s for %s", accession_number, ticker)
        return None

    if not text or not text.strip():
        return None

    return text


# =============================================================================
# Tools exposed to the filing analyst worker
# =============================================================================

@tool
def list_8k_filings(ticker: str, lookback_days: int = 90) -> str:
    """List the company's recent 8-K filings — metadata only (date, event
    type, items reported), not the filing's content. Use this first to see
    what's been disclosed recently, then decide which specific filing (by
    its accession number) is actually relevant before fetching its content.

    Args:
        ticker: Stock ticker symbol
        lookback_days: How far back to look, in days. Widen this when the
                subtask implies a longer horizon (e.g. "since last year" ->
                365, "in the past week" -> 7); the default (90) covers
                "recent" events. Clamped between 7 and 365.
    """
    filings = list_recent_8k_filings(ticker, lookback_days=lookback_days)
    if not filings:
        logger.warning("No 8-K filings found: ticker=%s lookback_days=%d", ticker, lookback_days)
        return f"No 8-K filings found for {ticker} in the last {lookback_days} days."

    logger.info("Found %d 8-K filing(s): ticker=%s", len(filings), ticker)

    return "\n".join(
        f"{f['date']} — {f['content_type']} — items: {', '.join(f['items']) or 'none'} "
        f"— accession_number: {f['accession_number']}"
        for f in filings
    )


@tool
def fetch_8k_filing(ticker: str, accession_number: str, task: str) -> str:
    """Return relevant passages from one specific 8-K, identified by the
    accession_number a prior list_8k_filings call returned. Fetches the
    full filing (primary document plus exhibits, e.g. press releases) and
    extracts only what bears on `task` — don't fetch a filing you haven't
    first seen (and judged relevant) via list_8k_filings.

    Args:
        ticker: Stock ticker symbol
        accession_number: Identifies the specific 8-K, from list_8k_filings.
        task: What to look for, phrased as the specific question or theme
                the passages should address, e.g. "reason given for the CFO's
                departure" or "guidance provided for next quarter". Drives
                which passages are returned; be specific, not a single
                keyword.
    """
    text = get_8k_filing_text(ticker, accession_number)
    if not text:
        logger.warning("8-K not available: ticker=%s accession_number=%s", ticker, accession_number)
        return f"8-K {accession_number} not available for {ticker}."

    logger.info("8-K fetched: ticker=%s accession_number=%s content_len=%d", ticker, accession_number, len(text))

    relevant_context = retrieve_relevant_context(text, task)

    logger.info("Extractor returned: ticker=%s accession_number=%s output_len=%d", ticker, accession_number, len(relevant_context))
    logger.debug("Extractor output: %s", relevant_context[:300])

    return relevant_context


@tool
def fetch_filing_section(ticker: str, section: FilingSectionTypes, task: str) -> str:
    """Return the full text of one section of a company's latest annual report.

    For `mda`, this also includes the latest 10-Q's Item 2 MD&A — more
    current than the annual filing's — clearly labeled and separate from the
    annual passages.

    Args:
        ticker: Stock ticker symbol
        section: Which section of the 10-K to retrieve.
        task: What to look for in this section, phrased as the specific
                question or theme the passages should address, e.g.
                "customer concentration and dependence on key contracts"
                or "sources of margin pressure". Drives which passages are
                returned; be specific, not a single keyword.
    """
    with session_scope() as session:
        stock = get_or_create_stock(session, ticker)
        sections = get_annual_report(stock, session)
        if not sections:
            logger.warning("No annual report available: ticker=%s", ticker)
            return f"No annual report available for {ticker}."

        match = next((s for s in sections if s.section == section), None)
        if not match:
            logger.warning("Section not available: ticker=%s section=%s", ticker, section)
            return f"Section {section} not available for {ticker}."

        logger.info("Section matched: ticker=%s section=%s content_len=%d", ticker, section, len(match.content))

        relevant_context = retrieve_relevant_context(match.content, task)

        logger.info("Extractor returned: ticker=%s section=%s output_len=%d", ticker, section, len(relevant_context))
        logger.debug("Extractor output: %s", relevant_context[:300])

        if section != FilingSectionTypes.MDA:
            return relevant_context

        # MD&A additionally pulls in the latest 10-Q — extracted on its own
        # (never concatenated with the annual text first) so the extractor
        # never has to split attention across two documents in one pass.
        quarterly_mda = get_quarterly_mda(stock)
        if not quarterly_mda:
            return relevant_context

        quarterly_context = retrieve_relevant_context(quarterly_mda, task)
        logger.info("Quarterly MD&A extractor returned: ticker=%s output_len=%d", ticker, len(quarterly_context))

        return (
            f"## From the latest annual report (10-K)\n{relevant_context}\n\n"
            f"## From the latest quarterly report (10-Q, more recent)\n{quarterly_context}"
        )
