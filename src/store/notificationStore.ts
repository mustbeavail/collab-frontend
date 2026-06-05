import { create } from 'zustand';
import type { FriendItem } from '@/types/friend';
import type { TeamInvitationItem } from '@/types/team';

interface NotificationState {
  pendingRequests: FriendItem[];
  teamInvitations: TeamInvitationItem[];
  loading: boolean;
  setPendingRequests: (reqs: FriendItem[]) => void;
  addRequest: (req: FriendItem) => void;
  removeRequest: (friendIdx: number) => void;
  setTeamInvitations: (invitations: TeamInvitationItem[]) => void;
  addTeamInvitation: (inv: TeamInvitationItem) => void;
  removeTeamInvitation: (tmIdx: number) => void;
  setLoading: (v: boolean) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  pendingRequests: [],
  teamInvitations: [],
  loading: false,
  setPendingRequests: (pendingRequests) => set({ pendingRequests }),
  addRequest: (req) =>
    set((s) => ({
      pendingRequests: s.pendingRequests.some((r) => r.friendIdx === req.friendIdx)
        ? s.pendingRequests
        : [...s.pendingRequests, req],
    })),
  removeRequest: (friendIdx) =>
    set((s) => ({
      pendingRequests: s.pendingRequests.filter((r) => r.friendIdx !== friendIdx),
    })),
  setTeamInvitations: (teamInvitations) => set({ teamInvitations }),
  addTeamInvitation: (inv) =>
    set((s) => ({
      teamInvitations: s.teamInvitations.some((i) => i.tmIdx === inv.tmIdx)
        ? s.teamInvitations
        : [...s.teamInvitations, inv],
    })),
  removeTeamInvitation: (tmIdx) =>
    set((s) => ({
      teamInvitations: s.teamInvitations.filter((i) => i.tmIdx !== tmIdx),
    })),
  setLoading: (loading) => set({ loading }),
}));
