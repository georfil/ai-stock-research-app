import type { useOverview } from './hooks/useOverview';
import { StatusBlock } from '../../ui/StatusBlock';

interface CompanyOverviewProps {
  overview: ReturnType<typeof useOverview>;
}

interface Stat {
  label: string;
  value: string;
}

const compactNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 });

export function CompanyOverview({ overview }: CompanyOverviewProps) {
  if (overview.status === 'loading') {
    return <StatusBlock tone="loading">Loading company overview…</StatusBlock>;
  }
  if (overview.status === 'error') {
    return <StatusBlock tone="error">Couldn't load company overview.</StatusBlock>;
  }

  const info = overview.data;

  // Industry and exchange already appear in the stock header above — no
  // need to repeat them here.
  const stats: Stat[] = [];
  if (info.year_low !== null && info.year_high !== null) {
    stats.push({ label: '52-week range', value: `$${info.year_low.toFixed(2)} – $${info.year_high.toFixed(2)}` });
  }
  stats.push({ label: 'Market cap', value: `$${compactNumber.format(info.market_cap)}` });
  stats.push({ label: 'Shares outstanding', value: compactNumber.format(info.shares) });
  if (info.beta !== null) {
    stats.push({ label: 'Beta', value: info.beta.toFixed(2) });
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
              flexWrap: 'wrap',
              gap: '2px 16px',
              padding: '11px 0',
            }}
          >
            <span style={{ fontSize: 12.5, color: 'var(--color-neutral-500)' }}>{s.label}</span>
            <span style={{ font: '500 14px var(--font-body)', letterSpacing: '-0.01em', textAlign: 'right', marginLeft: 'auto' }}>{s.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
