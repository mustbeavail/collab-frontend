import { create } from 'zustand';
import type { FriendItem } from '@/types/friend';

interface FriendState {
  friends: FriendItem[];
  loading: boolean;
  setFriends: (friends: FriendItem[]) => void;
  addFriend: (friend: FriendItem) => void;
  removeFriend: (friendIdx: number) => void;
  setLoading: (loading: boolean) => void;
}

export const useFriendStore = create<FriendState>((set) => ({
  friends: [],
  loading: false,
  setFriends: (friends) => set({ friends }),
  addFriend: (friend) =>
    set((state) => ({ friends: [...state.friends, { ...friend, status: 'ACCEPTED' }] })),
  removeFriend: (friendIdx) =>
    set((state) => ({ friends: state.friends.filter((f) => f.friendIdx !== friendIdx) })),
  setLoading: (loading) => set({ loading }),
}));
