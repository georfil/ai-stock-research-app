import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { CaretDown, CaretUp, Star } from '@phosphor-icons/react';
import type { CompanyInfo } from '../../api/types';
import type { useOverview } from './hooks/useOverview';
import { StatusBlock } from '../../ui/StatusBlock';
import { CompanyLogo } from '../../ui/CompanyLogo';
import { useAuth } from '../../hooks/useAuth';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useWatchlistToggle } from '../../hooks/useWatchlistToggle';

interface StockHeaderProps {
  ticker: string;
  overview: ReturnType<typeof useOverview>;
}

export function StockHeader({ ticker, overview }: StockHeaderProps) {
  const isMobile = useIsMobile();

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

  const rule = (
    <div
      aria-hidden="true"
      style={{
        height: 1,
        background: 'linear-gradient(to right, var(--color-divider), var(--color-divider) 65%, transparent)',
      }}
    />
  );

  // Mobile: one left-aligned column, top to bottom — identity, then name
  // (with the star beside it rather than stranded on its own line), then
  // the quote, then the range. Nothing right-aligned and nothing sharing a
  // baseline; the two-column arrangement below is desktop-only.
  if (isMobile) {
    return (
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <MetaRow info={info} exchange={exchange} stacked />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <CompanyLogo key={info.ticker} src={info.img} alt="" size={36} />
          <h1
            style={{
              margin: 0,
              minWidth: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-display)',
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              overflowWrap: 'break-word',
            }}
          >
            {info.name}
          </h1>
          <WatchlistToggle ticker={info.ticker} />
        </div>

        <QuoteDisplay info={info} align="start" />

        {rule}

        <DayRangeTrack info={info} stacked />
      </section>
    );
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Two wrapping rows rather than a `minmax(0,1fr) max-content` grid.
          That grid could never collapse: the price column sized to
          max-content (~272px), which on a phone left ~46px for the company
          name. As flex rows, the price simply drops below the name once the
          two stop fitting side by side. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <MetaRow info={info} exchange={exchange} />
        <div style={{ marginLeft: 'auto', flex: 'none' }}>
          <WatchlistToggle ticker={info.ticker} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'clamp(12px, 2vw, 24px)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, flex: '1 1 260px' }}>
          <CompanyLogo key={info.ticker} src={info.img} alt="" size={44} />
          <h1
            style={{
              margin: 0,
              minWidth: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-display)',
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              overflowWrap: 'break-word',
            }}
          >
            {info.name}
          </h1>
        </div>
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <QuoteDisplay info={info} />
        </div>
      </div>

      {rule}

      <DayRangeTrack info={info} />
    </section>
  );
}

function MetaRow({ info, exchange, stacked = false }: { info: CompanyInfo; exchange: string | null; stacked?: boolean }) {
  const items: { key: string; node: ReactNode }[] = [
    {
      key: 'ticker',
      node: (
        <span style={{ font: '500 13.5px var(--font-mono-data)', color: 'var(--color-accent-400)' }}>{info.ticker}</span>
      ),
    },
  ];
  if (exchange) {
    items.push({ key: 'exchange', node: <span style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>{exchange}</span> });
  }
  // Stacked: the industry moves to its own line below rather than joining
  // the divider-separated list. A wrapping divider list is what produced
  // "RDW | NYSE |" with a trailing rule and nothing after it — the divider
  // belongs *between* items on one line, so the list must not wrap.
  if (info.industry && !stacked) {
    items.push({ key: 'industry', node: <span style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>{info.industry}</span> });
  }

  const row = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flexWrap: stacked ? 'nowrap' : 'wrap' }}>
      {items.map((item, i) => (
        <Fragment key={item.key}>
          {i > 0 && <span aria-hidden="true" style={{ width: 1, height: 12, flex: 'none', background: 'var(--color-divider)' }} />}
          {item.node}
        </Fragment>
      ))}
    </div>
  );

  if (!stacked) return row;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      {row}
      {info.industry && (
        <span style={{ fontSize: 13, color: 'var(--color-neutral-500)', overflowWrap: 'break-word' }}>{info.industry}</span>
      )}
    </div>
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
        width: 'var(--tap-min)',
        height: 'var(--tap-min)',
        flex: 'none',
        padding: 0,
        borderRadius: 6,
        color: isIn ? 'var(--color-accent-400)' : 'var(--color-neutral-500)',
      }}
    >
      <Star size={15} weight={isIn ? 'fill' : 'regular'} />
    </button>
  );
}

function QuoteDisplay({ info, align = 'end' }: { info: CompanyInfo; align?: 'start' | 'end' }) {
  const isUp = info.change >= 0;
  const color = isUp ? 'var(--up)' : 'var(--down)';
  const sign = isUp ? '+' : '';
  const Caret = isUp ? CaretUp : CaretDown;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 12,
        flexWrap: 'wrap',
        justifyContent: align === 'start' ? 'flex-start' : 'flex-end',
      }}
    >
      <span
        style={{
          font: '500 var(--text-price)/1.05 var(--font-body)',
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        ${info.price.toFixed(2)}
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 9px',
          borderRadius: 999,
          fontSize: 13,
          fontVariantNumeric: 'tabular-nums',
          color,
          background: `color-mix(in srgb, ${color} 13%, transparent)`,
        }}
      >
        <Caret size={10} weight="bold" />
        {sign}
        {info.change.toFixed(2)} ({sign}
        {info.change_percent.toFixed(2)}%)
      </span>
    </div>
  );
}

function DayRangeTrack({ info, stacked = false }: { info: CompanyInfo; stacked?: boolean }) {
  const span = info.day_high - info.day_low;
  const pct = span > 0 ? Math.min(100, Math.max(0, ((info.price - info.day_low) / span) * 100)) : 50;

  const marker = (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: '50%',
        left: `${pct}%`,
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: 'var(--color-accent-400)',
        boxShadow: '0 0 0 2px var(--color-bg)',
        transform: 'translate(-50%, -50%)',
      }}
    />
  );

  // Stacked: labels above, track spanning the full column beneath them.
  // Side by side, the track was squeezed between two price labels and a
  // caption — about 90px of usable track on a phone.
  if (stacked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ font: '13px var(--font-mono-data)', color: 'var(--color-neutral-500)' }}>${info.day_low.toFixed(2)}</span>
          <span style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>
            Day range
          </span>
          <span style={{ font: '13px var(--font-mono-data)', color: 'var(--color-neutral-500)' }}>${info.day_high.toFixed(2)}</span>
        </div>
        <div style={{ position: 'relative', width: '100%', height: 3, borderRadius: 2, background: 'var(--color-divider)' }}>
          {marker}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ font: '13px var(--font-mono-data)', color: 'var(--color-neutral-500)', flex: 'none' }}>${info.day_low.toFixed(2)}</span>
      <div
        style={{
          position: 'relative',
          // Flexes rather than holding a 120px floor, so the track gives way
          // before the row it lives in is forced to overflow.
          flex: '1 1 90px',
          maxWidth: 200,
          minWidth: 0,
          height: 3,
          borderRadius: 2,
          background: 'var(--color-divider)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '50%',
            left: `${pct}%`,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--color-accent-400)',
            boxShadow: '0 0 0 2px var(--color-bg)',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>
      <span style={{ font: '13px var(--font-mono-data)', color: 'var(--color-neutral-500)', flex: 'none' }}>${info.day_high.toFixed(2)}</span>
      <span style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-neutral-600)', flex: 'none' }}>
        Day range
      </span>
    </div>
  );
}
