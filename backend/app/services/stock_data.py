import yfinance as yf

from app.schemas import PriceBar, PriceRange, StockSearchResult
from app.core.config import get_config

#Change depending on API procider for stock price data
_RANGE_TO_PERIOD: dict[PriceRange, str] = {
    PriceRange.ONE_MONTH: "1mo",
    PriceRange.SIX_MONTHS: "6mo",
    PriceRange.ONE_YEAR: "1y",
    PriceRange.FIVE_YEARS: "5y",
    PriceRange.MAX: "max",
}

def get_logo_url(ticker: str) -> str:
    """Direct LogoKit hotlink URL. The token is a publishable key (LogoKit
    blocks server-side/programmatic requests to it), so it's meant to be
    embedded client-side rather than proxied."""
    token = get_config().stock_logo_api_key.get_secret_value()
    return f"https://img.logokit.com/ticker/{ticker}?token={token}"

def search_stocks(query: str, max_results = 20):
    """Search for equities matching the query, returning ticker/name results."""
    results = yf.Search(query, max_results=max_results).quotes
    return [StockSearchResult(
        ticker  = item["symbol"],
        name    = item.get("shortname", None),
        img     = get_logo_url(item["symbol"]),
    )

     for item in results if item.get("quoteType") == "EQUITY"]

def get_stock_name(ticker: str):
    """Returns the company name of a ticker"""
    return yf.Ticker(ticker).info.get("shortName", None)


def get_price_history(ticker: str, range: PriceRange) -> list[PriceBar]:
    """Returns daily price bars for a ticker over the given range."""
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

