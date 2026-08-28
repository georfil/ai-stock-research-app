import { apiFetch } from './client';
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

export function sendChatMessage(id: string, content: string): Promise<MessageOut> {
  return apiFetch(`/chat/session/${id}`, { method: 'POST', body: { content }, auth: true });
}
