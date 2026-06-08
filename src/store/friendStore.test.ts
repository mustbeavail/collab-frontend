import { describe, it, expect, beforeEach } from 'vitest';
import { useFriendStore } from './friendStore';
import type { FriendItem } from '@/types/friend';

const friend = (friendIdx: number): FriendItem => ({
  friendIdx,
  userId: `u${friendIdx}`,
  nickname: `n${friendIdx}`,
  email: `e${friendIdx}@t.com`,
  status: 'ACCEPTED',
});

beforeEach(() => {
  useFriendStore.setState({ friends: [], onlineUsers: new Set<string>(), loading: false });
});

describe('friendStore', () => {
  it('addFriend 는 status 를 ACCEPTED 로 강제한다', () => {
    useFriendStore.getState().addFriend({ ...friend(1), status: 'PENDING' });
    const fs = useFriendStore.getState().friends;
    expect(fs).toHaveLength(1);
    expect(fs[0].status).toBe('ACCEPTED');
  });

  it('removeFriend 는 해당 friendIdx 만 제거한다', () => {
    useFriendStore.setState({ friends: [friend(1), friend(2)], onlineUsers: new Set(), loading: false });
    useFriendStore.getState().removeFriend(1);
    expect(useFriendStore.getState().friends.map((f) => f.friendIdx)).toEqual([2]);
  });

  it('setUserOnline / setUserOffline 는 onlineUsers 를 갱신한다', () => {
    const { setUserOnline, setUserOffline } = useFriendStore.getState();
    setUserOnline('alice');
    setUserOnline('bob');
    expect(useFriendStore.getState().onlineUsers.has('alice')).toBe(true);
    expect(useFriendStore.getState().onlineUsers.has('bob')).toBe(true);

    setUserOffline('alice');
    expect(useFriendStore.getState().onlineUsers.has('alice')).toBe(false);
    expect(useFriendStore.getState().onlineUsers.has('bob')).toBe(true);
  });

  it('setUserOnline 은 새 Set 인스턴스를 만든다(불변성 유지)', () => {
    const before = useFriendStore.getState().onlineUsers;
    useFriendStore.getState().setUserOnline('alice');
    const after = useFriendStore.getState().onlineUsers;
    expect(after).not.toBe(before);
    expect(after.has('alice')).toBe(true);
  });
});
