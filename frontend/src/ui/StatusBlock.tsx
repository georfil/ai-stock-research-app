import type { ReactNode } from 'react';

interface StatusBlockProps {
  tone: 'loading' | 'error' | 'empty';
  children: ReactNode;
}

/** A quiet inline status line for a section's loading/error/empty state — never a spinner or a shimmer. */
export function StatusBlock({ tone, children }: StatusBlockProps) {
  const color = tone === 'error' ? 'var(--down)' : 'var(--color-neutral-500)';
  return (
    <div style={{ padding: '13px 14px', fontSize: 13.5, color }} role={tone === 'error' ? 'alert' : undefined}>
      {children}
    </div>
  );
}
