import { useOverview } from './hooks/useOverview';
import { useQuote } from './hooks/useQuote';
import { StatusBlock } from '../../ui/StatusBlock';

interface StockHeaderProps {
  ticker: string;
}

export function StockHeader({ ticker }: StockHeaderProps) {
  const overview = useOverview(ticker);
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
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ font: '500 13px ui-monospace, Menlo, monospace', color: 'var(--color-accent-400)' }}>
          {info.ticker}
        </span>
        {exchange && <span className="tag tag-neutral">{exchange}</span>}
        {info.industry && <span className="tag tag-outline">{info.industry}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 30, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 38, margin: '0 0 3px', letterSpacing: '-0.025em' }}>{info.name}</h1>
        </div>

        <QuoteDisplay state={quote} />
      </div>
    </section>
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
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
      <div style={{ textAlign: 'right' }}>
        <div style={{ font: '500 36px/1 var(--font-body)', letterSpacing: '-0.03em' }}>${price.toFixed(2)}</div>
        <div style={{ marginTop: 6, fontSize: 13, color }}>
          {sign}
          {change.toFixed(2)} ({sign}
          {changePercent.toFixed(2)}%)
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--color-neutral-600)', textAlign: 'right' }}>
        <span>
          Close{' '}
          {new Date(asOfDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>
    </div>
  );
}
