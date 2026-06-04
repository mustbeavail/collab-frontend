'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserInfo } from '@/types/auth';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserInfo | null;
  setAuth: (accessToken: string, refreshToken: string, user: UserInfo) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  updateUser: (user: Partial<UserInfo>) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, user }),
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),
      updateUser: (partial) => {
        const current = get().user;
        if (current) set({ user: { ...current, ...partial } });
      },
      clear: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'collab-auth' }
  )
);
