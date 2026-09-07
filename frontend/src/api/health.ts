import { apiUrl } from './client';

/** Pings the backend's liveness probe, resolving true only if it answered.
 *
 *  Deliberately not routed through apiFetch: this call needs an abort signal
 *  (a cold start can legitimately take a minute, and nothing else in the app
 *  waits that long), and a failure here is an expected, routine condition to
 *  be reported as a boolean rather than thrown as an ApiError. */
export async function pingBackend(signal: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(apiUrl('/health'), { signal });
    return response.ok;
  } catch {
    // Network error, CORS failure, or our own abort — from the caller's point
    // of view these are the same thing: no answer.
    return false;
  }
}
