import { createContext } from 'react';

type AuthState =
  | { status: 'loading' }
  | { status: 'anon' }
  | { status: 'authed'; username: string };

export type AuthContextValue = AuthState & {
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
