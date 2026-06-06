'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserInfo } from '@/types/auth';

interface AuthState {
  accessToken: string | null;
  user: UserInfo | null;
  setAuth: (accessToken: string, user: UserInfo) => void;
  setAccessToken: (accessToken: string) => void;
  updateUser: (user: Partial<UserInfo>) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      setAuth: (accessToken, user) =>
        set({ accessToken, user }),
      setAccessToken: (accessToken) =>
        set({ accessToken }),
      updateUser: (partial) => {
        const current = get().user;
        if (current) set({ user: { ...current, ...partial } });
      },
      clear: () => set({ accessToken: null, user: null }),
    }),
    {
      name: 'collab-auth',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
