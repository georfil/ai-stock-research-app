import { useMemo } from 'react';
import { getFinancialStatement } from '../../../api/stocks';
import type { FinancialLine, FinancialStatementType } from '../../../api/types';
import { useAsyncData } from '../../../hooks/useAsyncData';

export function useFinancialStatement(ticker: string, statement: FinancialStatementType) {
  const fetcher = useMemo(() => () => getFinancialStatement(ticker, statement), [ticker, statement]);
  return useAsyncData<FinancialLine[] | null>(fetcher, [ticker, statement]);
}

export interface PivotedRow {
  label: string;
  values: (number | null)[];
}

export interface PivotedStatement {
  periods: string[];
  rows: PivotedRow[];
}

/** Turns the long-format label×period rows the backend returns into a label×period table. */
export function pivotStatement(lines: FinancialLine[]): PivotedStatement {
  const periods: string[] = [];
  for (const line of lines) {
    if (!periods.includes(line.period)) periods.push(line.period);
  }
  periods.sort(); // period strings lead with an ISO date, so lexical order is chronological

  const labelOrder: string[] = [];
  const byLabel = new Map<string, Map<string, number | null>>();
  for (const line of lines) {
    if (!byLabel.has(line.label)) {
      byLabel.set(line.label, new Map());
      labelOrder.push(line.label);
    }
    byLabel.get(line.label)!.set(line.period, line.value);
  }

  const rows = labelOrder.map((label) => ({
    label,
    values: periods.map((p) => byLabel.get(label)!.get(p) ?? null),
  }));

  return { periods, rows };
}
