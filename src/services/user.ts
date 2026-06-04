import apiClient from '@/lib/axios';
import type { ApiResponse } from '@/types/auth';

export interface UpdateProfileRequest {
  nickname: string;
  about?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  nickname: string;
  about?: string;
  joinAt?: string;
}

// User API — connects once backend /api/users endpoints are implemented
export const userService = {
  getProfile: () =>
    apiClient
      .get<ApiResponse<UserProfile>>('/api/users/me')
      .then((r) => r.data.data),

  updateProfile: (body: UpdateProfileRequest) =>
    apiClient
      .put<ApiResponse<UserProfile>>('/api/users/me', body)
      .then((r) => r.data.data),

  changePassword: (body: ChangePasswordRequest) =>
    apiClient.put('/api/users/me/password', body),

  withdraw: () =>
    apiClient.delete('/api/users/me'),

  // 프로필 사진 업로드 — POST /api/users/me/avatar (multipart)
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient
      .post<ApiResponse<{ avatarUrl: string }>>('/api/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.data.avatarUrl);
  },
};
