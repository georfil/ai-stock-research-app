import { Sparkle } from '@phosphor-icons/react';
import { useBusinessSummary } from './hooks/useBusinessSummary';
import type { useOverview } from './hooks/useOverview';
import { StatusBlock } from '../../ui/StatusBlock';

interface AiSummaryProps {
  ticker: string;
  overview: ReturnType<typeof useOverview>;
}

export function AiSummary({ ticker, overview }: AiSummaryProps) {
  const summary = useBusinessSummary(ticker);

  if (summary.status === 'loading') {
    return <StatusBlock tone="loading">Loading AI summary…</StatusBlock>;
  }
  if (summary.status === 'error') {
    return summary.message.toLowerCase().includes('no business section') ? (
      <StatusBlock tone="empty">No filing on record to summarize yet.</StatusBlock>
    ) : (
      <StatusBlock tone="error">Couldn't load the AI summary: {summary.message}</StatusBlock>
    );
  }

  const name = overview.status === 'success' ? overview.data.name : 'this company';
  const paragraphs = summary.data.summary.split(/\n+/).filter(Boolean);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <h2 style={{ fontSize: 23, margin: 0 }}>What {name} does</h2>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 11,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--color-accent-400)',
            border: '1px solid color-mix(in srgb, var(--color-accent) 55%, transparent)',
          }}
        >
          <Sparkle size={12} weight="fill" />
          AI generated
        </span>
      </div>

      <div style={{ padding: '28px 30px', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', boxShadow: '0 0 0 1px var(--color-neutral-800)' }}>
        {paragraphs.map((p, i) => (
          <p
            key={i}
            style={{
              margin: i === paragraphs.length - 1 ? 0 : '0 0 13px',
              fontSize: 17,
              lineHeight: 1.7,
              color: 'var(--color-neutral-200)',
              textWrap: 'pretty',
            }}
          >
            {p}
          </p>
        ))}
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--color-neutral-600)' }}>
        Written from the company's latest annual report on file. Not investment advice.
      </div>
    </section>
  );
}
