import type { ReactNode } from 'react';
import { useIsMobile } from '../../../hooks/useMediaQuery';

/** The only raised surface in the assistant overlay — a translucent pill
 * with a hairline lit slightly brighter on top, as if lit from above.
 * Shared by the collapsed trigger and the real composer so both read as
 * the same object. No leading icon on desktop — its 16px left padding is the
 * same text inset the message thread uses, so the composer's text sits on the
 * same baseline as everything above it.
 *
 * On mobile it's a single centred row at a fixed height instead: the desktop
 * proportions, stretched to the full width, left a tall box with a large
 * empty interior. Here the height is set, the content is vertically centred,
 * and the padding is asymmetric (14 left / 8 right) so the send button sits
 * flush right while the text keeps a comfortable inset. */
export function ComposerPill({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();

  return (
    <div
      className="composer-pill"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: isMobile ? 'center' : 'flex-end',
        gap: isMobile ? 10 : 12,
        padding: isMobile ? '0 8px 0 14px' : '13px 16px',
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
