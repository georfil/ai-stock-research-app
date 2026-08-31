import { useId, useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { usePriceHistory } from './hooks/usePriceHistory';
import { StatusBlock } from '../../ui/StatusBlock';
import type { PriceRange } from '../../api/types';

interface PriceChartProps {
  ticker: string;
}

const RANGES: { id: PriceRange; label: string }[] = [
  { id: '1m', label: '1M' },
  { id: '6m', label: '6M' },
  { id: '1y', label: '1Y' },
  { id: '5y', label: '5Y' },
  { id: 'max', label: 'MAX' },
];

const CHART_W = 1000;
const CHART_H = 460;
const PAD = 14;

interface Point {
  date: string;
  close: number;
}

function weekKeyOf(iso: string): string {
  const d = new Date(iso);
  const startOfYear = Date.UTC(d.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((d.getTime() - startOfYear) / 86_400_000);
  return `${d.getUTCFullYear()}-${Math.floor(dayOfYear / 7)}`;
}

/** Keeps the last point of each calendar week — daily granularity reads as
 * noise once a range spans a year or more, weekly reads as a trend. */
function downsampleWeekly(points: Point[]): Point[] {
  if (points.length === 0) return points;
  const result: Point[] = [];
  let weekKey = weekKeyOf(points[0].date);
  let last = points[0];
  for (let i = 1; i < points.length; i++) {
    const key = weekKeyOf(points[i].date);
    if (key !== weekKey) {
      result.push(last);
      weekKey = key;
    }
    last = points[i];
  }
  result.push(last);
  return result;
}

function geometry(points: Point[]) {
  const values = points.map((p) => p.close);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const X = (i: number) => (points.length > 1 ? (i / (points.length - 1)) * CHART_W : CHART_W / 2);
  const Y = (v: number) => PAD + (1 - (v - lo) / span) * (CHART_H - 2 * PAD);
  return { X, Y };
}

function formatDate(iso: string, range: PriceRange): string {
  const d = new Date(iso);
  if (range === '1m' || range === '6m') {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

function formatTooltipDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function PriceChart({ ticker }: PriceChartProps) {
  const [range, setRange] = useState<PriceRange>('1y');
  const [hover, setHover] = useState<number | null>(null);
  const history = usePriceHistory(ticker, range);
  const gradientId = useId();
  const radioName = useId();

  // A gappy or partial bar can have a null/NaN close (yfinance data quirk) —
  // skip those rather than plotting a hole in the line.
  const points: Point[] = useMemo(() => {
    if (history.status !== 'success') return [];
    const daily = history.data
      .filter((b): b is typeof b & { close: number } => typeof b.close === 'number' && Number.isFinite(b.close))
      .map((b) => ({ date: b.date, close: b.close }));
    return range === '1m' || range === '6m' ? daily : downsampleWeekly(daily);
  }, [history, range]);

  const rangeControl = (
    <div className="seg">
      {RANGES.map((r) => (
        <label key={r.id} className="seg-opt">
          <input
            type="radio"
            name={radioName}
            value={r.id}
            checked={range === r.id}
            onChange={() => {
              setRange(r.id);
              setHover(null);
            }}
          />
          {r.label}
        </label>
      ))}
    </div>
  );

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 13 }}>
          <h2 style={{ fontSize: 23, margin: 0 }}>Price</h2>
          {points.length > 1 && <RangeLabel points={points} range={range} />}
        </div>
        {rangeControl}
      </div>

      {history.status === 'loading' && <StatusBlock tone="loading">Loading price history…</StatusBlock>}
      {history.status === 'error' && <StatusBlock tone="error">Couldn't load price history: {history.message}</StatusBlock>}
      {history.status === 'success' && points.length < 2 && <StatusBlock tone="empty">Not enough price data for this range.</StatusBlock>}

      {history.status === 'success' && points.length >= 2 && (
        <ChartBody points={points} range={range} hover={hover} onHover={setHover} gradientId={gradientId} />
      )}
    </section>
  );
}

function RangeLabel({ points, range }: { points: Point[]; range: PriceRange }) {
  const first = points[0].close;
  const last = points[points.length - 1].close;
  const diff = last - first;
  const pct = (diff / first) * 100;
  const isUp = diff >= 0;
  const sign = isUp ? '+' : '';
  const rangeLabel = RANGES.find((r) => r.id === range)?.label ?? range;

  return (
    <span style={{ fontSize: 13.5, color: isUp ? 'var(--up)' : 'var(--down)' }}>
      {sign}
      {diff.toFixed(2)} ({sign}
      {pct.toFixed(1)}%) over {rangeLabel}
    </span>
  );
}

interface ChartBodyProps {
  points: Point[];
  range: PriceRange;
  hover: number | null;
  onHover: (index: number | null) => void;
  gradientId: string;
}

function ChartBody({ points, range, hover, onHover, gradientId }: ChartBodyProps) {
  const { X, Y } = geometry(points);

  let line = '';
  points.forEach((p, i) => {
    const x = X(i).toFixed(2);
    const y = Y(p.close).toFixed(2);
    line += (i ? ' L' : 'M') + x + ' ' + y;
  });
  const area = `${line} L${CHART_W} ${CHART_H} L0 ${CHART_H} Z`;

  const gridY = [0, 1, 2, 3].map((i) => PAD + (i * (CHART_H - 2 * PAD)) / 3);

  const nLabels = 5;
  const xLabels = Array.from({ length: nLabels }, (_, i) => {
    const idx = Math.round((i / (nLabels - 1)) * (points.length - 1));
    return { key: idx, text: formatDate(points[idx].date, range) };
  });

  function onMouseMove(e: ReactMouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const index = Math.round(fraction * (points.length - 1));
    onHover(index);
  }

  const hoverPoint = hover !== null ? points[hover] : null;
  const hoverX = hover !== null ? X(hover) : 0;
  const hoverFraction = hover !== null ? hover / (points.length - 1) : 0;

  return (
    <div
      style={{
        position: 'relative',
        padding: '14px 8px 6px',
        borderRadius: 'var(--radius-md)',
        background: 'linear-gradient(color-mix(in srgb, var(--color-surface) 70%, var(--color-bg)), color-mix(in srgb, var(--color-surface) 50%, var(--color-bg)))',
      }}
    >
      <div
        onMouseMove={onMouseMove}
        onMouseLeave={() => onHover(null)}
        style={{ position: 'relative', height: CHART_H, cursor: 'crosshair' }}
      >
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: CHART_H, overflow: 'visible' }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopOpacity="0.3" style={{ stopColor: 'var(--color-accent)' }} />
              <stop offset="100%" stopOpacity="0" style={{ stopColor: 'var(--color-accent)' }} />
            </linearGradient>
          </defs>
          {gridY.map((y) => (
            <line key={y} x1="0" y1={y} x2={CHART_W} y2={y} strokeOpacity="0.07" strokeWidth={1} style={{ stroke: 'var(--color-text)' }} vectorEffect="non-scaling-stroke" />
          ))}
          <path d={area} fill={`url(#${gradientId})`} />
          <path d={line} fill="none" strokeWidth={2.5} style={{ stroke: 'var(--color-accent)' }} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {hoverPoint && (
            <line
              x1={hoverX}
              y1={0}
              x2={hoverX}
              y2={CHART_H}
              strokeOpacity="0.5"
              strokeWidth={1}
              strokeDasharray="3 3"
              style={{ stroke: 'var(--color-accent-400)' }}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {hoverPoint && (
          <div
            style={{
              position: 'absolute',
              top: `${(Y(hoverPoint.close) / CHART_H) * 100}%`,
              left: `${hoverFraction * 100}%`,
              width: 9,
              height: 9,
              margin: '-4.5px 0 0 -4.5px',
              borderRadius: '50%',
              background: 'var(--color-bg)',
              boxShadow: '0 0 0 2px var(--color-accent-400)',
              pointerEvents: 'none',
            }}
          />
        )}

        {hoverPoint && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: `${hoverFraction * 100}%`,
              transform: hoverFraction > 0.72 ? 'translateX(-100%)' : hoverFraction < 0.14 ? 'translateX(0)' : 'translateX(-50%)',
              padding: '7px 11px',
              borderRadius: 8,
              background: 'var(--color-surface)',
              boxShadow: 'var(--shadow-md)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ font: '500 16.5px var(--font-mono-data)' }}>${hoverPoint.close.toFixed(2)}</div>
            <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginTop: 1 }}>{formatTooltipDate(hoverPoint.date)}</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 2px 0', fontSize: 11.5, color: 'var(--color-neutral-600)' }}>
        {xLabels.map((l) => (
          <span key={l.key}>{l.text}</span>
        ))}
      </div>
    </div>
  );
}
