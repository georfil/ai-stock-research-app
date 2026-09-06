import { X } from '@phosphor-icons/react';
import type { Notification } from '../hooks/useNotifications';

interface NotificationStackProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  className?: string;
}

const TONE_COLOR: Record<Notification['tone'], string> = {
  warning: 'var(--down)',
  error: 'var(--down)',
  info: 'var(--color-accent-400)',
};

/** A stack of dismissible toasts — positioning is entirely up to `className`. */
export function NotificationStack({ notifications, onDismiss, className }: NotificationStackProps) {
  if (notifications.length === 0) return null;

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none' }}>
      {notifications.map((n) => (
        <div
          key={n.id}
          role="alert"
          className="notification-toast"
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '12px 14px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-divider)',
            borderLeft: `3px solid ${TONE_COLOR[n.tone]}`,
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px color-mix(in srgb, black 25%, transparent)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-text)' }}>
            {n.message}
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => onDismiss(n.id)}
            title="Dismiss"
            style={{
              flex: 'none',
              width: 22,
              height: 22,
              display: 'grid',
              placeItems: 'center',
              padding: 0,
              borderRadius: 6,
              color: 'var(--color-neutral-400)',
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
