import { X } from '@phosphor-icons/react';
import type { ChatSessionOut } from '../../../api/types';
import { formatAge } from './formatAge';

interface SessionRowProps {
  session: ChatSessionOut;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

/** One row in the session list — used by both the wide column and the
 * narrow header dropdown, so the two stay visually identical. */
export function SessionRow({ session, isActive, onSelect, onDelete }: SessionRowProps) {
  return (
    <div
      className="assistant-session-row"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        borderRadius: 'var(--radius-md)',
        background: isActive ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent',
        boxShadow: isActive ? 'inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 35%, transparent)' : 'none',
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: 'left',
          background: 'transparent',
          border: 0,
          padding: '11px 12px',
          cursor: 'pointer',
          color: 'inherit',
          font: 'inherit',
        }}
      >
        <div
          style={{
            fontSize: 16,
            color: isActive ? 'var(--color-text)' : 'var(--color-neutral-300)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {session.title ?? 'New conversation'}
        </div>
        <div style={{ marginTop: 3, fontSize: 12.5, color: 'var(--color-neutral-600)' }}>
          {formatAge(session.last_message_at)}
          {session.message_count > 0 && ` · ${session.message_count} question${session.message_count === 1 ? '' : 's'}`}
        </div>
      </button>
      <button
        type="button"
        className="assistant-session-delete icon-btn"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Delete conversation"
        style={{
          flex: 'none',
          width: 24,
          height: 24,
          display: 'grid',
          placeItems: 'center',
          padding: 0,
          marginRight: 6,
          borderRadius: 6,
          color: 'var(--color-neutral-600)',
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
