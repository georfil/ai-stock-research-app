import { useMemo } from 'react';
import { getWatchlist } from '../../../api/users';
import type { WatchlistStock } from '../../../api/types';
import { useAsyncData } from '../../../hooks/useAsyncData';

export function useWatchlist(enabled: boolean) {
  const fetcher = useMemo(() => () => (enabled ? getWatchlist() : Promise.resolve<WatchlistStock[]>([])), [enabled]);
  return useAsyncData<WatchlistStock[]>(fetcher, [enabled]);
}
