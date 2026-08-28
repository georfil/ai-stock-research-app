import { useMemo } from 'react';
import { getPriceHistory } from '../../../api/stocks';
import type { PriceBar, PriceRange } from '../../../api/types';
import { useAsyncData } from '../../../hooks/useAsyncData';

export function usePriceHistory(ticker: string, range: PriceRange) {
  const fetcher = useMemo(() => () => getPriceHistory(ticker, range), [ticker, range]);
  return useAsyncData<PriceBar[]>(fetcher, [ticker, range]);
}
