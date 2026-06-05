import { create } from 'zustand';
import type { FriendItem } from '@/types/friend';

interface NotificationState {
  pendingRequests: FriendItem[];
  loading: boolean;
  setPendingRequests: (reqs: FriendItem[]) => void;
  removeRequest: (friendIdx: number) => void;
  setLoading: (v: boolean) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  pendingRequests: [],
  loading: false,
  setPendingRequests: (pendingRequests) => set({ pendingRequests }),
  removeRequest: (friendIdx) =>
    set((s) => ({
      pendingRequests: s.pendingRequests.filter((r) => r.friendIdx !== friendIdx),
    })),
  setLoading: (loading) => set({ loading }),
}));
