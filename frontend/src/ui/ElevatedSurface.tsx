import type { CSSProperties, ReactNode } from 'react';

interface ElevatedSurfaceProps {
  children: ReactNode;
  style?: CSSProperties;
}

/** The shared "one step up from the page, lit from above" surface: `--color-surface` with a brighter top edge. */
export function ElevatedSurface({ children, style }: ElevatedSurfaceProps) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        borderStyle: 'solid',
        borderWidth: 1,
        borderTopColor: 'color-mix(in srgb, var(--color-text) 24%, transparent)',
        borderRightColor: 'var(--color-divider)',
        borderBottomColor: 'var(--color-divider)',
        borderLeftColor: 'var(--color-divider)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
