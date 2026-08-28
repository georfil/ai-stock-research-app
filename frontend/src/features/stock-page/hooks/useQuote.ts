import type { AsyncState } from '../../../hooks/useAsyncData';
import { usePriceHistory } from './usePriceHistory';

export interface Quote {
  price: number;
  change: number;
  changePercent: number;
  asOfDate: string;
}

/**
 * Derives a "quote" from the last two bars of recent daily price history —
 * there is no dedicated quote endpoint (no live price, market cap, or
 * volume), so this only ever reflects the latest two closes on record.
 */
export function useQuote(ticker: string): AsyncState<Quote> {
  const history = usePriceHistory(ticker, '1m');

  if (history.status !== 'success') return history;

  const bars = history.data;
  if (bars.length === 0) return { status: 'error', message: 'No price data available.' };

  const latest = bars[bars.length - 1];
  const previous = bars.length > 1 ? bars[bars.length - 2] : null;
  const change = previous ? latest.close - previous.close : 0;
  const changePercent = previous ? (change / previous.close) * 100 : 0;

  return {
    status: 'success',
    data: { price: latest.close, change, changePercent, asOfDate: latest.date },
  };
}
