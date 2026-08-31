import type { ReactNode } from 'react';

/** The only raised surface in the assistant overlay — a translucent pill
 * with a hairline lit slightly brighter on top, as if lit from above.
 * Shared by the collapsed trigger and the real composer so both read as
 * the same object. No leading icon — its 16px left padding is the same
 * text inset the message thread uses, so the composer's text sits on the
 * same baseline as everything above it. */
export function ComposerPill({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 12,
        padding: '13px 16px',
        borderRadius: 'var(--radius-lg)',
        background: 'color-mix(in srgb, var(--color-surface) 82%, transparent)',
        borderStyle: 'solid',
        borderWidth: 1,
        borderTopColor: 'color-mix(in srgb, var(--color-text) 24%, transparent)',
        borderRightColor: 'var(--color-divider)',
        borderBottomColor: 'var(--color-divider)',
        borderLeftColor: 'var(--color-divider)',
      }}
    >
      {children}
    </div>
  );
}
