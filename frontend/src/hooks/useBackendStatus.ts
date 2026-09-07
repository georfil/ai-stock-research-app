import { useEffect, useState } from 'react';
import { pingBackend } from '../api/health';

export type BackendStatus = 'checking' | 'ready' | 'waking' | 'unreachable';

// A warm instance answers /health in well under a second. A spun-down one
// gives no distinct response to look for — the platform holds the connection
// open while the container boots — so elapsed silence is the only signal a
// cold start produces, and this is the point past which we call it one.
const WAKING_AFTER_MS = 2_000;

// Generous, because a cold start on a free instance really can run near a
// minute. Past this we stop believing it's coming.
const GIVE_UP_AFTER_MS = 90_000;

/** Reports whether the backend is awake, by timing a single /health ping.
 *
 *  Runs once, as early as the app mounts, because the ping is not only a
 *  status check — it is also what *wakes* the instance. Left until the user
 *  asks for data, they would pay the whole cold start at the moment they were
 *  trying to do something; fired on mount, the boot overlaps with them
 *  reading the first screen.
 *
 *  Note 'waking' and 'unreachable' are not distinguishable up front: a booting
 *  server and a dead one both answer with silence. The difference only emerges
 *  when one of them eventually replies. */
export function useBackendStatus(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>('checking');

  useEffect(() => {
    const controller = new AbortController();
    // Guards against StrictMode's double-invoke in development: the first
    // cleanup aborts the first ping, which would otherwise resolve false and
    // report a perfectly healthy backend as unreachable.
    let cancelled = false;

    const slowTimer = setTimeout(() => {
      if (!cancelled) setStatus((current) => (current === 'checking' ? 'waking' : current));
    }, WAKING_AFTER_MS);

    const giveUpTimer = setTimeout(() => controller.abort(), GIVE_UP_AFTER_MS);

    void pingBackend(controller.signal).then((ok) => {
      if (cancelled) return;
      clearTimeout(slowTimer);
      clearTimeout(giveUpTimer);
      setStatus(ok ? 'ready' : 'unreachable');
    });

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
      clearTimeout(giveUpTimer);
      controller.abort();
    };
  }, []);

  return status;
}
