import type { AsyncState } from '../../../hooks/useAsyncData';
import type { PriceBar } from '../../../api/types';
import { usePriceHistory } from './usePriceHistory';

export interface Quote {
  price: number;
  change: number;
  changePercent: number;
  asOfDate: string;
}

function hasClose(bar: PriceBar): bar is PriceBar & { close: number } {
  return typeof bar.close === 'number' && Number.isFinite(bar.close);
}

/**
 * Derives a "quote" from the last two bars of recent daily price history —
 * there is no dedicated quote endpoint (no live price, market cap, or
 * volume), so this only ever reflects the latest two closes on record.
 */
export function useQuote(ticker: string): AsyncState<Quote> {
  const history = usePriceHistory(ticker, '1m');

  if (history.status !== 'success') return history;

  // A gappy or partial bar can have a null/NaN close (yfinance data quirk) —
  // skip those rather than deriving a quote from missing data.
  const bars = history.data.filter(hasClose);
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
