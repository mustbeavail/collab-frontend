import { create } from 'zustand';
import type { TeamItem } from '@/types/team';

interface TeamState {
  teams: TeamItem[];
  loading: boolean;
  setTeams: (teams: TeamItem[]) => void;
  setLoading: (loading: boolean) => void;
  addTeam: (team: TeamItem) => void;
  updateTeamInStore: (team: TeamItem) => void;
  removeTeam: (teamIdx: number) => void;
  removeChannelFromTeam: (teamIdx: number, roomIdx: number) => void;
}

export const useTeamStore = create<TeamState>((set) => ({
  teams: [],
  loading: false,
  setTeams: (teams) => set({ teams }),
  setLoading: (loading) => set({ loading }),
  addTeam: (team) => set((s) => ({ teams: [...s.teams, team] })),
  updateTeamInStore: (team) =>
    set((s) => ({ teams: s.teams.map((t) => (t.teamIdx === team.teamIdx ? team : t)) })),
  removeTeam: (teamIdx) =>
    set((s) => ({ teams: s.teams.filter((t) => t.teamIdx !== teamIdx) })),
  removeChannelFromTeam: (teamIdx, roomIdx) =>
    set((s) => ({
      teams: s.teams.map((t) =>
        t.teamIdx === teamIdx
          ? { ...t, channels: t.channels.filter((ch) => ch.roomIdx !== roomIdx) }
          : t
      ),
    })),
}));
