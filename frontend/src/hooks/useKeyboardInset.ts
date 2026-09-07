import { useEffect } from 'react';

/** Publishes the on-screen keyboard's height to `--keyboard-inset` on <html>,
 *  so a fixed-position control can hold its distance above the keyboard the
 *  same way it holds its distance above the screen edge.
 *
 *  A `position: fixed` element is laid out against the *layout* viewport, and
 *  opening a keyboard doesn't shrink that — it shrinks the *visual* viewport.
 *  So the composer stays where it was, behind the keyboard, until the browser
 *  scrolls the page to drag the focused field into view: the lurch. The
 *  difference between the two viewports is exactly what the keyboard covers.
 *
 *  Deliberately a custom property feeding a `bottom` calc rather than a
 *  transform on a wrapper: a transformed ancestor becomes the containing block
 *  for fixed descendants and a new backdrop root, which is precisely what
 *  breaks the full-viewport assistant wash (see .assistant-wash in index.css).
 *
 *  Pairs with `interactive-widget=resizes-content` in index.html. Where that
 *  is honoured the layout viewport shrinks with the keyboard, `innerHeight`
 *  shrinks with it, and this measures ~0 — so the two can't double-count. */
export function useKeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;

    function update() {
      if (!viewport) return;
      // Clamped: rubber-band overscroll can transiently make this negative.
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      root.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`);
    }

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      root.style.removeProperty('--keyboard-inset');
    };
  }, []);
}
