import { useMemo } from 'react';
import { getNews } from '../../../api/stocks';
import type { NewsArticle } from '../../../api/types';
import { useAsyncData } from '../../../hooks/useAsyncData';

export function useNews(ticker: string) {
  const fetcher = useMemo(() => () => getNews(ticker), [ticker]);
  return useAsyncData<NewsArticle[]>(fetcher, [ticker]);
}
