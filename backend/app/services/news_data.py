import yfinance as yf
from datetime import datetime

from app.schemas import NewsArticle

def get_stock_news(ticker: str, count: int = 10) -> list[NewsArticle]:
    """Returns recent news articles for a ticker."""
    raw_articles = yf.Ticker(ticker).get_news(count=count)

    articles = []
    for item in raw_articles:
        content = item.get("content", {})
        title = content.get("title")
        pub_date = content.get("pubDate")
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

def _article_link(content: dict) -> str | None:
    """Prefers the canonical article URL, falling back to the tracked click-through link."""
    canonical = content.get("canonicalUrl") or {}
    if canonical.get("url"):
        return canonical["url"]
    click_through = content.get("clickThroughUrl") or {}
    return click_through.get("url")

def _best_thumbnail(thumbnail: dict | None) -> str | None:
    """Picks the highest-resolution thumbnail image, if any."""
    if not thumbnail:
        return None
    resolutions = thumbnail.get("resolutions") or []
    if not resolutions:
        return None
    return max(resolutions, key=lambda r: r.get("width", 0)).get("url")
