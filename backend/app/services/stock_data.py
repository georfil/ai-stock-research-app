# Ticker search and daily price history from yfinance, plus the Logokit URL
# for a company's logo image.

import yfinance as yf

from app.schemas import PriceBar, PriceRange, StockSearchResult
from app.core.config import get_config


# =============================================================================
# Company logo
# =============================================================================

def stock_logo_url(ticker: str) -> str:
    """Return the URL of a company's logo image.

    Args:
        ticker: Stock ticker symbol, e.g. "AAPL".

    Returns:
        A Logokit image URL carrying the API token.
    """
    token = get_config().stock_logo_api_key.get_secret_value()
    return f"https://img.logokit.com/ticker/{ticker}?token={token}"


# =============================================================================
# Ticker search
# =============================================================================

def search_stocks(query: str, max_results: int = 20) -> list[StockSearchResult]:
    """Search for equities matching a query.

    Args:
        query: Free-text search term, matched against ticker and company name.
        max_results: Upper bound on the results requested from Yahoo.

    Returns:
        One result per matching equity. Non-equity quote types (ETFs, indices,
        currencies) are dropped, so this can be shorter than ``max_results``.
    """
    results = yf.Search(query, max_results=max_results).quotes
    return [
        StockSearchResult(
            ticker = item["symbol"],
            name   = item.get("shortname", None),
        )
        for item in results
        if item.get("quoteType") == "EQUITY"
    ]


# =============================================================================
# Price history
# =============================================================================

# Maps the API's range values to yfinance period strings.
_RANGE_TO_PERIOD: dict[PriceRange, str] = {
    PriceRange.ONE_MONTH: "1mo",
    PriceRange.SIX_MONTHS: "6mo",
    PriceRange.ONE_YEAR: "1y",
    PriceRange.FIVE_YEARS: "5y",
    PriceRange.MAX: "max",
}


def get_price_history(ticker: str, range: PriceRange) -> list[PriceBar]:
    """Return daily price bars for a ticker over the given range.

    Args:
        ticker: Stock ticker symbol, e.g. "AAPL".
        range: How far back to reach.

    Returns:
        One bar per trading day, oldest first. Empty if Yahoo holds no history
        for the ticker.
    """
    period = _RANGE_TO_PERIOD[range]
    df = yf.Ticker(ticker).history(period=period)
    return [
        PriceBar(
            date=idx.date(),
            open=row.Open, high=row.High,
            low=row.Low, close=row.Close,
            volume=int(row.Volume),
        )
        for idx, row in df.iterrows()
    ]
