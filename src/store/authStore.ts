'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserInfo } from '@/types/auth';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  user: UserInfo | null;
  setAuth: (accessToken: string, refreshToken: string, user: UserInfo) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  updateUser: (user: Partial<UserInfo>) => void;
  clear: () => void;
}

const ACCESS_TOKEN_TTL = 3600_000; // 1 hour

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      user: null,
      setAuth: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, user, expiresAt: Date.now() + ACCESS_TOKEN_TTL }),
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken, expiresAt: Date.now() + ACCESS_TOKEN_TTL }),
      updateUser: (partial) => {
        const current = get().user;
        if (current) set({ user: { ...current, ...partial } });
      },
      clear: () => set({ accessToken: null, refreshToken: null, expiresAt: null, user: null }),
    }),
    { name: 'collab-auth' }
  )
);
