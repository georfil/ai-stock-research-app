import { useMemo, useRef } from 'react';
import { getFinancialStatement } from '../../../api/stocks';
import type { FinancialLine, FinancialStatementType } from '../../../api/types';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useAuth } from '../../../hooks/useAuth';

export function useFinancialStatement(ticker: string, statement: FinancialStatementType) {
  // This endpoint requires auth, so the key (both the cache's and
  // useAsyncData's) includes auth.status: it forces a refetch on login so
  // the pre-login "not authenticated" result gets replaced, and it keeps a
  // post-login cache hit from leaking through after a later logout (the
  // token would be gone, but a stale cached success would still show).
  const auth = useAuth();
  const cache = useRef(new Map<string, FinancialLine[] | null>());
  const key = `${ticker}:${statement}:${auth.status}`;

  const fetcher = useMemo(
    () => async () => {
      if (cache.current.has(key)) return cache.current.get(key)!;
      const data = await getFinancialStatement(ticker, statement);
      cache.current.set(key, data);
      return data;
    },
    [ticker, statement, key],
  );

  return useAsyncData<FinancialLine[] | null>(fetcher, [ticker, statement, auth.status]);
}

export interface PivotedRow {
  label: string;
  values: (number | null)[];
  highlight: boolean;
}

export interface PivotedStatement {
  periods: number[];
  rows: PivotedRow[];
}

/** Turns the long-format label×period rows the backend returns into a label×period table. */
export function pivotStatement(lines: FinancialLine[]): PivotedStatement {
  const periods: number[] = [];
  for (const line of lines) {
    if (!periods.includes(line.period)) periods.push(line.period);
  }
  periods.sort((a, b) => a - b); // periods are years, so ascending numeric order is chronological

  const labelOrder: string[] = [];
  const byLabel = new Map<string, Map<number, number | null>>();
  const highlightByLabel = new Map<string, boolean>();
  for (const line of lines) {
    if (!byLabel.has(line.label)) {
      byLabel.set(line.label, new Map());
      labelOrder.push(line.label);
    }
    byLabel.get(line.label)!.set(line.period, line.value);
    highlightByLabel.set(line.label, line.highlight);
  }

  const rows = labelOrder.map((label) => ({
    label,
    values: periods.map((p) => byLabel.get(label)!.get(p) ?? null),
    highlight: highlightByLabel.get(label) ?? false,
  }));

  return { periods, rows };
}
