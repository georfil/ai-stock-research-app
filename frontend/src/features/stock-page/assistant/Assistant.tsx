import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { ArrowUp, X } from '@phosphor-icons/react';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { useAuth } from '../../../hooks/useAuth';
import { ElevatedSurface } from '../../../ui/ElevatedSurface';
import { StatusBlock } from '../../../ui/StatusBlock';
import { ComposerPill } from './ComposerPill';
import { AssistantMessage } from './AssistantMessage';
import { SessionDropdown } from './SessionDropdown';
import { useChat } from './hooks/useChat';

interface AssistantProps {
  ticker: string;
}

export function Assistant({ ticker }: AssistantProps) {
  const auth = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  // Session/history only get fetched once the panel's actually opened, so
  // just viewing a stock page doesn't spin up a chat session for nothing.
  const [everOpened, setEverOpened] = useState(false);
  const chat = useChat(ticker, auth.status === 'authed' && everOpened);
  const [draft, setDraft] = useState('');

  const messages = chat.messages.filter((m) => m.content || !m.streaming);
  const pending = chat.isSending && !messages.at(-1)?.content;

  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  // Traps across the whole root, not just the wash — the composer lives
  // outside the wash (see below) but is still part of the dialog experience
  // once open, and Tab should cycle through it too.
  useFocusTrap(rootRef, isOpen);

  function open() {
    setIsOpen(true);
    setEverOpened(true);
  }

  function close() {
    setIsOpen(false);
  }

  // The thread/dialog wrappers stretch to fill the overlay (flex default
  // stretch), so a click that visually lands on bare wash still needs
  // checking at each transparent layer, not just the outermost one.
  function closeIfBackground(e: ReactMouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  useEffect(() => {
    if (isOpen) {
      pinnedToBottom.current = true;
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        scrollToBottom();
      });
    }
  }, [isOpen]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((o) => !o);
        return;
      }
      if (e.key === 'Escape') {
        setIsOpen((o) => (o ? false : o));
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  function scrollToBottom() {
    const el = threadRef.current;
    if (el && pinnedToBottom.current) el.scrollTop = el.scrollHeight;
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages, pending]);

  function onThreadScroll() {
    const el = threadRef.current;
    if (!el) return;
    pinnedToBottom.current = el.scrollTop >= el.scrollHeight - el.clientHeight - 24;
  }

  function send() {
    const text = draft.trim();
    if (!text || chat.isSending || chat.status !== 'ready') return;
    setDraft('');
    pinnedToBottom.current = true;
    void chat.send(text);
  }

  if (auth.status !== 'authed') {
    return (
      <div style={{ position: 'sticky', bottom: 24, zIndex: 5 }}>
        <ElevatedSurface style={{ padding: '14px 20px', fontSize: 13.5, color: 'var(--color-neutral-400)', textAlign: 'center' }}>
          Sign in to ask about {ticker}.
        </ElevatedSurface>
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      {isOpen && (
        <div
          className="assistant-wash assistant-enter"
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column' }}
          onMouseDown={closeIfBackground}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Ask about ${ticker}`}
            onMouseDown={closeIfBackground}
            style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
          >
            {/* Aligned to the page's primary column via .assistant-content-dock
                (index.css) — the same custom properties the composer dock
                below reads, so nothing here needs to move when the assistant
                opens. The sessions dropdown is a flyout, not a reserved-width
                column (see SessionDropdown), so it can't compete with that
                alignment; it just sits at the left of this header, with the
                close button at the right. */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div onMouseDown={closeIfBackground} style={{ flex: 'none', display: 'flex', padding: '22px 0 0' }}>
                <div className="assistant-content-dock" style={{ display: 'flex', alignItems: 'center' }}>
                  <SessionDropdown
                    sessions={chat.sessions}
                    activeSessionId={chat.activeSessionId}
                    onSelect={chat.switchSession}
                    onDelete={chat.deleteSession}
                    onNew={chat.newSession}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={close}
                    title="Close"
                    style={{
                      marginLeft: 'auto',
                      width: 38,
                      height: 38,
                      display: 'grid',
                      placeItems: 'center',
                      padding: 0,
                      borderRadius: 8,
                      color: 'var(--color-neutral-400)',
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div
                ref={threadRef}
                onScroll={onThreadScroll}
                onMouseDown={closeIfBackground}
                aria-live="polite"
                style={{ flex: 1, overflowY: 'auto', padding: '24px 0 140px' }}
              >
                <div className="assistant-content-dock" onMouseDown={closeIfBackground} style={{ display: 'flex', flexDirection: 'column' }}>
                  {chat.status === 'error' && (
                    <StatusBlock tone="error">Couldn't load this conversation: {chat.errorMessage}</StatusBlock>
                  )}
                  {messages.map((m, i) => {
                    const prev = messages[i - 1];
                    const marginTop = i === 0 ? 0 : m.role === 'assistant' && prev?.role === 'user' ? 18 : 52;
                    return (
                      <div key={m.key} onMouseDown={closeIfBackground} style={{ marginTop }}>
                        <AssistantMessage message={m} />
                      </div>
                    );
                  })}
                  {pending && (
                    <div style={{ marginTop: 18, paddingLeft: 16, display: 'flex', gap: 7 }}>
                      <span className="assistant-pending-dot" />
                      <span className="assistant-pending-dot" style={{ animationDelay: '0.18s' }} />
                      <span className="assistant-pending-dot" style={{ animationDelay: '0.36s' }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* The composer itself: mounted once, at a fixed screen position
          aligned to the page's primary column (.assistant-composer-dock,
          index.css) in every state — the same custom properties the chat
          content (.assistant-content-dock) reads, so there's nothing to
          transition; it just never needs to move when the assistant opens.
          No leading icon, so its text sits flush with the same left inset
          (16px, via ComposerPill's own padding) as the message text above
          it — one shared text baseline for the whole column. */}
      <div className="assistant-composer-dock">
        <div style={{ position: 'relative' }}>
          <ComposerPill>
            {isOpen ? (
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder={`Ask about ${ticker}…`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  maxHeight: 160,
                  background: 'transparent',
                  border: 0,
                  outline: 'none',
                  resize: 'none',
                  color: 'var(--color-text)',
                  font: '400 17.5px/1.6 var(--font-body)',
                  padding: '11px 0',
                }}
              />
            ) : (
              <input
                readOnly
                onFocus={open}
                onClick={open}
                placeholder={`Ask about ${ticker}…`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: 'transparent',
                  border: 0,
                  outline: 'none',
                  color: 'var(--color-neutral-400)',
                  font: '400 17.5px/1.6 var(--font-body)',
                  padding: '11px 0',
                  cursor: 'text',
                }}
              />
            )}
            {isOpen && (
              <button
                type="button"
                className="icon-btn"
                onClick={send}
                disabled={chat.isSending || chat.status !== 'ready' || !draft.trim()}
                title="Send"
                style={{
                  flex: 'none',
                  width: 38,
                  height: 38,
                  display: 'grid',
                  placeItems: 'center',
                  padding: 0,
                  borderRadius: 8,
                  border: '1px solid var(--color-accent)',
                  color: 'var(--color-accent-400)',
                  marginBottom: 2,
                }}
              >
                <ArrowUp size={17} weight="bold" />
              </button>
            )}
          </ComposerPill>
          {isOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 9,
                fontSize: 12,
                color: 'var(--color-neutral-600)',
                textAlign: 'center',
              }}
            >
              Enter to send, Shift+Enter for a new line. AI answers can be wrong — check filings before acting on them.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
