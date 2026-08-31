import { Sparkle, User } from '@phosphor-icons/react';
import type { ChatRole } from '../../../api/types';

export interface DemoMessage {
  role: ChatRole;
  content: string;
}

/** The two voices are structurally different, not just differently coloured:
 * the question is an object placed on the surface; the answer is prose with
 * no background of its own — one is a card, one is a page. */
export function AssistantMessage({ message }: { message: DemoMessage }) {
  if (message.role === 'user') {
    return (
      <div
        style={{
          display: 'inline-block',
          maxWidth: '100%',
          padding: '16px 20px',
          borderRadius: 'var(--radius-lg)',
          background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
          boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 28%, transparent)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-accent-400)',
            marginBottom: 8,
          }}
        >
          <User size={12} weight="bold" />
          You
        </div>
        <div style={{ fontSize: 16.5, fontWeight: 500, lineHeight: 1.5, color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingLeft: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-neutral-500)',
          marginBottom: 8,
        }}
      >
        <Sparkle size={12} weight="fill" />
        Assistant
      </div>
      <div style={{ fontSize: 15.5, lineHeight: 1.72, color: 'var(--color-neutral-200)', whiteSpace: 'pre-wrap' }}>
        {message.content}
      </div>
    </div>
  );
}
