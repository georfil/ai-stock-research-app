import { useMemo } from 'react';
import { getBusinessSummary } from '../../../api/stocks';
import { useAsyncData } from '../../../hooks/useAsyncData';

export function useBusinessSummary(ticker: string) {
  const fetcher = useMemo(() => () => getBusinessSummary(ticker), [ticker]);
  return useAsyncData<{ summary: string }>(fetcher, [ticker]);
}
