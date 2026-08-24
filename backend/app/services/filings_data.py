import logging
from typing import Sequence

from sqlmodel import Session, select

from app.services.edgar_client import get_company, get_latest_annual_filing
from app.crud import upsert_filing_sections
from app.models import FilingSection, FilingSectionTypes, Stock

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
