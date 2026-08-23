import logging

from sqlmodel import Session, select

from app.crud import upsert_business_summary
from app.models import BusinessSummary, FilingSectionTypes, Stock
from app.services.filings_data import get_annual_report
from app.services.llm.summarize import summarize_business_info

logger = logging.getLogger(__name__)


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
