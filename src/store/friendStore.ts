import { create } from 'zustand';
import type { FriendItem } from '@/types/friend';

interface FriendState {
  friends: FriendItem[];
  onlineUsers: Set<string>;
  loading: boolean;
  setFriends: (friends: FriendItem[]) => void;
  addFriend: (friend: FriendItem) => void;
  removeFriend: (friendIdx: number) => void;
  setOnlineUsers: (userIds: Set<string>) => void;
  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useFriendStore = create<FriendState>((set) => ({
  friends: [],
  onlineUsers: new Set<string>(),
  loading: false,
  setFriends: (friends) => set({ friends }),
  addFriend: (friend) =>
    set((state) => ({ friends: [...state.friends, { ...friend, status: 'ACCEPTED' }] })),
  removeFriend: (friendIdx) =>
    set((state) => ({ friends: state.friends.filter((f) => f.friendIdx !== friendIdx) })),
  setOnlineUsers: (onlineUsers) => set({ onlineUsers }),
  setUserOnline: (userId) =>
    set((state) => ({ onlineUsers: new Set([...state.onlineUsers, userId]) })),
  setUserOffline: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.delete(userId);
      return { onlineUsers: next };
    }),
  setLoading: (loading) => set({ loading }),
}));
