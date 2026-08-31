import { useState } from 'react';

interface CompanyLogoProps {
  src: string | null;
  alt: string;
  size?: number;
}

/** Renders nothing if there's no URL, or if the image fails to load — a
 * missing logo should never show a broken-image icon. */
export function CompanyLogo({ src, alt, size = 40 }: CompanyLogoProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{
        width: size,
        height: size,
        flex: 'none',
        borderRadius: 'var(--radius-sm)',
        objectFit: 'contain',
        background: 'var(--color-surface)',
        boxShadow: '0 0 0 1px var(--color-divider)',
      }}
    />
  );
}
