import { apiFetch } from './client';
import type { UserOut, WatchlistStock } from './types';

export function getMe(): Promise<UserOut> {
  return apiFetch('/users/me', { auth: true });
}

export function getWatchlist(): Promise<WatchlistStock[]> {
  return apiFetch('/users/me/watchlist', { auth: true });
}

export function addToWatchlist(ticker: string): Promise<void> {
  return apiFetch(`/users/me/watchlist/${encodeURIComponent(ticker)}`, { method: 'POST', auth: true });
}

export function removeFromWatchlist(ticker: string): Promise<void> {
  return apiFetch(`/users/me/watchlist/${encodeURIComponent(ticker)}`, { method: 'DELETE', auth: true });
}
