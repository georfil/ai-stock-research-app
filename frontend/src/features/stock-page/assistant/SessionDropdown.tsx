import { useEffect, useRef, useState } from 'react';
import { CaretDown, Plus } from '@phosphor-icons/react';
import type { ChatSessionOut } from '../../../api/types';
import { SessionRow } from './SessionRow';

interface SessionDropdownProps {
  sessions: ChatSessionOut[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

/** Session navigation as a flyout rather than a persistent side column — it
 * needs no reserved layout width, so it can't compete with the chat
 * column's exact alignment to the page's primary column. Sits at the left
 * of the overlay header, alongside the close button on the right. */
export function SessionDropdown({ sessions, activeSessionId, onSelect, onDelete, onNew }: SessionDropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const active = sessions.find((s) => s.id === activeSessionId);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn btn-secondary"
        style={{ fontSize: 12.5, maxWidth: 190, gap: 6 }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {active?.title ?? 'Conversations'}
        </span>
        <CaretDown size={11} style={{ flex: 'none', opacity: 0.7 }} />
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={onNew}
        title="New conversation"
        style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', padding: 0, borderRadius: 6, color: 'var(--color-neutral-400)' }}
      >
        <Plus size={14} weight="bold" />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: 260,
            maxHeight: 320,
            overflowY: 'auto',
            padding: 6,
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-neutral-800)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 10,
          }}
        >
          {sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              isActive={s.id === activeSessionId}
              onSelect={() => {
                onSelect(s.id);
                setOpen(false);
              }}
              onDelete={() => onDelete(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
