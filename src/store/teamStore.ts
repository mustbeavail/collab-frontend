import { create } from 'zustand';
import type { TeamItem } from '@/types/team';

interface TeamState {
  teams: TeamItem[];
  loading: boolean;
  setTeams: (teams: TeamItem[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useTeamStore = create<TeamState>((set) => ({
  teams: [],
  loading: false,
  setTeams: (teams) => set({ teams }),
  setLoading: (loading) => set({ loading }),
}));
