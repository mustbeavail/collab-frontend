import apiClient from '@/lib/axios';
import type { ApiResponse } from '@/types/auth';
import type { FriendItem } from '@/types/friend';

export const friendService = {
  getFriends: () =>
    apiClient.get<ApiResponse<FriendItem[]>>('/api/friends').then((r) => r.data.data),

  getPendingRequests: () =>
    apiClient.get<ApiResponse<FriendItem[]>>('/api/friends/requests').then((r) => r.data.data),

  sendRequest: (targetUserId: string) =>
    apiClient.post<ApiResponse<null>>('/api/friends/request', { targetUserId }),

  acceptRequest: (friendIdx: number) =>
    apiClient.patch<ApiResponse<null>>(`/api/friends/${friendIdx}/accept`),

  rejectRequest: (friendIdx: number) =>
    apiClient.patch<ApiResponse<null>>(`/api/friends/${friendIdx}/reject`),

  deleteFriend: (friendIdx: number) =>
    apiClient.delete<ApiResponse<null>>(`/api/friends/${friendIdx}`),
};
