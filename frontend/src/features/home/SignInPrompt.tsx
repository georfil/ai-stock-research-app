import { ElevatedSurface } from '../../ui/ElevatedSurface';

/** Occupies the same shape the watchlist would, so nothing shifts on login. */
export function SignInPrompt() {
  return (
    <ElevatedSurface style={{ padding: '20px 22px', fontSize: 14.5, color: 'var(--color-neutral-400)' }}>
      Sign in to keep a watchlist here.
    </ElevatedSurface>
  );
}
