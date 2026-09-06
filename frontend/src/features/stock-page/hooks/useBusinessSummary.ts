import { useMemo } from 'react';
import { getBusinessSummary } from '../../../api/stocks';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useAuth } from '../../../hooks/useAuth';

export function useBusinessSummary(ticker: string) {
  // auth.status in the deps so logging in/out re-triggers the fetch — this
  // endpoint requires auth, so the "not authenticated" result from before
  // login would otherwise never be replaced.
  const auth = useAuth();
  const fetcher = useMemo(() => () => getBusinessSummary(ticker), [ticker]);
  return useAsyncData<{ summary: string }>(fetcher, [ticker, auth.status]);
}
