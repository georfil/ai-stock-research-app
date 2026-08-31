import { Star } from '@phosphor-icons/react';
import type { useOverview } from './hooks/useOverview';
import { useQuote } from './hooks/useQuote';
import { StatusBlock } from '../../ui/StatusBlock';
import { CompanyLogo } from '../../ui/CompanyLogo';
import { useAuth } from '../../hooks/useAuth';
import { useWatchlistToggle } from '../../hooks/useWatchlistToggle';

interface StockHeaderProps {
  ticker: string;
  overview: ReturnType<typeof useOverview>;
}

export function StockHeader({ ticker, overview }: StockHeaderProps) {
  const quote = useQuote(ticker);

  if (overview.status === 'loading') {
    return <StatusBlock tone="loading">Loading company overview…</StatusBlock>;
  }
  if (overview.status === 'error') {
    return (
      <StatusBlock tone="error">
        {overview.message.toLowerCase().includes('not found')
          ? `No company found for ticker "${ticker.toUpperCase()}".`
          : `Couldn't load company overview: ${overview.message}`}
      </StatusBlock>
    );
  }

  const info = overview.data;
  const exchange = info.exchanges.find((e) => e) ?? null;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ font: '500 14px var(--font-mono-data)', color: 'var(--color-accent-400)' }}>
          {info.ticker}
        </span>
        {exchange && <span className="tag tag-neutral">{exchange}</span>}
        {info.industry && <span className="tag tag-outline">{info.industry}</span>}
        <WatchlistToggle ticker={info.ticker} />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 30, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <CompanyLogo key={info.ticker} src={info.img} alt="" size={52} />
          <h1 style={{ fontSize: 44, margin: '0 0 3px', letterSpacing: '-0.025em' }}>{info.name}</h1>
        </div>

        <QuoteDisplay state={quote} />
      </div>
    </section>
  );
}

function WatchlistToggle({ ticker }: { ticker: string }) {
  const auth = useAuth();
  const { membership, toggle, isToggling } = useWatchlistToggle(ticker, auth.status === 'authed');

  if (auth.status !== 'authed') return null;

  const isIn = membership === 'in';

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={toggle}
      disabled={membership === 'loading' || isToggling}
      title={isIn ? 'Remove from watchlist' : 'Add to watchlist'}
      aria-pressed={isIn}
      style={{
        display: 'grid',
        placeItems: 'center',
        width: 26,
        height: 26,
        padding: 0,
        borderRadius: 6,
        color: isIn ? 'var(--color-accent-400)' : 'var(--color-neutral-500)',
      }}
    >
      <Star size={15} weight={isIn ? 'fill' : 'regular'} />
    </button>
  );
}

function QuoteDisplay({ state }: { state: ReturnType<typeof useQuote> }) {
  if (state.status === 'loading') {
    return <StatusBlock tone="loading">Loading price…</StatusBlock>;
  }
  if (state.status === 'error') {
    return <StatusBlock tone="empty">Price unavailable.</StatusBlock>;
  }

  const { price, change, changePercent, asOfDate } = state.data;
  const isUp = change >= 0;
  const color = isUp ? 'var(--up)' : 'var(--down)';
  const sign = isUp ? '+' : '';

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18 }}>
      <div style={{ textAlign: 'right' }}>
        <div style={{ font: '500 42px/1 var(--font-body)', letterSpacing: '-0.03em' }}>${price.toFixed(2)}</div>
        <div style={{ marginTop: 7, fontSize: 14, color }}>
          {sign}
          {change.toFixed(2)} ({sign}
          {changePercent.toFixed(2)}%)
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--color-neutral-600)', textAlign: 'right' }}>
        <span>
          Close{' '}
          {new Date(asOfDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>
    </div>
  );
}
