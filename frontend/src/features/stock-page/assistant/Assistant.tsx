import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { ArrowUp, Sparkle, X } from '@phosphor-icons/react';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { ComposerPill } from './ComposerPill';
import { AssistantMessage } from './AssistantMessage';
import type { DemoMessage } from './AssistantMessage';

interface AssistantProps {
  ticker: string;
}

// Seeded conversation for this pass — the wash and the two message
// treatments are what's under review; sessions aren't wired up yet.
const SEED_MESSAGES: DemoMessage[] = [
  {
    role: 'user',
    content: 'Gross margin looks thin for a hardware business. Is it improving?',
  },
  {
    role: 'assistant',
    content:
      "It is, slowly. Gross margin across the last three fiscal years sits in the high teens to low twenties, with the dip in the middle year tracking cost growth on fixed-price development programmes.\n\nTwo things worth watching over a multi-year hold:\n\n- Mix. Higher-margin recurring work growing faster than one-off development contracts would help.\n- Absorption. Operating loss narrowing even as SG&A grows suggests scale is starting to do some of the work.\n\nCash from operations is still negative, so the margin improvement hasn't yet translated into the company funding itself.",
  },
  {
    role: 'user',
    content: 'What would have to go right for this to work over five years?',
  },
  {
    role: 'assistant',
    content:
      "Backlog converting to revenue on schedule, margin holding or improving as volume scales, and no further dilution beyond what's already priced in. The bear case is programme concentration — a handful of contracts carry a large share of revenue, so losing or delaying one has an outsized effect.",
  },
];

export function Assistant({ ticker }: AssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<DemoMessage[]>(SEED_MESSAGES);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  useFocusTrap(overlayRef, isOpen);

  function open() {
    setIsOpen(true);
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
    if (!text || pending) return;
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setDraft('');
    setPending(true);
    pinnedToBottom.current = true;
    // Preview-only stand-in for this pass — replaced by the real backend
    // call once sessions are wired in.
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content:
            "This is a preview reply so the two message treatments can be judged — the real answer will come from the assistant once sessions are wired in.",
        },
      ]);
      setPending(false);
    }, 1100);
  }

  return (
    <>
      <div style={{ position: 'sticky', bottom: 24, zIndex: 5 }}>
        <ComposerPill>
          <Sparkle size={17} weight="fill" style={{ color: 'var(--color-accent)', flex: 'none', marginBottom: 7 }} />
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
              font: '400 15px var(--font-body)',
              padding: '9px 0',
              cursor: 'text',
            }}
          />
          <span
            style={{
              flex: 'none',
              font: '400 11.5px var(--font-mono-data)',
              padding: '4px 8px',
              borderRadius: 6,
              color: 'var(--color-neutral-500)',
              background: 'color-mix(in srgb, var(--color-text) 8%, transparent)',
            }}
          >
            ⌘K
          </span>
        </ComposerPill>
      </div>

      {isOpen && (
        <div
          className="assistant-wash assistant-enter"
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column' }}
          onMouseDown={closeIfBackground}
        >
          <div
            ref={overlayRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Ask about ${ticker}`}
            onMouseDown={closeIfBackground}
            style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
          >
            <button
              type="button"
              className="icon-btn"
              onClick={close}
              title="Close"
              style={{
                position: 'absolute',
                top: 22,
                right: 28,
                width: 34,
                height: 34,
                display: 'grid',
                placeItems: 'center',
                padding: 0,
                borderRadius: 8,
                color: 'var(--color-neutral-400)',
                zIndex: 2,
              }}
            >
              <X size={18} />
            </button>

            <div
              className="assistant-thread"
              ref={threadRef}
              onScroll={onThreadScroll}
              onMouseDown={closeIfBackground}
              aria-live="polite"
              style={{ flex: 1, overflowY: 'auto', padding: '64px 24px 24px' }}
            >
              <div onMouseDown={closeIfBackground} style={{ maxWidth: '71ch', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
                {messages.map((m, i) => {
                  const prev = messages[i - 1];
                  const marginTop = i === 0 ? 0 : m.role === 'assistant' && prev?.role === 'user' ? 16 : 44;
                  return (
                    <div key={i} onMouseDown={closeIfBackground} style={{ marginTop }}>
                      <AssistantMessage message={m} />
                    </div>
                  );
                })}
                {pending && (
                  <div style={{ marginTop: 16, paddingLeft: 14, display: 'flex', gap: 7 }}>
                    <span className="assistant-pending-dot" />
                    <span className="assistant-pending-dot" style={{ animationDelay: '0.18s' }} />
                    <span className="assistant-pending-dot" style={{ animationDelay: '0.36s' }} />
                  </div>
                )}
              </div>
            </div>

            <div onMouseDown={closeIfBackground} style={{ padding: '0 24px 22px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '100%', maxWidth: '71ch', display: 'flex', flexDirection: 'column', gap: 9 }}>
                <ComposerPill>
                  <Sparkle size={17} weight="fill" style={{ color: 'var(--color-accent)', flex: 'none', marginBottom: 8 }} />
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
                      font: '400 15.5px/1.55 var(--font-body)',
                      padding: '9px 0',
                    }}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={send}
                    disabled={pending || !draft.trim()}
                    title="Send"
                    style={{
                      flex: 'none',
                      width: 34,
                      height: 34,
                      display: 'grid',
                      placeItems: 'center',
                      padding: 0,
                      borderRadius: 8,
                      border: '1px solid var(--color-accent)',
                      color: 'var(--color-accent-400)',
                      marginBottom: 2,
                    }}
                  >
                    <ArrowUp size={16} weight="bold" />
                  </button>
                </ComposerPill>
                <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)', textAlign: 'center' }}>
                  Enter to send, Shift+Enter for a new line. AI answers can be wrong — check filings before acting on them.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
