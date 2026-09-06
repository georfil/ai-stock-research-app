import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string; statusCode?: number }
  | { status: 'success'; data: T };

/** True when a failed fetch was rejected for lack of (or invalid) auth — the
 * one error case UI wants to render as a sign-in prompt rather than a plain
 * error message. Checks the actual HTTP status rather than matching on
 * message text, which is backend wording that could change. */
export function isAuthError(state: AsyncState<unknown>): boolean {
  return state.status === 'error' && (state.statusCode === 401 || state.statusCode === 403);
}

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
          const statusCode = error instanceof ApiError ? error.status : undefined;
          setState({ key, result: { status: 'error', message, statusCode } });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state.key === key ? state.result : { status: 'loading' };
}
