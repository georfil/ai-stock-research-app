import { apiFetch } from './client';
import type {
  CompanyInfo,
  FinancialLine,
  FinancialStatementType,
  NewsArticle,
  PriceBar,
  PriceRange,
  StockSearchResult,
} from './types';

export function searchStocks(query: string): Promise<{ results: StockSearchResult[] }> {
  return apiFetch(`/stocks?query=${encodeURIComponent(query)}`);
}

export function getPriceHistory(ticker: string, range: PriceRange): Promise<PriceBar[]> {
  return apiFetch(`/stocks/${encodeURIComponent(ticker)}/prices?range=${range}`);
}

export function getOverview(ticker: string): Promise<CompanyInfo> {
  return apiFetch(`/stocks/${encodeURIComponent(ticker)}/overview`);
}

export function getFinancialStatement(
  ticker: string,
  statement: FinancialStatementType,
): Promise<FinancialLine[] | null> {
  return apiFetch(`/stocks/${encodeURIComponent(ticker)}/statements/${statement}`, { auth: true });
}

export function getBusinessSummary(ticker: string): Promise<{ summary: string }> {
  return apiFetch(`/stocks/${encodeURIComponent(ticker)}/summary`, { auth: true });
}

export function getNews(ticker: string): Promise<NewsArticle[]> {
  return apiFetch(`/stocks/${encodeURIComponent(ticker)}/news`);
}
