import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createChatSession,
  deleteChatSession,
  getChatHistory,
  listChatSessions,
  streamChatMessage,
} from '../../../../api/chat';
import { ApiError } from '../../../../api/client';
import type { ChatSessionOut, MessageOut } from '../../../../api/types';
import { useNotifications } from '../../../../hooks/useNotifications';

const LOW_MESSAGES_REMAINING_THRESHOLD = 5;

export type ChatUIMessage = MessageOut & { key: string; streaming?: boolean };

interface ChatState {
  status: 'loading' | 'ready' | 'error';
  errorMessage: string | null;
  sessions: ChatSessionOut[];
  activeSessionId: string | null;
  messages: ChatUIMessage[];
}

let nextKey = 0;
const makeKey = () => `m${nextKey++}`;

function byMostRecent(a: ChatSessionOut, b: ChatSessionOut): number {
  return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
}

/**
 * Owns the full session lifecycle for `ticker`'s assistant: loads (or
 * creates) the session list once `enabled`, tracks which one is active, and
 * exposes actions to switch/create/delete sessions plus a streamed `send`.
 */
export function useChat(ticker: string, enabled: boolean) {
  const [state, setState] = useState<ChatState>({
    status: 'loading',
    errorMessage: null,
    sessions: [],
    activeSessionId: null,
    messages: [],
  });
  const [isSending, setIsSending] = useState(false);
  // The latest "what's happening" label from the backend, shown in place of
  // the pending dots until real answer text starts arriving. Cleared on
  // every new send and the moment any token lands.
  const [statusText, setStatusText] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const notifications = useNotifications();

  // Every async operation that ends in a full state replacement (initial
  // load, switching sessions, the delete-fallback reload) checks this before
  // applying its result, and `send()` bumps it the moment it starts. Without
  // this, a slow initial history fetch that resolves *after* the user has
  // already sent a message would silently overwrite the in-progress optimistic
  // update and the streaming reply with it — no error, the reply just vanishes.
  const loadToken = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const token = ++loadToken.current;
    let cancelled = false;

    (async () => {
      try {
        const sessions = await listChatSessions(ticker);
        if (cancelled || loadToken.current !== token) return;

        // Sessions are loaded (so the flyout can list past conversations),
        // but none is pre-selected — entering the page, or opening the
        // composer for the first time, always starts on an unsaved draft
        // rather than resuming whatever was last active.
        setState({ status: 'ready', errorMessage: null, sessions, activeSessionId: null, messages: [] });
      } catch (error) {
        if (cancelled || loadToken.current !== token) return;
        setState((s) => ({
          ...s,
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Something went wrong.',
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ticker, enabled]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const switchSession = useCallback((id: string) => {
    abortRef.current?.abort();
    const token = ++loadToken.current;
    setState((s) => (s.activeSessionId === id ? s : { ...s, activeSessionId: id, messages: [] }));

    getChatHistory(id)
      .then((history) => {
        if (loadToken.current !== token) return;
        setState((s) =>
          s.activeSessionId === id ? { ...s, messages: history.map((m) => ({ ...m, key: makeKey() })) } : s,
        );
      })
      .catch((error: unknown) => {
        if (loadToken.current !== token) return;
        setState((s) =>
          s.activeSessionId === id
            ? { ...s, status: 'error', errorMessage: error instanceof Error ? error.message : 'Something went wrong.' }
            : s,
        );
      });
  }, []);

  // Switches to an unsaved draft — no session is created in the DB until
  // send() is actually called with a first message.
  const newSession = useCallback(() => {
    abortRef.current?.abort();
    loadToken.current++;
    setState((s) => ({ ...s, activeSessionId: null, messages: [] }));
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      await deleteChatSession(id);
      const remaining = state.sessions.filter((s) => s.id !== id);

      if (state.activeSessionId !== id) {
        setState((s) => ({ ...s, sessions: remaining }));
        return;
      }

      // Deleting the active session falls through to the next most recent
      // one; deleting the last one falls through to an unsaved draft rather
      // than an empty state — but no new DB row until something is sent.
      if (remaining.length > 0) {
        const next = remaining[0];
        const token = ++loadToken.current;
        setState((s) => ({ ...s, sessions: remaining, activeSessionId: next.id, messages: [] }));
        getChatHistory(next.id)
          .then((history) => {
            if (loadToken.current !== token) return;
            setState((s) =>
              s.activeSessionId === next.id ? { ...s, messages: history.map((m) => ({ ...m, key: makeKey() })) } : s,
            );
          })
          .catch(() => {
            // A stale/broken fallback session isn't worth surfacing a hard error over.
          });
      } else {
        loadToken.current++;
        setState((s) => ({ ...s, sessions: [], activeSessionId: null, messages: [] }));
      }
    },
    [state.sessions, state.activeSessionId],
  );

  async function send(content: string) {
    if (isSending || state.status !== 'ready') return;

    // Invalidates any still-in-flight history load — send() is now the
    // authoritative source for `messages` until it finishes.
    loadToken.current++;

    // On a draft (no session yet), the DB row is only created now, right as
    // the first message actually goes out.
    let sessionId = state.activeSessionId;
    let createdSession: ChatSessionOut | null = null;
    if (!sessionId) {
      try {
        createdSession = await createChatSession(ticker);
      } catch (error) {
        setState((s) => ({
          ...s,
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Something went wrong.',
        }));
        return;
      }
      sessionId = createdSession.id;
    }

    const replyKey = makeKey();
    const now = new Date().toISOString();
    const title = content.length > 60 ? content.slice(0, 60) + '…' : content;

    setState((s) => ({
      ...s,
      activeSessionId: sessionId,
      messages: [
        ...s.messages,
        { key: makeKey(), role: 'user', content },
        { key: replyKey, role: 'assistant', content: '', streaming: true },
      ],
      sessions: (
        createdSession
          ? [{ ...createdSession, title, message_count: 1, last_message_at: now }, ...s.sessions]
          : s.sessions.map((sess) =>
              sess.id === sessionId
                ? { ...sess, title: sess.title ?? title, message_count: sess.message_count + 1, last_message_at: now }
                : sess,
            )
      ).sort(byMostRecent),
    }));
    setIsSending(true);
    setStatusText(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChatMessage(
        sessionId,
        content,
        (chunk) => {
          setStatusText(null);
          setState((s) => ({
            ...s,
            messages: s.messages.map((m) => (m.key === replyKey ? { ...m, content: m.content + chunk } : m)),
          }));
        },
        (label) => setStatusText(label),
        (remaining, resetsAt) => {
          if (remaining < LOW_MESSAGES_REMAINING_THRESHOLD) {
            const resetTime = new Date(resetsAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
            notifications.push(
              'warning',
              remaining <= 0
                ? `You've used all your messages for today. Limit resets at ${resetTime}.`
                : `Only ${remaining} message${remaining === 1 ? '' : 's'} left today. Limit resets at ${resetTime}.`,
            );
          }
        },
        controller.signal,
      );
    } catch (error) {
      const fallback =
        error instanceof ApiError && error.status === 429
          ? 'You are out of messages for today. Try again tomorrow.'
          : 'Something went wrong answering that — try again.';
      setState((s) => ({
        ...s,
        messages: s.messages.map((m) =>
          m.key === replyKey ? { ...m, content: m.content || fallback, streaming: false } : m,
        ),
      }));
      return;
    } finally {
      setIsSending(false);
    }

    setState((s) => ({
      ...s,
      messages: s.messages.map((m) => (m.key === replyKey ? { ...m, streaming: false } : m)),
    }));
  }

  return {
    ...state,
    isSending,
    statusText,
    send,
    switchSession,
    newSession,
    deleteSession,
    notifications: notifications.notifications,
    dismissNotification: notifications.dismiss,
  };
}
