import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from '@phosphor-icons/react';
import { useWatchlist } from './hooks/useWatchlist';
import { useWatchlistQuotes } from './hooks/useWatchlistQuotes';
import { removeFromWatchlist } from '../../api/users';
import type { WatchlistStock } from '../../api/types';
import { StatusBlock } from '../../ui/StatusBlock';
import { Sparkline } from '../../ui/Sparkline';
import { ElevatedSurface } from '../../ui/ElevatedSurface';

interface WatchlistSectionProps {
  onAddFirst: () => void;
}

export function WatchlistSection({ onAddFirst }: WatchlistSectionProps) {
  const state = useWatchlist(true);
  const [items, setItems] = useState<WatchlistStock[]>([]);
  const [syncedData, setSyncedData] = useState<WatchlistStock[] | null>(null);
  const navigate = useNavigate();

  if (state.status === 'success' && state.data !== syncedData) {
    setSyncedData(state.data);
    setItems(state.data);
  }

  const quotes = useWatchlistQuotes(items.map((s) => s.ticker));

  async function remove(ticker: string) {
    const previous = items;
    setItems((prev) => prev.filter((s) => s.ticker !== ticker));
    try {
      await removeFromWatchlist(ticker);
    } catch {
      setItems(previous);
    }
  }

  if (state.status === 'loading') {
    return <StatusBlock tone="loading">Loading your watchlist…</StatusBlock>;
  }
  if (state.status === 'error') {
    return <StatusBlock tone="error">Couldn't load your watchlist: {state.message}</StatusBlock>;
  }

  if (items.length === 0) {
    return (
      <ElevatedSurface style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 18px', fontSize: 14, color: 'var(--color-neutral-500)' }}>
        <span>Your watchlist is empty.</span>
        <button
          type="button"
          onClick={onAddFirst}
          style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer', color: 'var(--color-accent-400)', font: 'inherit' }}
        >
          Add your first ticker
        </button>
      </ElevatedSurface>
    );
  }

  return (
    <ElevatedSurface style={{ padding: '4px 6px' }}>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((s, i) => {
          const quote = quotes[s.ticker];
          const isUp = quote ? quote.change >= 0 : true;
          const changeColor = isUp ? 'var(--up)' : 'var(--down)';
          const sign = quote && quote.change >= 0 ? '+' : '';

          return (
            <li key={s.id}>
              {i > 0 && (
                <div
                  style={{
                    height: 1,
                    margin: '0 8px',
                    background:
                      'linear-gradient(to right, transparent, var(--color-divider) 15%, var(--color-divider) 85%, transparent)',
                  }}
                />
              )}
              {/* Two groups in a wrapping row rather than six fixed columns
                  (which needed 520px before the name got a single pixel).
                  Identity stays together, the numbers stay together, and the
                  numbers group drops to its own full-width line when the two
                  no longer fit side by side — the wrap point comes from the
                  content's own widths, so there's no breakpoint to pick. */}
              <div
                className="watchlist-row"
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '10px clamp(10px, 1.6vw, 16px)',
                  padding: 'clamp(12px, 1.6vw, 16px) 12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px, 1.6vw, 16px)', flex: '1 1 190px', minWidth: 0 }}>
                  <button
                    type="button"
                    className="list-row-link"
                    onClick={() => navigate(`/stocks/${s.ticker}`)}
                    style={{ font: '500 15px var(--font-mono-data)', color: 'var(--color-accent-400)', padding: 0, flex: 'none' }}
                  >
                    {s.ticker}
                  </button>
                  <button
                    type="button"
                    className="list-row-link"
                    onClick={() => navigate(`/stocks/${s.ticker}`)}
                    style={{ fontSize: 'clamp(14px, 1.3vw, 16px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: 0, minWidth: 0, flex: '1 1 auto' }}
                  >
                    {s.name}
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px, 1.6vw, 16px)', marginLeft: 'auto', flex: '0 1 auto', minWidth: 0 }}>
                  <span style={{ fontSize: 15, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-neutral-200)', flex: 'none' }}>
                    {quote ? `$${quote.price.toFixed(2)}` : '—'}
                  </span>
                  <span style={{ fontSize: 13.5, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: quote ? changeColor : 'var(--color-neutral-600)', flex: 'none' }}>
                    {quote ? `${sign}${quote.changePercent.toFixed(2)}%` : ''}
                  </span>
                  <span style={{ display: 'flex', justifyContent: 'flex-end', flex: '1 1 70px', maxWidth: 130, minWidth: 0 }}>
                    {quote && <Sparkline values={quote.prices} width={120} height={32} color={changeColor} />}
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => remove(s.ticker)}
                    title="Remove from watchlist"
                    style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', padding: 0, borderRadius: 6, color: 'var(--color-neutral-600)', flex: 'none' }}
                  >
                    <X size={13} weight="bold" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </ElevatedSurface>
  );
}
