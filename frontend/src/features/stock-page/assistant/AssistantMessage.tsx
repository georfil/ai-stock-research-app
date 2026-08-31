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
          padding: '18px 20px 18px 16px',
          borderRadius: 'var(--radius-lg)',
          background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
          boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 28%, transparent)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 11.5,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-accent-400)',
            marginBottom: 9,
          }}
        >
          <User size={13} weight="bold" />
          You
        </div>
        <div style={{ fontSize: 18.5, fontWeight: 500, lineHeight: 1.6, color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingLeft: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          fontSize: 11.5,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-neutral-500)',
          marginBottom: 9,
        }}
      >
        <Sparkle size={13} weight="fill" />
        Assistant
      </div>
      <div style={{ fontSize: 18, lineHeight: 1.7, color: 'var(--color-neutral-200)', whiteSpace: 'pre-wrap' }}>
        {message.content}
      </div>
    </div>
  );
}
