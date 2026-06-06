import apiClient from '@/lib/axios';
import type { ApiResponse, AuthResponse, LoginRequest, SignupRequest } from '@/types/auth';

export const authService = {
  login: (body: LoginRequest) =>
    apiClient
      .post<ApiResponse<AuthResponse>>('/api/auth/login', body)
      .then((r) => r.data.data),

  signup: (body: SignupRequest) =>
    apiClient
      .post<ApiResponse<AuthResponse>>('/api/auth/signup', body)
      .then((r) => r.data.data),

  logout: () =>
    apiClient.post('/api/auth/logout'),

  refresh: () =>
    apiClient
      .post<ApiResponse<AuthResponse>>('/api/auth/refresh')
      .then((r) => r.data.data),

  // 이메일 인증코드 발송 — POST /api/auth/email/send-code
  sendEmailCode: (email: string) =>
    apiClient.post<ApiResponse<null>>('/api/auth/email/send-code', { email }),

  // 이메일 인증코드 확인 — POST /api/auth/email/verify-code
  verifyEmailCode: (email: string, code: string) =>
    apiClient.post<ApiResponse<null>>('/api/auth/email/verify-code', { email, code }),

  // 이메일 중복 확인 — GET /api/auth/check-email
  checkEmail: (email: string) =>
    apiClient.get<ApiResponse<null>>('/api/auth/check-email', { params: { email } }),

  // 닉네임 중복 확인 — GET /api/auth/check-nickname
  checkNickname: (nickname: string) =>
    apiClient.get<ApiResponse<null>>('/api/auth/check-nickname', { params: { nickname } }),
};
