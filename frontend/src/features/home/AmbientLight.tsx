// A single light source, centred behind and slightly above the search
// field — the layout itself is centred now, so the light is symmetric too
// (no directional falloff needed). Long, soft falloff spanning most of the
// viewport with no perceptible edge, dithered with a masked noise layer so
// it doesn't band. A very slight vignette keeps the outer edges of the
// ground from reading as one flat sheet. No blur filters, no bloom, low
// chroma only.

const NOISE_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

const GLOW_SHAPE = 'ellipse 50% 55% at 50% 22%';

interface AmbientLightProps {
  /** Strengthens the glow a little — meant to track the search field's focus state. */
  boosted?: boolean;
}

export function AmbientLight({ boosted = false }: AmbientLightProps) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 75% 72% at 50% 38%, transparent 52%, color-mix(in srgb, var(--color-bg) 42%, transparent) 100%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '2%',
          width: 'min(1400px, 88vw)',
          height: '68vh',
          transform: 'translateX(-50%)',
          opacity: boosted ? 1 : 0.82,
          transition: 'opacity 320ms ease',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(${GLOW_SHAPE}, color-mix(in srgb, var(--color-accent) 17%, transparent), transparent 76%)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url("${NOISE_SVG}")`,
            backgroundSize: '160px 160px',
            opacity: 0.05,
            // Fades out together with the glow instead of sitting as a flat
            // rectangle — a mask, not an independent shape, is what keeps
            // the edge from reading as a hard cutoff.
            WebkitMaskImage: `radial-gradient(${GLOW_SHAPE}, black, transparent 76%)`,
            maskImage: `radial-gradient(${GLOW_SHAPE}, black, transparent 76%)`,
          }}
        />
      </div>
    </div>
  );
}
