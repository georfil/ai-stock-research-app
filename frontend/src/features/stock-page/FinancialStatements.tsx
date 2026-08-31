import { useEffect, useRef, useState } from 'react';
import { useFinancialStatement, pivotStatement } from './hooks/useFinancialStatement';
import { StatusBlock } from '../../ui/StatusBlock';
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

function formatPeriod(period: string): string {
  // Periods look like "2025-09-27 (FY)" or plain "2025-09-27" — keep the
  // year (and any FY/Q suffix) rather than the full date, it's what reads
  // as a column header.
  const [datePart, ...rest] = period.split(' ');
  const year = datePart.split('-')[0];
  return [year, ...rest].join(' ');
}

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
        <h2 style={{ fontSize: 21, margin: 0 }}>Financial statements</h2>
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid color-mix(in srgb, var(--color-text) 12%, transparent)' }}>
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 16px',
                font: `500 14.5px var(--font-body)`,
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
      {state.status === 'error' && <StatusBlock tone="error">Couldn't load this statement: {state.message}</StatusBlock>}
      {state.status === 'success' && (!state.data || state.data.length === 0) && (
        <StatusBlock tone="empty">No {activeLabel.toLowerCase()} on file for this company.</StatusBlock>
      )}
      {state.status === 'success' && state.data && state.data.length > 0 && (
        <div ref={tableWrapperRef}>
          <StatementTable lines={state.data} />
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
      <table className="table" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 15 }}>
        <thead>
          <tr>
            <th>Line item</th>
            {periods.map((p) => (
              <th key={p} style={{ textAlign: 'right' }}>
                {formatPeriod(p)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td style={{ color: 'var(--color-neutral-300)' }}>{row.label}</td>
              {row.values.map((v, i) => (
                <td key={i} style={{ textAlign: 'right', color: 'var(--color-neutral-400)' }}>
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
