import { useEffect, useRef, useState } from 'react';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

function depsKey(deps: unknown[]): string {
  return JSON.stringify(deps);
}

/**
 * Runs `fetcher` whenever `deps` change, tracking loading/error/success state.
 * A request whose deps have since changed is ignored when it resolves, so a
 * slow stale response can't clobber a newer one.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const key = depsKey(deps);
  const [state, setState] = useState<{ key: string; result: AsyncState<T> }>({
    key,
    result: { status: 'loading' },
  });

  // Reset to loading as soon as deps change, before the effect below runs —
  // this is React's sanctioned "adjust state during render" pattern, not a
  // setState call inside the effect itself.
  if (state.key !== key) {
    setState({ key, result: { status: 'loading' } });
  }

  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;

    fetcher()
      .then((data) => {
        if (requestId.current === id) setState({ key, result: { status: 'success', data } });
      })
      .catch((error: unknown) => {
        if (requestId.current === id) {
          const message = error instanceof Error ? error.message : 'Something went wrong.';
          setState({ key, result: { status: 'error', message } });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state.key === key ? state.result : { status: 'loading' };
}
