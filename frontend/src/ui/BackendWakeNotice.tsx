import { useState } from 'react';
import { ElevatedSurface } from './ElevatedSurface';
import { useBackendStatus } from '../hooks/useBackendStatus';

/** Explains the cold start rather than letting the app look broken.
 *
 *  The server sleeps when nobody has used it for a while, and the first
 *  request back wakes it — which takes long enough that, unexplained, it reads
 *  as a hang. This says so in plain language.
 *
 *  Deliberately not a modal: no focus trap and no click-eating backdrop. The
 *  page behind it is genuinely inert while the backend boots, but trapping
 *  someone in a dialog they can't act on adds nothing, and a wrongly-shown
 *  overlay (a slow network on a warm server) would then be a cage. */
export function BackendWakeNotice() {
  const status = useBackendStatus();
  const [dismissed, setDismissed] = useState(false);

  // 'checking' stays silent on purpose: a warm server resolves inside the
  // threshold, so nothing flashes on the common path.
  if (dismissed || status === 'checking' || status === 'ready') return null;

  const waking = status === 'waking';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'clamp(20px, 4vh, 40px)',
        transform: 'translateX(-50%)',
        zIndex: 200,
        width: 'min(420px, calc(100vw - 32px))',
      }}
    >
      <ElevatedSurface style={{ padding: '16px 18px', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {waking && (
            <span
              aria-hidden="true"
              className="wake-pulse"
              style={{
                flex: 'none',
                width: 9,
                height: 9,
                marginTop: 6,
                borderRadius: '50%',
                background: 'var(--color-accent)',
              }}
            />
          )}

          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ font: '500 14.5px var(--font-body)' }}>
              {waking ? 'Waking the server up' : "Can't reach the server"}
            </span>
            <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--color-neutral-400)' }}>
              {waking
                ? 'It goes to sleep when it has been quiet for a while, and takes up to a minute to start back up. Everything will load normally once it does — no need to refresh.'
                : 'It did not respond. It may still be starting, or it may be down — refreshing in a moment is worth a try.'}
            </span>
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            style={{
              flex: 'none',
              marginLeft: 'auto',
              width: 26,
              height: 26,
              display: 'grid',
              placeItems: 'center',
              padding: 0,
              borderRadius: 6,
              color: 'var(--color-neutral-500)',
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </ElevatedSurface>
    </div>
  );
}
