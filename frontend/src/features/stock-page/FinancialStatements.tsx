import { useEffect, useRef, useState } from 'react';
import { useFinancialStatement, pivotStatement } from './hooks/useFinancialStatement';
import { StatusBlock } from '../../ui/StatusBlock';
import { LockedPreview } from '../../ui/LockedPreview';
import { isAuthError } from '../../hooks/useAsyncData';
import { useIsMobile } from '../../hooks/useMediaQuery';
import type { FinancialLine, FinancialStatementType } from '../../api/types';

interface FinancialStatementsProps {
  ticker: string;
}

const TABS: { id: FinancialStatementType; label: string }[] = [
  { id: 'income_statement', label: 'Income statement' },
  { id: 'balance_sheet', label: 'Balance sheet' },
  { id: 'cash_flows', label: 'Cash flow' },
];

// Cosmetic only — varied widths so the skeleton doesn't look like a grid of
// identical bricks, and enough rows to fill roughly what a real statement does.
const SKELETON_ROW_LABEL_WIDTHS = [62, 45, 70, 52, 80, 40, 66, 58, 74, 48, 68, 55];

function formatValue(value: number | null, unit: string | null): string {
  if (value === null) return '—';
  if (unit === 'shares') {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
  }
  if (unit === 'usdPerShare') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }
  // Default to USD, compact — Intl places the sign correctly on negatives
  // ("-$565M"), which prepending "$" to a formatted negative would not.
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(value);
}

export function FinancialStatements({ ticker }: FinancialStatementsProps) {
  const [tab, setTab] = useState<FinancialStatementType>('income_statement');
  const state = useFinancialStatement(ticker, tab);
  const isMobile = useIsMobile();

  // A tab switch re-fetches, which would otherwise collapse the table down to
  // a one-line "Loading…" placeholder — that shrink was yanking the page's
  // scroll position around mid-fetch. Once we've loaded a table at least
  // once, later loads show a skeleton sized off the last real table instead.
  const [columnCount, setColumnCount] = useState(3);
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const [placeholderHeight, setPlaceholderHeight] = useState<number | null>(null);

  if (state.status === 'success' && state.data && state.data.length > 0) {
    const periodCount = new Set(state.data.map((l) => l.period)).size;
    if (periodCount !== columnCount) setColumnCount(periodCount);
  }

  useEffect(() => {
    if (state.status === 'success' && tableWrapperRef.current) {
      setPlaceholderHeight(tableWrapperRef.current.offsetHeight);
    }
  }, [state]);

  const activeLabel = TABS.find((t) => t.id === tab)?.label ?? '';

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-section)', margin: 0 }}>Financial statements</h2>
      </div>

      {/* The three labels need ~400px side by side. Rather than a breakpoint
          that swaps them for short forms, the row scrolls horizontally when
          it doesn't fit — the tabs keep their full names at every width. */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          borderBottom: '1px solid color-mix(in srgb, var(--color-text) 12%, transparent)',
        }}
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                flex: 'none',
                whiteSpace: 'nowrap',
                minHeight: 'var(--tap-min)',
                padding: '11px clamp(11px, 1.8vw, 16px)',
                font: `500 clamp(13px, 1.1vw, 14px) var(--font-body)`,
                cursor: 'pointer',
                background: 'transparent',
                border: 0,
                color: active ? 'var(--color-accent-400)' : 'var(--color-neutral-500)',
                boxShadow: active ? 'inset 0 -2px 0 var(--color-accent)' : 'none',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {state.status === 'loading' && <StatementTableSkeleton columnCount={columnCount} minHeight={placeholderHeight} />}
      {state.status === 'error' && isAuthError(state) && (
        <LockedPreview message={`Sign in to view the ${activeLabel.toLowerCase()} for this company.`}>
          <StatementTableSkeleton columnCount={columnCount} minHeight={placeholderHeight ?? 320} />
        </LockedPreview>
      )}
      {state.status === 'error' && !isAuthError(state) && (
        <StatusBlock tone="error">Couldn't load this statement: {state.message}</StatusBlock>
      )}
      {state.status === 'success' && (!state.data || state.data.length === 0) && (
        <StatusBlock tone="empty">No {activeLabel.toLowerCase()} on file for this company.</StatusBlock>
      )}
      {state.status === 'success' && state.data && state.data.length > 0 && (
        <div ref={tableWrapperRef}>
          {isMobile ? <SingleYearTable lines={state.data} /> : <StatementTable lines={state.data} />}
        </div>
      )}
    </section>
  );
}

