// Mirrors backend/app/schemas.py and backend/app/models.py — keep in sync by hand.

export interface StockSearchResult {
  ticker: string;
  name: string | null;
  img: string | null;
}

export type PriceRange = '1m' | '6m' | '1y' | '5y' | 'max';

export interface PriceBar {
  date: string; // ISO date (YYYY-MM-DD)
  // yfinance/pandas can leave any OHLC field NaN for a gappy or partial bar,
  // which FastAPI serializes as JSON null — these are genuinely nullable.
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number;
}

export interface CompanyInfo {
  ticker: string;
  name: string;
  industry: string | null;
  exchanges: (string | null)[];
  img: string | null;
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
  title: string | null;
  last_message_at: string; // ISO datetime
  message_count: number;
}

export type ChatRole = 'user' | 'assistant' | 'system';

export interface MessageOut {
  content: string;
  role: ChatRole;
}

export interface UserOut {
  username: string;
}

export interface WatchlistStock {
  id: string;
  ticker: string;
  name: string;
}
