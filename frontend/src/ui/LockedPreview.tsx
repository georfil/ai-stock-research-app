import { useState } from 'react';
import type { ReactNode } from 'react';
import { LockSimple } from '@phosphor-icons/react';
import { AuthDialog } from '../components/AuthDialog';

interface LockedPreviewProps {
  /** What the sign-in prompt says this section is for, e.g. "Sign in to view financial statements." */
  message: string;
  /** Demo/placeholder content shown blurred behind the prompt — never real data. */
  children: ReactNode;
}

/** A gated section's locked state: blurred demo content with a lock icon and
 * sign-in prompt on top, rather than a bare error message or an empty box. */
export function LockedPreview({ message, children }: LockedPreviewProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' }} aria-hidden="true">
        {children}
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: 'clamp(14px, 3vw, 24px)',
          textAlign: 'center',
          background: 'color-mix(in srgb, var(--color-bg) 40%, transparent)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <LockSimple size={26} weight="fill" style={{ color: 'var(--color-accent-400)' }} />
        <div style={{ fontSize: 14.5, color: 'var(--color-neutral-200)', maxWidth: 'min(300px, 100%)' }}>{message}</div>
        <button type="button" className="btn btn-primary" onClick={() => setDialogOpen(true)}>
          Log in
        </button>
      </div>

      {dialogOpen && <AuthDialog onClose={() => setDialogOpen(false)} />}
    </div>
  );
}
