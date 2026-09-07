import type { ReactNode } from 'react';
import { useIsMobile } from '../../../hooks/useMediaQuery';

/** The only raised surface in the assistant overlay — a translucent pill
 * with a hairline lit slightly brighter on top, as if lit from above.
 * Shared by the collapsed trigger and the real composer so both read as
 * the same object. No leading icon on desktop — its 16px left padding is the
 * same text inset the message thread uses, so the composer's text sits on the
 * same baseline as everything above it.
 *
 * On mobile it starts at a fixed 54px (--composer-pill-height) — a resting
 * height, not a fixed one: the composer inside grows line by line and the pill
 * grows with it. Children align to the bottom, as they do on desktop, so the
 * send button stays beside the last line rather than floating in the middle of
 * a tall pill. The padding is asymmetric (14 left / 8 right) so the button sits
 * flush right while the text keeps a comfortable inset. */
export function ComposerPill({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();

  return (
    <div
      className="composer-pill"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-end',
        gap: isMobile ? 10 : 12,
        padding: isMobile ? '8px 8px 8px 14px' : '13px 16px',
        minHeight: isMobile ? 54 : undefined,
        borderRadius: 'var(--radius-lg)',
        background: isMobile
          ? 'color-mix(in srgb, var(--color-surface) 72%, transparent)'
          : 'color-mix(in srgb, var(--color-surface) 95%, transparent)',
        // Lets the page show through faintly rather than being cut off by an
        // opaque slab, and separates the control from content scrolling under it.
        backdropFilter: isMobile ? 'blur(18px) saturate(140%)' : undefined,
        WebkitBackdropFilter: isMobile ? 'blur(18px) saturate(140%)' : undefined,
        boxShadow: isMobile ? 'var(--shadow-md)' : undefined,
      }}
    >
      {children}
    </div>
  );
}
