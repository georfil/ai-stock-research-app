import { apiFetch, apiUrl, authHeaders, ApiError } from './client';
import type { ChatSessionOut, MessageOut } from './types';

export function listChatSessions(ticker: string): Promise<ChatSessionOut[]> {
  return apiFetch(`/chat/${encodeURIComponent(ticker)}/sessions`, { auth: true });
}

export function createChatSession(ticker: string): Promise<ChatSessionOut> {
  return apiFetch(`/chat/${encodeURIComponent(ticker)}/session`, { method: 'POST', auth: true });
}

export function deleteChatSession(id: string): Promise<void> {
  return apiFetch(`/chat/session/${id}`, { method: 'DELETE', auth: true });
}

export function getChatHistory(id: string): Promise<MessageOut[]> {
  return apiFetch(`/chat/session/${id}`, { auth: true });
}

/**
 * Sends a message and streams the reply as it's generated, calling `onToken`
 * with each text chunk as it arrives, `onStatus` with a short label
 * whenever the backend reports progress before any text exists yet (e.g.
 * "Deciding what to check…"), and `onLimit` once with how many daily
 * messages the user has left after this one and when the limit resets
 * (omitted entirely for admins), and `onDone` with the session's title as
 * the backend now has it — the caller shows a provisional title while the
 * turn runs, and this is the first point the AI-written one exists.
 * Resolves once the backend signals the stream is done.
 */
export async function streamChatMessage(
  id: string,
  content: string,
  onToken: (chunk: string) => void,
  onStatus: (label: string) => void,
  onLimit: (remaining: number, resetsAt: string) => void,
  onDone: (title: string | null) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(apiUrl(`/chat/session/${id}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ content }),
    signal,
  });

  if (!response.ok || !response.body) {
    const detail = await response
      .json()
      .then((data) => (typeof data?.detail === 'string' ? data.detail : null))
      .catch(() => null);
    throw new ApiError(response.status, detail ?? `Request failed with status ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });

    let separator: number;
    while ((separator = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      const parsed = parseSseEvent(rawEvent);
      if (parsed?.event === 'token' && typeof parsed.data.content === 'string') onToken(parsed.data.content);
      if (parsed?.event === 'status' && typeof parsed.data.label === 'string') onStatus(parsed.data.label);
      if (parsed?.event === 'limit' && typeof parsed.data.remaining === 'number' && typeof parsed.data.resets_at === 'string') {
        onLimit(parsed.data.remaining, parsed.data.resets_at);
      }
      if (parsed?.event === 'done') {
        onDone(typeof parsed.data.title === 'string' ? parsed.data.title : null);
        return;
      }
    }
  }
}

function parseSseEvent(raw: string): { event: string; data: Record<string, unknown> } | null {
  let event = 'message';
  let data = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith('event: ')) event = line.slice('event: '.length);
    else if (line.startsWith('data: ')) data = line.slice('data: '.length);
  }
  if (!data) return null;
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return null;
  }
}
