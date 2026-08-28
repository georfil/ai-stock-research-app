import { useMemo } from 'react';
import { getOverview } from '../../../api/stocks';
import type { CompanyInfo } from '../../../api/types';
import { useAsyncData } from '../../../hooks/useAsyncData';

export function useOverview(ticker: string) {
  const fetcher = useMemo(() => () => getOverview(ticker), [ticker]);
  return useAsyncData<CompanyInfo>(fetcher, [ticker]);
}
