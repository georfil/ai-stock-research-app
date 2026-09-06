import { StatusBlock } from '../../ui/StatusBlock';
import { useNews } from './hooks/useNews';
import type { NewsArticle } from '../../api/types';

interface NewsSectionProps {
  ticker: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function NewsSection({ ticker }: NewsSectionProps) {
  const news = useNews(ticker);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-neutral-600)', margin: 0 }}>
        Recent news
      </h2>

      {news.status === 'loading' && <StatusBlock tone="loading">Loading news…</StatusBlock>}
      {news.status === 'error' && <StatusBlock tone="error">Couldn't load news: {news.message}</StatusBlock>}
      {news.status === 'success' && news.data.length === 0 && (
        <StatusBlock tone="empty">No recent news for {ticker}.</StatusBlock>
      )}

      {news.status === 'success' && news.data.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {news.data.map((article, i) => (
            <NewsRow key={`${article.title}-${i}`} article={article} />
          ))}
        </div>
      )}
    </section>
  );
}

function NewsRow({ article }: { article: NewsArticle }) {
  const Container = article.link ? 'a' : 'div';

  return (
    <Container
      {...(article.link ? { href: article.link, target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={article.link ? 'news-row' : undefined}
      style={{
        display: 'flex',
        gap: 12,
        padding: '13px 8px',
        margin: '0 -8px',
        borderRadius: 'var(--radius-md)',
        borderTop: '1px solid var(--color-divider)',
        color: 'inherit',
        textDecoration: 'none',
      }}
    >
      {article.img && (
        <img
          src={article.img}
          alt=""
          width={64}
          height={64}
          style={{
            width: 64,
            height: 64,
            flex: 'none',
            borderRadius: 'var(--radius-sm)',
            objectFit: 'cover',
            background: 'var(--color-surface)',
          }}
        />
      )}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ font: '500 13.5px/1.35 var(--font-body)', letterSpacing: '-0.005em' }}>{article.title}</span>
        {article.summary && (
          <span
            style={{
              fontSize: 12.5,
              lineHeight: 1.4,
              color: 'var(--color-neutral-500)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {article.summary}
          </span>
        )}
        <span style={{ fontSize: 11.5, color: 'var(--color-neutral-600)' }}>{formatDate(article.date)}</span>
      </div>
    </Container>
  );
}
