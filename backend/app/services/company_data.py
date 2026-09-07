import yfinance as yf
from yfinance.scrapers.quote import FastInfo

from app.services.edgar_client import get_company
from app.services.stock_data import stock_logo_url
from app.models import Stock
from app.schemas import CompanyInfo

def get_company_info(stock: Stock):
    """Returns general information about a stock"""
    company = get_company(stock.ticker)
    ticker = yf.Ticker(stock.ticker)
    fast_info: FastInfo = ticker.fast_info

    change = fast_info.last_price - fast_info.previous_close

    # Empty for tickers with no analyst coverage (small caps, some foreign listings).
    # price_targets = ticker.analyst_price_targets or {}

    return CompanyInfo(
        ticker    = stock.ticker,
        name      = stock.name,
        industry  = company.industry,
        exchanges = company.get_exchanges(),
        img       = stock_logo_url(stock.ticker),
        suggested_questions = _build_suggested_questions(),
        day_low        = fast_info.day_low,
        day_high       = fast_info.day_high,
        year_low       = fast_info.year_low,
        year_high      = fast_info.year_high,
        market_cap     = fast_info.market_cap,
        shares         = fast_info.shares,
        price          = fast_info.last_price,
        change         = change,
        change_percent = change / fast_info.previous_close * 100,
        analyst_target_low  = None,#price_targets.get("low"),
        analyst_target_high = None,#price_targets.get("high"),
        analyst_target_mean = None,#price_targets.get("mean"),
    )

def get_stock_name(ticker: str) -> str | None:
    """Returns the company name of a ticker, preferring EDGAR over Yahoo.

    This sits inside the StockDep dependency, so for a ticker not yet in the
    database it runs on *every* stock endpoint — and a single page load fires
    five of them in parallel. Reading the name from yfinance's `.info` meant
    five concurrent quoteSummary fetches (the heaviest call it offers, each
    preceded by a cookie/crumb handshake) to extract one field, which is what
    got the app rate limited by Yahoo.

    That failure was self-perpetuating: the name lookup raised, the stock was
    never created, so the next request tried again from scratch and the ticker
    could never come good.

    EDGAR is the better source here on every count — edgartools throttles and
    caches its own requests, the SEC allows a far higher rate to a declared
    identity (set in main.py), and it is where the filings and financials come
    from anyway, so a ticker it cannot resolve is one the app can barely use.
    Yahoo stays as the fallback for listings EDGAR does not cover.
    """
    company = get_company(ticker)
    if company is not None and company.name:
        return company.name

    return yf.Ticker(ticker).info.get("shortName", None)


def _build_suggested_questions() -> list[str]:
    return [
        "What does the company do and how does it make money?",
        "Give me key highlights of latest report?",
        "Should i buy this stock?"
    ]