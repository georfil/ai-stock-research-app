interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color: string;
}

/** A minimal inline trend line — one stroke, no axes, no gridlines, no dots.
 *  `width` is the coordinate space, not a rendered size: the SVG fills its
 *  container and stretches horizontally, so it shrinks with the row rather
 *  than forcing a fixed 120px column. The stroke stays 1.4px regardless
 *  (non-scaling-stroke), so the squeeze never thickens the line. */
export function Sparkline({ values, width = 72, height = 24, color }: SparklineProps) {
  if (values.length < 2) return <svg style={{ display: 'block', width: '100%', height }} aria-hidden="true" />;

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pad = 2;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = pad + (1 - (v - lo) / span) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ display: 'block', width: '100%', height }}
      aria-hidden="true"
    >
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
