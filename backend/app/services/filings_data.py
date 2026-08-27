import logging
from typing import Sequence

from langchain_core.tools import tool
from sqlmodel import Session, select

from app.services.edgar_client import get_company, get_latest_annual_filing
from app.services.llm.summarize import retrieve_relevant_context, summarize_business_info
from app.crud import get_or_create_stock, upsert_business_summary, upsert_filing_sections
from app.models import BusinessSummary, FilingSection, FilingSectionTypes, Stock
from app.core.database import session_scope

logger = logging.getLogger(__name__)


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
    return all(len(section.content.strip()) == 0  for section in sections)


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


@tool
def fetch_filing_section(ticker: str, section: FilingSectionTypes, task: str) -> str:
    """Return the full text of one section of a company's latest annual report.

    Args:
        ticker: Stock ticker symbol
        section: Which section of the 10-K to retrieve.
        task: What to look for in this section, phrased as the specific
                question or theme the passages should address, e.g.
                "customer concentration and dependence on key contracts"
                or "sources of margin pressure". Drives which passages are
                returned; be specific, not a single keyword.
    """
    logger.info("fetch_filing_section called: ticker=%s section=%s task=%r", ticker, section, task)

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

        return relevant_context