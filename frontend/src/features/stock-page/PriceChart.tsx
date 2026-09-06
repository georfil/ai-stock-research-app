import { useId, useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { usePriceHistory } from './hooks/usePriceHistory';
import { StatusBlock } from '../../ui/StatusBlock';
import { useIsMobile } from '../../hooks/useMediaQuery';
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
const CHART_H = 380;
const PLOT_INSET = 15;
// The right side carries the price-axis labels, so the plotted line/area
// gets a wider gutter there — otherwise the line runs straight under the
// text instead of stopping clear of it.
const PLOT_INSET_RIGHT = 60;

interface Point {
  date: string;
  close: number;
}

/** Rounds a raw axis step up to a "nice" 1/2/2.5/5 × 10ⁿ value so gridlines
 * land on prices a reader would actually round to, not even pixel divisions. */
function niceStep(span: number, maxTicks: number): number {
  if (span <= 0) return 1;
  const roughStep = span / maxTicks;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  let niceNormalized: number;
  if (normalized < 1.5) niceNormalized = 1;
  else if (normalized < 2.25) niceNormalized = 2;
  else if (normalized < 3.75) niceNormalized = 2.5;
  else if (normalized < 7.5) niceNormalized = 5;
  else niceNormalized = 10;
  return niceNormalized * magnitude;
}

function priceGridlines(lo: number, hi: number): number[] {
  const step = niceStep(hi - lo, 5);
  const first = Math.ceil(lo / step) * step;
  const ticks: number[] = [];
  for (let v = first; v <= hi + 1e-9; v += step) ticks.push(v);
  return ticks;
}

function weekKeyOf(iso: string): string {
  const d = new Date(iso);
  const startOfYear = Date.UTC(d.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((d.getTime() - startOfYear) / 86_400_000);
  return `${d.getUTCFullYear()}-${Math.floor(dayOfYear / 7)}`;
}

/** Thins a series to at most `max` points by keeping every Nth, preserving
 *  the last one so the series still ends on the latest close. Weekly
 *  downsampling alone still leaves ~260 points on a 5y range, which is more
 *  than a ~380px-wide render has pixels to draw them into — past that the
 *  extra points cost work and add nothing a reader can see. */
function capPoints(points: Point[], max: number): Point[] {
  if (points.length <= max) return points;
  const stride = Math.ceil(points.length / max);
  const kept = points.filter((_, i) => i % stride === 0);
  const last = points[points.length - 1];
  if (kept[kept.length - 1] !== last) kept.push(last);
  return kept;
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
  const rawLo = Math.min(...values);
  const rawHi = Math.max(...values);
  const rawSpan = rawHi - rawLo || 1;
  // Pad 8% above the max and below the min so peaks/troughs never touch the
  // panel edge or collide with the top gridline.
  const lo = rawLo - rawSpan * 0.08;
  const hi = rawHi + rawSpan * 0.08;
  const span = hi - lo;
  const X = (i: number) =>
    points.length > 1
      ? PLOT_INSET + (i / (points.length - 1)) * (CHART_W - PLOT_INSET - PLOT_INSET_RIGHT)
      : CHART_W / 2;
  const Y = (v: number) => (1 - (v - lo) / span) * CHART_H;
  return { X, Y, lo, hi };
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
  const isMobile = useIsMobile();
  const gradientId = useId();
  const radioName = useId();

  // A gappy or partial bar can have a null/NaN close (yfinance data quirk) —
  // skip those rather than plotting a hole in the line.
  const points: Point[] = useMemo(() => {
    if (history.status !== 'success') return [];
    const daily = history.data
      .filter((b): b is typeof b & { close: number } => typeof b.close === 'number' && Number.isFinite(b.close))
      .map((b) => ({ date: b.date, close: b.close }));
    const thinned = range === '1m' || range === '6m' ? daily : downsampleWeekly(daily);
    return capPoints(thinned, isMobile ? 180 : 520);
  }, [history, range, isMobile]);

  const rangeControl = (
    <div className="seg" style={isMobile ? { display: 'flex', width: '100%' } : undefined}>
      {RANGES.map((r) => (
        // Evenly divided across the full width on mobile, at a full tap
        // target, rather than a small cluster pushed to one side.
        <label key={r.id} className="seg-opt" style={isMobile ? { flex: 1, minHeight: 'var(--tap-min)' } : undefined}>
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
      <div
        style={{
          display: 'flex',
          alignItems: isMobile ? 'stretch' : 'center',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          gap: isMobile ? 14 : 20,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 13, flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-section)', margin: 0 }}>Price</h2>
          {points.length > 1 && <RangeLabel points={points} range={range} />}
        </div>
        {rangeControl}
      </div>

      {history.status === 'loading' && <ChartSkeleton />}
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

// A believable, fixed wiggle (fractions from the top; not real data) so the
// placeholder reads as "a line chart is coming" rather than a flat box.
const SKELETON_TREND = [0.72, 0.68, 0.74, 0.6, 0.66, 0.52, 0.58, 0.44, 0.5, 0.38, 0.44, 0.3, 0.36, 0.22, 0.28, 0.16];

// Same outer padding/radius/background and the same CHART_H as ChartBody
// itself, so the section doesn't resize once the real chart replaces it —
// the user can see exactly how much space it'll take before it's there. The
// chart area itself is .skeleton-bar's usual shimmer, just clipped to a
// wiggle-shaped path instead of a flat rectangle, so it still shimmers like
// every other skeleton in the app rather than introducing its own pulse.
function ChartSkeleton() {
  const n = SKELETON_TREND.length;
  const areaPoints = SKELETON_TREND.map((frac, i) => `${((i / (n - 1)) * 100).toFixed(2)}% ${(frac * 100).toFixed(2)}%`);
  const areaClip = `polygon(${areaPoints.join(', ')}, 100% 100%, 0% 100%)`;

  return (
    <div
      aria-hidden="true"
      style={{
        padding: '14px 8px 6px',
        borderRadius: 'var(--radius-md)',
        background: 'linear-gradient(color-mix(in srgb, var(--color-surface) 78%, var(--color-bg)), color-mix(in srgb, var(--color-surface) 38%, var(--color-bg)))',
        boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--color-text) 12%, transparent)',
      }}
    >
      <div style={{ position: 'relative', height: 'var(--chart-height)', overflow: 'hidden', borderRadius: 'var(--radius-sm)' }}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${(i / 3) * 100}%`,
              height: 1,
              background: 'color-mix(in srgb, var(--color-text) 7%, transparent)',
            }}
          />
        ))}
        <span
          className="skeleton-bar"
          style={{ position: 'absolute', inset: 0, clipPath: areaClip, WebkitClipPath: areaClip, borderRadius: 0 }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 2px 0' }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="skeleton-bar" style={{ width: 46, height: 11, animationDelay: `${i * 45}ms` }} />
        ))}
      </div>
    </div>
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
  const { X, Y, lo, hi } = geometry(points);

  let line = '';
  points.forEach((p, i) => {
    const x = X(i).toFixed(2);
    const y = Y(p.close).toFixed(2);
    line += (i ? ' L' : 'M') + x + ' ' + y;
  });
  const area = `${line} L${X(points.length - 1).toFixed(2)} ${CHART_H} L${X(0).toFixed(2)} ${CHART_H} Z`;

  // Gridlines snap to rounded price steps, not even pixel divisions, and
  // skip the top 6% of the plot so a line never crowds the panel edge.
  const gridlines = priceGridlines(lo, hi)
    .map((price) => ({ price, y: Y(price) }))
    .filter((g) => g.y >= CHART_H * 0.06);

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
  // The container's width maps 1:1 to CHART_W SVG units (viewBox scaling),
  // so this is the correct left% for overlay (non-SVG) elements — unlike an
  // index-based fraction, it stays correct now that the plot's left/right
  // insets are no longer equal.
  const hoverXPercent = hover !== null ? (hoverX / CHART_W) * 100 : 0;

  return (
    <div
      style={{
        position: 'relative',
        padding: '14px 8px 6px',
        borderRadius: 'var(--radius-md)',
        background: 'linear-gradient(color-mix(in srgb, var(--color-surface) 78%, var(--color-bg)), color-mix(in srgb, var(--color-surface) 38%, var(--color-bg)))',
        boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--color-text) 12%, transparent)',
      }}
    >
      <div
        onMouseMove={onMouseMove}
        onMouseLeave={() => onHover(null)}
        style={{ position: 'relative', height: 'var(--chart-height)', cursor: 'crosshair' }}
      >
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 'var(--chart-height)', overflow: 'visible' }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopOpacity="0.14" style={{ stopColor: 'var(--color-accent)' }} />
              <stop offset="70%" stopOpacity="0" style={{ stopColor: 'var(--color-accent)' }} />
            </linearGradient>
          </defs>
          {gridlines.map((g) => (
            <line
              key={g.price}
              x1="0"
              y1={g.y}
              x2={CHART_W}
              y2={g.y}
              strokeOpacity="0.07"
              strokeWidth={1}
              style={{ stroke: 'var(--color-text)' }}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={area} fill={`url(#${gradientId})`} />
          <path d={line} fill="none" strokeWidth={1.6} style={{ stroke: 'var(--color-accent)' }} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
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

        {gridlines.map((g) => (
          <span
            key={g.price}
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: `${(g.y / CHART_H) * 100}%`,
              right: 0,
              transform: 'translateY(-100%)',
              fontSize: 'clamp(9.5px, 0.8vw, 11px)',
              color: 'var(--color-neutral-600)',
              pointerEvents: 'none',
              // The plot's right gutter is a share of the width (viewBox
              // units), while these labels are a fixed px width — so the
              // gutter stops clearing them as the chart narrows. A faint
              // ground keeps them readable where the line runs underneath.
              background: 'color-mix(in srgb, var(--color-bg) 62%, transparent)',
              borderRadius: 3,
              padding: '0 2px',
            }}
          >
            ${g.price.toFixed(2)}
          </span>
        ))}

        {hoverPoint && (
          <div
            style={{
              position: 'absolute',
              top: `${(Y(hoverPoint.close) / CHART_H) * 100}%`,
              left: `${hoverXPercent}%`,
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
              left: `${hoverXPercent}%`,
              transform: hoverXPercent > 72 ? 'translateX(-100%)' : hoverXPercent < 14 ? 'translateX(0)' : 'translateX(-50%)',
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

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, padding: '9px 2px 0', fontSize: 'clamp(9.5px, 0.9vw, 11.5px)', color: 'var(--color-neutral-600)' }}>
        {xLabels.map((l) => (
          <span key={l.key} style={{ whiteSpace: 'nowrap' }}>{l.text}</span>
        ))}
      </div>
    </div>
  );
}
