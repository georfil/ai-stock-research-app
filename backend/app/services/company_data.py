# Finnhub-backed company data for the stock overview endpoint.
#
# One overview draws on three Finnhub endpoints:
# - /quote            price, previous close, day high/low
# - /stock/profile2   industry, exchange, market cap, shares outstanding
# - /stock/metric     52-week high/low, beta
#
# The free tier allows 60 calls a minute, so an uncached overview costs three
# of that budget.

import logging
from functools import lru_cache

import requests

from app.core.config import get_config
from app.models import Stock
from app.schemas import CompanyInfo
from app.services.stock_data import stock_logo_url

logger = logging.getLogger(__name__)

_BASE_URL = "https://finnhub.io/api/v1"
_TIMEOUT = 10

# Finnhub reports market cap and shares outstanding in millions, not units.
_MILLIONS = 1_000_000


# =============================================================================
# Finnhub HTTP
# =============================================================================

@lru_cache
def _session() -> requests.Session:
    """Return the shared Finnhub session, built on first use.

    Returns:
        A session carrying the API token on every request.

    Raises:
        RuntimeError: If no Finnhub API key is configured.
    """
    key = get_config().finnhub_api_key
    if key is None:
        raise RuntimeError("finnhub_api_key is not set — cannot reach Finnhub")

    session = requests.Session()
    # The token travels in a header so it stays out of request logs.
    session.headers["X-Finnhub-Token"] = key.get_secret_value()
    return session


def _get(path: str, **params) -> dict:
    """Return the JSON body of a Finnhub GET.

    Args:
        path: Endpoint path below the API root, e.g. ``/quote``.
        **params: Query parameters for the request.

    Returns:
        The decoded JSON body.

    Raises:
        requests.HTTPError: If Finnhub answers with a non-2xx status.
    """
    response = _session().get(f"{_BASE_URL}{path}", params=params, timeout=_TIMEOUT)
    response.raise_for_status()
    return response.json()


# =============================================================================
# Company overview
# =============================================================================

def get_company_info(stock: Stock) -> CompanyInfo:
    """Return the overview shown at the top of a stock's page.

    Combines the live quote with the company's profile fields and its 52-week
    metrics.

    Args:
        stock: The stock to describe.

    Returns:
        The stock's quote, profile and metric fields as one record.

    Raises:
        ValueError: If Finnhub holds no quote for the ticker.
    """
    quote = _get("/quote", symbol=stock.ticker)
    profile = _get("/stock/profile2", symbol=stock.ticker)
    metric = _get("/stock/metric", symbol=stock.ticker, metric="all").get("metric") or {}

    price = quote.get("c")
    previous_close = quote.get("pc")
    # An uncovered symbol comes back as a 200 with a payload of zeros, so a
    # falsy price is the only signal that the ticker is unknown.
    if not price or not previous_close:
        raise ValueError(f"Finnhub returned no quote for {stock.ticker}")

    change = price - previous_close
    market_cap = profile.get("marketCapitalization")
    shares = profile.get("shareOutstanding")

    return CompanyInfo(
        ticker    = stock.ticker,
        name      = stock.name,
        industry  = profile.get("finnhubIndustry"),
        exchange  = profile.get("exchange"),
        img       = stock_logo_url(stock.ticker),
        suggested_questions = _build_suggested_questions(),
        # Both come back as zero outside trading hours on some listings, where
        # the current price stands in.
        day_low        = quote.get("l") or price,
        day_high       = quote.get("h") or price,
        year_low       = metric.get("52WeekLow"),
        year_high      = metric.get("52WeekHigh"),
        market_cap     = (market_cap or 0) * _MILLIONS,
        shares         = int((shares or 0) * _MILLIONS),
        price          = price,
        change         = change,
        change_percent = change / previous_close * 100,
        beta           = metric.get("beta"),
    )


def _build_suggested_questions() -> list[str]:
    """Return the starter questions offered by the page's assistant."""
    return [
        "What does the company do and how does it make money?",
        "Give me key highlights of latest report?",
        "Should i buy this stock?"
    ]


# =============================================================================
# Name lookup
# =============================================================================

def get_stock_name(ticker: str) -> str | None:
    """Return the company name for a ticker.

    Args:
        ticker: Stock ticker symbol, e.g. "AAPL".

    Returns:
        The company name, or ``None`` if Finnhub holds no profile for the
        ticker or the lookup fails.
    """
    # Runs inside StockDep for any ticker not yet in the database, so it fires
    # on every stock endpoint.
    try:
        return _get("/stock/profile2", symbol=ticker).get("name") or None
    except (requests.RequestException, RuntimeError):
        logger.warning("Finnhub name lookup failed for %s", ticker, exc_info=True)
        return None
