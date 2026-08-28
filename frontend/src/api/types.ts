// Mirrors backend/app/schemas.py and backend/app/models.py — keep in sync by hand.

export interface StockSearchResult {
  ticker: string;
  name: string | null;
  img: string | null;
}

export type PriceRange = '1m' | '6m' | '1y' | '5y' | 'max';

export interface PriceBar {
  date: string; // ISO date (YYYY-MM-DD)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CompanyInfo {
  ticker: string;
  name: string;
  industry: string | null;
  exchanges: (string | null)[];
}

export type FinancialStatementType = 'balance_sheet' | 'income_statement' | 'cash_flows';

export interface FinancialLine {
  financial_id: string | null;
  label: string;
  period: string;
  standard_label: string | null;
  unit: string | null;
  value: number | null;
}

export interface ChatSessionOut {
  id: string;
  stock_id: string;
  created_at: string; // ISO datetime
}

export type ChatRole = 'user' | 'assistant' | 'system';

export interface MessageOut {
  content: string;
  role: ChatRole;
}
