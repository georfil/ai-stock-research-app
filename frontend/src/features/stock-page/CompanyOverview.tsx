import { usePriceHistory } from './hooks/usePriceHistory';
import type { useOverview } from './hooks/useOverview';
import { StatusBlock } from '../../ui/StatusBlock';

interface CompanyOverviewProps {
  ticker: string;
  overview: ReturnType<typeof useOverview>;
}

interface Stat {
  label: string;
  value: string;
}

export function CompanyOverview({ ticker, overview }: CompanyOverviewProps) {
  const yearHistory = usePriceHistory(ticker, '1y');

  if (overview.status === 'loading') {
    return <StatusBlock tone="loading">Loading company overview…</StatusBlock>;
  }
  if (overview.status === 'error') {
    return <StatusBlock tone="error">Couldn't load company overview.</StatusBlock>;
  }

  const info = overview.data;
  const exchange = info.exchanges.find((e) => e) ?? null;

  const stats: Stat[] = [];
  if (info.industry) stats.push({ label: 'Industry', value: info.industry });
  if (exchange) stats.push({ label: 'Exchange', value: exchange });

  if (yearHistory.status === 'success') {
    const closes = yearHistory.data
      .map((b) => b.close)
      .filter((c): c is number => typeof c === 'number' && Number.isFinite(c));
    if (closes.length > 0) {
      const lo = Math.min(...closes);
      const hi = Math.max(...closes);
      stats.push({ label: '52-week range', value: `$${lo.toFixed(2)} – $${hi.toFixed(2)}` });
    }
  }

  if (stats.length === 0) {
    return <StatusBlock tone="empty">No overview details available.</StatusBlock>;
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-neutral-600)', margin: 0 }}>
        Company overview
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 16,
              padding: '11px 0',
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--color-neutral-500)' }}>{s.label}</span>
            <span style={{ font: '500 15px var(--font-body)', letterSpacing: '-0.01em', textAlign: 'right' }}>{s.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
