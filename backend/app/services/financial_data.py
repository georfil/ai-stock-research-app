
import re
import logging
 
import pandas as pd
from sqlmodel import Session, select
from edgar.entity import EntityFiling
from langchain_core.tools import tool

from app.services.edgar_client import get_company, get_latest_annual_filing
from app.models import FinancialLine, Financials, Stock, FinancialStatement
from app.crud import upsert_financial_statement
from app.core.database import get_session
 
logger = logging.getLogger(__name__)
 
 
def get_financial_statement(
    stock: Stock,
    statement: FinancialStatement,
    session: Session,
) -> list[FinancialLine] | None:
    """Return the requested financial statement for a stock, using the cache.

    Serves the cached statement when it originates from the company's latest
    annual filing. Otherwise re-fetches the requested statement from EDGAR,
    persists it, and returns it. Falls back to stale cached data if a fetch
    fails, and to ``None`` when no data is available at all.
 
    Args:
        stock: The stock whose statement is requested.
        statement: Which statement to return (income, balance sheet, cash flow).
        session: Active database session.
 
    Returns:
        The statement's financial lines, or ``None`` if unavailable.
    """
    # Look up any cached copy of the requested statement.
    existing = session.exec(
        select(Financials).where(
            Financials.stock_id == stock.id,
            Financials.financial_statement == statement,
        )
    ).first()
 
    # Resolve the company on EDGAR; bail out if the ticker is unknown.
    company = get_company(stock.ticker)
    if not company:
        return None
 
    # Determine the latest annual filing, which drives cache invalidation.
    latest_annual_filing = get_latest_annual_filing(company)
 
    # No annual filing available: serve stale data if we have it, else nothing.
    if not latest_annual_filing:
        return existing.lines if existing else None
 
    # Cache hit: cached statement came from the current latest filing.
    if existing and existing.accession_number == latest_annual_filing.accession_number:
        return existing.lines
 
    logger.info(
        "Refreshing %s for %s (existing=%s)",
        statement, stock.ticker, bool(existing),
    )
 
    # Cache miss: fetch and parse all statements from the latest filing.
    fetched_financial_statement = _fetch_financial_statement(stock, latest_annual_filing, statement)
    if not fetched_financial_statement:
        if existing:
            logger.warning(
                "Fetch failed for %s, serving stale data from %s",
                stock.ticker, existing.created_at,
            )
            return existing.lines
        logger.warning(
            "Fetch failed for %s and no cached data exists — returning None",
            stock.ticker,
        )
        return None
 
    # Persist the freshly fetched statement.
    upsert_financial_statement(session, fetched_financial_statement)
    logger.info("Persisted fresh financials for %s", stock.ticker)
 
    # Return the fetched financial statement
    return fetched_financial_statement.lines
 
 
def _fetch_financial_statement(
    stock: Stock,
    filing: EntityFiling,
    statement: FinancialStatement
) -> Financials | None:
    """Fetch and parse a single financial statement from an annual filing.

    Args:
        stock: The stock the statement belongs to.
        filing: The annual filing to parse.
        statement: Which statement to fetch (income, balance sheet, cash flow).

    Returns:
        A ``Financials`` record with its lines, or ``None`` if parsing fails.
    """
    try:
        fin = filing.obj()

        #Mapping statement to attribute of fin object
        STATEMENTS = {
            FinancialStatement.INCOME_STATEMENT: "income_statement",
            FinancialStatement.BALANCE_SHEET:    "balance_sheet",
            FinancialStatement.CASH_FLOW:        "cash_flow_statement",
        }

        df = getattr(fin, STATEMENTS.get(statement) ).to_dataframe(include_unit=True)
 
        return Financials(
            stock_id=stock.id,
            financial_statement=statement,
            accession_number=filing.accession_number,
            lines=_format_financial_statement(df),
        )
        
    except Exception:
        logger.exception("Unexpected error fetching/parsing financials for %s", stock.ticker)
        return None
 
 
 
