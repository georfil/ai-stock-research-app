interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color: string;
}

/** A minimal inline trend line — one stroke, no axes, no gridlines, no dots. */
export function Sparkline({ values, width = 72, height = 24, color }: SparklineProps) {
  if (values.length < 2) return <svg width={width} height={height} aria-hidden="true" />;

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
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
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
