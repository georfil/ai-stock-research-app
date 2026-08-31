import { useEffect, useState } from 'react';
import { getPriceHistory } from '../../../api/stocks';

export interface WatchlistQuote {
  prices: number[];
  price: number;
  change: number;
  changePercent: number;
}

type QuoteEntry = WatchlistQuote | null; // null = load failed / no data, not yet loaded = absent key

/** Fetches recent price history per ticker to derive a last price, day change, and sparkline. */
export function useWatchlistQuotes(tickers: string[]): Record<string, QuoteEntry> {
  const [quotes, setQuotes] = useState<Record<string, QuoteEntry>>({});
  const key = tickers.join(',');

  useEffect(() => {
    let cancelled = false;
    tickers.forEach((ticker) => {
      getPriceHistory(ticker, '1m')
        .then((bars) => {
          if (cancelled) return;
          // A gappy or partial bar can have a null/NaN close (yfinance data
          // quirk) — skip those rather than deriving a quote/sparkline from
          // missing data.
          const closes = bars
            .map((b) => b.close)
            .filter((c): c is number => typeof c === 'number' && Number.isFinite(c));
          if (closes.length === 0) {
            setQuotes((q) => ({ ...q, [ticker]: null }));
            return;
          }
          const last = closes[closes.length - 1];
          const previous = closes.length > 1 ? closes[closes.length - 2] : last;
          setQuotes((q) => ({
            ...q,
            [ticker]: {
              prices: closes,
              price: last,
              change: last - previous,
              changePercent: previous ? ((last - previous) / previous) * 100 : 0,
            },
          }));
        })
        .catch(() => {
          if (!cancelled) setQuotes((q) => ({ ...q, [ticker]: null }));
        });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return quotes;
}
