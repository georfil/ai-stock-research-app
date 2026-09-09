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
  exchange: string | null;
  img: string | null;
  suggested_questions: string[];
  day_low: number;
  day_high: number;
  year_low: number | null;
  year_high: number | null;
  market_cap: number;
  shares: number;
  price: number;
  change: number;
  change_percent: number;
  beta: number | null;
}

export interface NewsArticle {
  title: string;
  link: string | null;
  img: string | null;
  summary: string | null;
  date: string; // ISO datetime
}

export type FinancialStatementType = 'balance_sheet' | 'income_statement' | 'cash_flows';

export interface FinancialLine {
  period: number;
  label: string;
  value: number | null;
  unit: string | null;
  highlight: boolean;
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
