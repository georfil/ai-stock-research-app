import type { ReactNode } from 'react';

/** The only raised surface in the assistant overlay — a translucent pill
 * with a hairline lit slightly brighter on top, as if lit from above.
 * Shared by the collapsed trigger and the real composer so both read as
 * the same object. */
export function ComposerPill({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 10,
        padding: '11px 14px 11px 18px',
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
