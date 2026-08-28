import { apiFetch } from './client';

export function login(username: string, password: string): Promise<{ access_token: string; token_type: string }> {
  return apiFetch('/auth/login', { method: 'POST', body: { username, password } });
}

export function register(username: string, rawPassword: string): Promise<{ message: string }> {
  return apiFetch('/auth/register', { method: 'POST', body: { username, raw_password: rawPassword } });
}
