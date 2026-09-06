import type { ReactNode } from 'react';
import { Sparkle } from '@phosphor-icons/react';
import { useBusinessSummary } from './hooks/useBusinessSummary';
import type { useOverview } from './hooks/useOverview';
import { StatusBlock } from '../../ui/StatusBlock';
import { LockedPreview } from '../../ui/LockedPreview';
import { isAuthError } from '../../hooks/useAsyncData';

const DEMO_PARAGRAPHS = [
  'This section explains what the company actually does — its core products or services, how it makes money, and the main markets or customers it serves.',
  "It's written fresh from the company's latest annual filing, so it stays current as new 10-Ks are published, and calls out whatever sets the business apart competitively.",
  'It also covers the industries and customer segments the business depends on most, so you can see at a glance where its revenue is concentrated.',
  "And it notes anything that differentiates the company from peers — scale, technology, brand, or market position — drawn straight from the filing's own language.",
];

interface AiSummaryProps {
  ticker: string;
  overview: ReturnType<typeof useOverview>;
}

export function AiSummary({ ticker, overview }: AiSummaryProps) {
  const summary = useBusinessSummary(ticker);
  const name = overview.status === 'success' ? overview.data.name : 'this company';

  if (summary.status === 'loading') {
    return <StatusBlock tone="loading">Loading AI summary…</StatusBlock>;
  }

  if (summary.status === 'error') {
    if (isAuthError(summary)) {
      return (
        <Section name={name}>
          <LockedPreview message={`Sign in to read the AI summary.`}>
            <SummaryBody paragraphs={DEMO_PARAGRAPHS} />
          </LockedPreview>
        </Section>
      );
    }
    return summary.message.toLowerCase().includes('no business section') ? (
      <StatusBlock tone="empty">No filing on record to summarize yet.</StatusBlock>
    ) : (
      <StatusBlock tone="error">Couldn't load the AI summary: {summary.message}</StatusBlock>
    );
  }

  const paragraphs = summary.data.summary.split(/\n+/).filter(Boolean);

  return (
    <Section name={name}>
      <SummaryBody paragraphs={paragraphs} />
    </Section>
  );
}

function Section({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-section)', margin: 0 }}>
          What <span style={{ color: 'var(--color-accent-400)' }}>{name}</span> does
        </h2>
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

      {children}

      <div style={{ fontSize: 12.5, color: 'var(--color-neutral-600)' }}>
        Written from the company's latest annual report on file. Not investment advice.
      </div>
    </section>
  );
}

function SummaryBody({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div style={{ padding: 'var(--card-padding)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', boxShadow: '0 0 0 1px var(--color-neutral-800)' }}>
      {paragraphs.map((p, i) => (
        <p
          key={i}
          style={{
            margin: i === paragraphs.length - 1 ? 0 : '0 0 13px',
            fontSize: 'var(--text-prose)',
            lineHeight: 1.7,
            color: 'var(--color-neutral-200)',
            textWrap: 'pretty',
          }}
        >
          {p}
        </p>
      ))}
    </div>
  );
}
