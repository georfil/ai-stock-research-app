import { StatusBlock } from '../../ui/StatusBlock';

export function NewsSection() {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-neutral-600)', margin: 0 }}>
        Recent news
      </h2>
      <StatusBlock tone="empty">No news source connected yet.</StatusBlock>
    </section>
  );
}