function StatementTable({ lines }: { lines: FinancialLine[] }) {
  const { periods, rows } = pivotStatement(lines);
  const unitByLabel = new Map(lines.map((l) => [l.label, l.unit]));

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* minWidth: max-content is what actually engages the scroll wrapper.
          `.table` sets width: 100%, which alone would make the table fit the
          container by crushing every column and wrapping row labels onto
          three lines instead of ever overflowing. */}
      <table className="table" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 'clamp(13.5px, 1.1vw, 15px)', minWidth: 'max-content' }}>
        <thead>
          <tr>
            <th>Figures</th>
            {periods.map((p) => (
              <th key={p} style={{ textAlign: 'right' }}>
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td
                style={{
                  color: row.highlight ? 'var(--color-accent-400)' : 'var(--color-neutral-300)',
                  fontWeight: row.highlight ? 500 : 400,
                }}
              >
                {/* The cap lives on this inner block, not the cell: under
                    table-layout: auto (which the max-content width above
                    depends on) a td's own max-width is only a suggestion the
                    browser overrides to fit content. A block child's
                    max-width does cap the column's intrinsic contribution, so
                    the longest statement labels stop dragging the table wide
                    enough to need horizontal scrolling. Full text stays
                    reachable via the title tooltip. */}
                <span
                  title={row.label}
                  style={{
                    display: 'block',
                    maxWidth: 'clamp(300px, 32vw, 560px)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.label}
                </span>
              </td>
              {row.values.map((v, i) => (
                <td
                  key={i}
                  style={{
                    textAlign: 'right',
                    color: row.highlight ? 'var(--color-accent-400)' : 'var(--color-neutral-400)',
                    fontWeight: row.highlight ? 500 : 400,
                  }}
                >
                  {formatValue(v, unitByLabel.get(row.label) ?? null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Narrow layout: one fiscal year at a time, line item left and value right.
 *  Three year columns across ~380px can't be read even when they do fit —
 *  and with a horizontal scroll they simply sat off-screen, so the section
 *  showed labels and no figures at all. Changing the shape beats shrinking
 *  it: full width, no scroll, no truncation, labels free to wrap. */
function SingleYearTable({ lines }: { lines: FinancialLine[] }) {
  const { periods, rows } = pivotStatement(lines);
  const unitByLabel = new Map(lines.map((l) => [l.label, l.unit]));
  // Most recent first — pivotStatement sorts ascending, and the latest year
  // is the one worth defaulting to.
  const ordered = [...periods].reverse();
  const [year, setYear] = useState<number | null>(null);
  const selected = year !== null && ordered.includes(year) ? year : ordered[0];
  const columnIndex = periods.indexOf(selected);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="seg" style={{ display: 'flex', width: '100%' }} role="group" aria-label="Fiscal year">
        {ordered.map((p) => {
          const active = p === selected;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setYear(p)}
              aria-pressed={active}
              style={{
                flex: 1,
                minHeight: 'var(--tap-min)',
                border: 0,
                cursor: 'pointer',
                font: `500 14px var(--font-body)`,
                fontVariantNumeric: 'tabular-nums',
                background: 'transparent',
                color: active ? 'var(--color-accent-400)' : 'var(--color-neutral-500)',
                boxShadow: active ? 'inset 0 0 0 1px var(--color-accent)' : 'none',
              }}
            >
              {p}
            </button>
          );
        })}
      </div>

      <table className="table" style={{ width: '100%', fontVariantNumeric: 'tabular-nums', fontSize: 14.5, tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ width: '58%' }}>Figures</th>
            <th style={{ textAlign: 'right' }}>{selected}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td
                style={{
                  height: 'var(--tap-min)',
                  overflowWrap: 'break-word',
                  color: row.highlight ? 'var(--color-accent-400)' : 'var(--color-neutral-300)',
                  fontWeight: row.highlight ? 500 : 400,
                }}
              >
                {row.label}
              </td>
              <td
                style={{
                  height: 'var(--tap-min)',
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                  color: row.highlight ? 'var(--color-accent-400)' : 'var(--color-neutral-400)',
                  fontWeight: row.highlight ? 500 : 400,
                }}
              >
                {formatValue(row.values[columnIndex] ?? null, unitByLabel.get(row.label) ?? null)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatementTableSkeleton({ columnCount, minHeight }: { columnCount: number; minHeight: number | null }) {
  const columns = Array.from({ length: columnCount });

  return (
    <div aria-hidden="true" style={{ overflowX: 'auto', minHeight: minHeight ?? undefined }}>
      <table className="table" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr>
            <th>
              <span className="skeleton-bar" style={{ width: 70, height: 10 }} />
            </th>
            {columns.map((_, i) => (
              <th key={i} style={{ textAlign: 'right' }}>
                <span className="skeleton-bar" style={{ width: 44, height: 10, marginLeft: 'auto' }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SKELETON_ROW_LABEL_WIDTHS.map((labelWidth, row) => (
            <tr key={row}>
              <td>
                <span
                  className="skeleton-bar"
                  style={{ width: `${labelWidth}%`, height: 13, animationDelay: `${row * 45}ms` }}
                />
              </td>
              {columns.map((_, col) => (
                <td key={col} style={{ textAlign: 'right' }}>
                  <span
                    className="skeleton-bar"
                    style={{ width: 52, height: 13, marginLeft: 'auto', animationDelay: `${row * 45 + col * 20}ms` }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
