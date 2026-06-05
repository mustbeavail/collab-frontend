import apiClient from '@/lib/axios';
import type { ApiResponse } from '@/types/auth';
import type { TeamItem } from '@/types/team';

export const teamService = {
  getMyTeams: () =>
    apiClient.get<ApiResponse<TeamItem[]>>('/api/teams/my').then((r) => r.data.data),
};
