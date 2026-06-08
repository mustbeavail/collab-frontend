import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationStore } from './notificationStore';
import type { FriendItem } from '@/types/friend';
import type { TeamInvitationItem } from '@/types/team';

const req = (friendIdx: number): FriendItem => ({
  friendIdx,
  userId: `u${friendIdx}`,
  nickname: `n${friendIdx}`,
  email: `e${friendIdx}@t.com`,
  status: 'PENDING',
});

const inv = (tmIdx: number): TeamInvitationItem => ({
  tmIdx,
  teamIdx: tmIdx * 10,
  teamName: `team${tmIdx}`,
});

beforeEach(() => {
  useNotificationStore.setState({ pendingRequests: [], teamInvitations: [], loading: false });
});

describe('notificationStore', () => {
  it('addRequest 는 같은 friendIdx 를 중복 추가하지 않는다', () => {
    const { addRequest } = useNotificationStore.getState();
    addRequest(req(1));
    addRequest(req(1)); // 중복 → 무시되어야 함
    addRequest(req(2));
    expect(useNotificationStore.getState().pendingRequests).toHaveLength(2);
  });

  it('removeRequest 는 해당 friendIdx 만 제거한다', () => {
    useNotificationStore.setState({ pendingRequests: [req(1), req(2)], teamInvitations: [], loading: false });
    useNotificationStore.getState().removeRequest(1);
    const reqs = useNotificationStore.getState().pendingRequests;
    expect(reqs).toHaveLength(1);
    expect(reqs[0].friendIdx).toBe(2);
  });

  it('addTeamInvitation 는 같은 tmIdx 를 중복 추가하지 않는다', () => {
    const { addTeamInvitation } = useNotificationStore.getState();
    addTeamInvitation(inv(1));
    addTeamInvitation(inv(1));
    expect(useNotificationStore.getState().teamInvitations).toHaveLength(1);
  });

  it('removeTeamInvitation 는 해당 tmIdx 만 제거한다', () => {
    useNotificationStore.setState({ pendingRequests: [], teamInvitations: [inv(1), inv(2)], loading: false });
    useNotificationStore.getState().removeTeamInvitation(2);
    const invs = useNotificationStore.getState().teamInvitations;
    expect(invs).toHaveLength(1);
    expect(invs[0].tmIdx).toBe(1);
  });
});
