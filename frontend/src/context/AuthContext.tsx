import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { login as apiLogin, register as apiRegister } from '../api/auth';
import { getMe } from '../api/users';
import { clearAuthToken, getAuthToken, setAuthToken } from '../api/client';
import { AuthContext } from './auth-context';

type AuthState =
  | { status: 'loading' }
  | { status: 'anon' }
  | { status: 'authed'; username: string };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => (getAuthToken() ? { status: 'loading' } : { status: 'anon' }));

  useEffect(() => {
    if (!getAuthToken()) return;
    let cancelled = false;
    getMe()
      .then((me) => {
        if (!cancelled) setState({ status: 'authed', username: me.username });
      })
      .catch(() => {
        if (!cancelled) {
          clearAuthToken();
          setState({ status: 'anon' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { access_token } = await apiLogin(username, password);
    setAuthToken(access_token);
    const me = await getMe();
    setState({ status: 'authed', username: me.username });
  }, []);

  const register = useCallback(
    async (username: string, password: string) => {
      await apiRegister(username, password);
      await login(username, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    clearAuthToken();
    setState({ status: 'anon' });
  }, []);

  return <AuthContext.Provider value={{ ...state, login, register, logout }}>{children}</AuthContext.Provider>;
}