def _format_financial_statement(df: pd.DataFrame) -> list[FinancialLine]:
    """Normalize a raw statement dataframe into a flat list of financial lines.
 
    Drops abstract/dimensional noise rows, keeps the relevant columns, and melts
    the per-period columns into one row per (label, period) pair.
 
    Args:
        df: Raw statement dataframe from edgartools (``include_unit=True``).
 
    Returns:
        One ``FinancialLine`` per (label, period) value.
    """
    # Period columns are date-headed (e.g. "2024-12-31").
    pattern = re.compile(r"^(\d{4})-\d{2}-\d{2}")
    period_cols = [col for col in df.columns if re.match(pattern, col)]
 
    # Drop abstract and dimensional rows, keep only the columns we care about,
    # and collapse duplicate labels.
    df_cleaned = df[(~df["abstract"]) & (~df["dimension"])]
    cols_to_select = ["label", "standard_concept", "unit"] + period_cols
    df_cleaned = df_cleaned[cols_to_select]
    df_cleaned = df_cleaned.drop_duplicates(subset=["label"], keep="first")
 
    logger.debug(
        "Statement has %d rows before cleaning, %d after",
        len(df), len(df_cleaned),
    )
 
    # Melt the wide per-period columns into (period, value) rows.
    df_final = df_cleaned.melt(
        id_vars=[col for col in cols_to_select if col not in period_cols],
        value_vars=period_cols,
        var_name="period",
        value_name="value",
    )
 
    financial_lines = [
        FinancialLine(
            label          = row["label"],
            period         = row["period"],
            standard_label = _clean_str(row["standard_concept"]),
            unit           = _clean_str(row["unit"]),
            value          = _clean_value(row["value"]),
        )
        for _, row in df_final.iterrows()
    ]
 
    logger.debug("Produced %d financial lines", len(financial_lines))
 
    return financial_lines
 
 
def _clean_str(value: str | None) -> str | None:
    """Return ``None`` for pandas NA, otherwise the string unchanged."""
    return None if pd.isna(value) else value
 
 
def _clean_value(value: float | None) -> float | None:
    """Return ``None`` for pandas NA, otherwise the value as a float."""
    return None if pd.isna(value) else float(value)


@tool
def fetch_financial_statement(ticker: str, statement: FinancialStatement) -> str:
    """Fetch a company's financial statement (income, balance sheet, or cash flow).

    Args:
        ticker: Stock ticker symbol, e.g. "AAPL".
        statement: Which statement to fetch.

    Returns:
        The statement's line items, or a message if unavailable.
    """
    with get_session() as session:
        stock = session.exec(
            select(Stock).where(Stock.ticker == ticker.upper())
        ).first()
        if not stock:
            return f"No stock found for ticker {ticker!r}."

        lines = get_financial_statement(stock, statement, session)
        if not lines:
            return f"No {statement.value} available for {ticker}."

        return _format_lines_for_llm(lines)


def _format_lines_for_llm(lines: list[FinancialLine]) -> str:
    """Render financial lines as a pivoted Markdown table (labels × periods)."""
    # Collect periods (newest first) and unit per label.
    periods = list(dict.fromkeys(line.period for line in lines))
    units = {line.label: line.unit for line in lines}

    # Index values by (label, period) for lookup.
    values = {(line.label, line.period): line.value for line in lines}

    # Preserve first-seen label order.
    labels = list(dict.fromkeys(line.label for line in lines))

    header = "| Line item | Unit | " + " | ".join(periods) + " |"
    sep = "|" + "---|" * (len(periods) + 2)

    rows = []
    for label in labels:
        cells = [_fmt(values.get((label, p))) for p in periods]
        rows.append(f"| {label} | {units.get(label) or ''} | " + " | ".join(cells) + " |")

    return "\n".join([header, sep, *rows])


def _fmt(value: float | None) -> str:
    """Format a numeric value, blank for missing."""
    return "" if value is None else f"{value:,.0f}"