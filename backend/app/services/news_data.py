# Recent news articles for a ticker, from yfinance.
#
# Yahoo nests each article's fields under a "content" key, and carries the
# destination URL in two places and the image in a list of resolutions, so the
# helpers below pick one value out of each.

from datetime import datetime

import yfinance as yf

from app.schemas import NewsArticle


# =============================================================================
# News articles
# =============================================================================

def fetch_stock_news(ticker: str, count: int = 10) -> list[NewsArticle]:
    """Return recent news articles for a ticker.

    Args:
        ticker: Stock ticker symbol, e.g. "AAPL".
        count: Upper bound on the articles requested from Yahoo.

    Returns:
        One entry per usable article, newest first. Articles missing a title or
        publish date are dropped, so this can be shorter than ``count``.
    """
    raw_articles = yf.Ticker(ticker).get_news(count=count)

    articles = []
    for item in raw_articles:
        content = item.get("content", {})
        title = content.get("title")
        pub_date = content.get("pubDate")
        # NewsArticle requires both; every other field tolerates None.
        if not title or not pub_date:
            continue

        articles.append(NewsArticle(
            title=title,
            link=_article_link(content),
            img=_best_thumbnail(content.get("thumbnail")),
            summary=content.get("summary") or content.get("description"),
            date=datetime.fromisoformat(pub_date),
        ))
    return articles


# =============================================================================
# Article fields
# =============================================================================

def _article_link(content: dict) -> str | None:
    """Return the URL an article should link to.

    Args:
        content: One article's ``content`` payload.

    Returns:
        The publisher's canonical URL, or Yahoo's tracked click-through URL
        when there is no canonical one. ``None`` if the article carries
        neither.
    """
    canonical = content.get("canonicalUrl") or {}
    if canonical.get("url"):
        return canonical["url"]
    click_through = content.get("clickThroughUrl") or {}
    return click_through.get("url")


def _best_thumbnail(thumbnail: dict | None) -> str | None:
    """Return the URL of an article's widest thumbnail image.

    Args:
        thumbnail: One article's ``thumbnail`` payload, which holds the same
            image at several resolutions.

    Returns:
        The URL of the widest resolution offered, or ``None`` if the article
        carries no thumbnail.
    """
    if not thumbnail:
        return None
    resolutions = thumbnail.get("resolutions") or []
    if not resolutions:
        return None
    return max(resolutions, key=lambda r: r.get("width", 0)).get("url")
