import { useEffect, useRef, useState } from 'react';
import { searchStocks } from '../api/stocks';
import type { StockSearchResult } from '../api/types';

const DEBOUNCE_MS = 200;

export function useTickerSearch(query: string) {
  const trimmed = query.trim();
  const [state, setState] = useState<{ forQuery: string; results: StockSearchResult[] }>({
    forQuery: '',
    results: [],
  });

  // Clearing the query resolves synchronously (no request needed) — adjust
  // state during render rather than via an effect.
  if (trimmed === '' && state.forQuery !== '') {
    setState({ forQuery: '', results: [] });
  }

  const requestId = useRef(0);

  useEffect(() => {
    if (!trimmed) return;

    const id = ++requestId.current;
    const timer = setTimeout(() => {
      searchStocks(trimmed)
        .then((res) => {
          if (requestId.current === id) setState({ forQuery: trimmed, results: res.results });
        })
        .catch(() => {
          if (requestId.current === id) setState({ forQuery: trimmed, results: [] });
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed]);

  return {
    results: trimmed ? state.results : [],
    isSearching: trimmed !== '' && trimmed !== state.forQuery,
  };
}
