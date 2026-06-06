import apiClient from '@/lib/axios';
import type { ApiResponse } from '@/types/auth';
import type { TeamItem, CreateTeamRequest, UpdateTeamRequest, TeamInvitationItem } from '@/types/team';

export const teamService = {
  getMyTeams: () =>
    apiClient.get<ApiResponse<TeamItem[]>>('/api/teams/my').then((r) => r.data.data),

  createTeam: (data: CreateTeamRequest) =>
    apiClient.post<ApiResponse<TeamItem>>('/api/teams', data).then((r) => r.data.data),

  updateTeam: (teamIdx: number, data: UpdateTeamRequest) =>
    apiClient.put<ApiResponse<TeamItem>>(`/api/teams/${teamIdx}`, data).then((r) => r.data.data),

  deleteTeam: (teamIdx: number) =>
    apiClient.delete(`/api/teams/${teamIdx}`),

  inviteMember: (teamIdx: number, targetUserId: string) =>
    apiClient.post(`/api/teams/${teamIdx}/invitations`, { targetUserId }),

  getMyInvitations: () =>
    apiClient.get<ApiResponse<TeamInvitationItem[]>>('/api/teams/invitations').then((r) => r.data.data),

  acceptInvitation: (tmIdx: number) =>
    apiClient.patch<ApiResponse<TeamItem>>(`/api/teams/invitations/${tmIdx}/accept`).then((r) => r.data.data),

  rejectInvitation: (tmIdx: number) =>
    apiClient.patch(`/api/teams/invitations/${tmIdx}/reject`),

  kickMember: (teamIdx: number, targetUserId: string) =>
    apiClient.delete(`/api/teams/${teamIdx}/members/${encodeURIComponent(targetUserId)}`),

  changeRole: (teamIdx: number, targetUserId: string, role: string) =>
    apiClient.patch<ApiResponse<TeamItem>>(
      `/api/teams/${teamIdx}/members/${encodeURIComponent(targetUserId)}/role`,
      { role }
    ).then((r) => r.data.data),

  leaveTeam: (teamIdx: number) =>
    apiClient.delete(`/api/teams/${teamIdx}/leave`),

  joinChannel: (teamIdx: number, roomIdx: number) =>
    apiClient.post<ApiResponse<TeamItem>>(`/api/teams/${teamIdx}/channels/${roomIdx}/join`).then((r) => r.data.data),
};
