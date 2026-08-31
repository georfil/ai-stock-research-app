import { useEffect, useState } from 'react';
import { addToWatchlist, getWatchlist, removeFromWatchlist } from '../api/users';

type MembershipState = 'loading' | 'in' | 'out';

/** Tracks and toggles whether `ticker` is on the current user's watchlist. */
export function useWatchlistToggle(ticker: string, enabled: boolean) {
  const key = `${ticker}:${enabled}`;
  const [state, setState] = useState<{ key: string; membership: MembershipState }>(() => ({
    key,
    membership: enabled ? 'loading' : 'out',
  }));

  // Reset when ticker/enabled change, before the effect below runs — adjusting
  // state during render rather than calling setState synchronously in the effect.
  if (state.key !== key) {
    setState({ key, membership: enabled ? 'loading' : 'out' });
  }

  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getWatchlist()
      .then((list) => {
        if (!cancelled) setState({ key, membership: list.some((s) => s.ticker === ticker) ? 'in' : 'out' });
      })
      .catch(() => {
        if (!cancelled) setState({ key, membership: 'out' });
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, enabled, key]);

  const membership = state.key === key ? state.membership : enabled ? 'loading' : 'out';

  async function toggle() {
    if (membership === 'loading' || isToggling) return;
    setIsToggling(true);
    try {
      if (membership === 'in') {
        await removeFromWatchlist(ticker);
        setState({ key, membership: 'out' });
      } else {
        await addToWatchlist(ticker);
        setState({ key, membership: 'in' });
      }
    } finally {
      setIsToggling(false);
    }
  }

  return { membership, toggle, isToggling };
}
