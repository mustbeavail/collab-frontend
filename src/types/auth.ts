export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  userId: string;
  nickname: string;
  email: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  nickname: string;
}

export interface UserInfo {
  userId: string;
  nickname: string;
  email: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  data: T;
}
