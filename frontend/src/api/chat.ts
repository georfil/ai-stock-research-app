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
 * with each text chunk as it arrives. Resolves once the backend signals the
 * stream is done.
 */
export async function streamChatMessage(
  id: string,
  content: string,
  onToken: (chunk: string) => void,
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
      if (parsed?.event === 'done') return;
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
