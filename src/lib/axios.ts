import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import type { ApiResponse, AuthResponse } from '@/types/auth';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // httpOnly 쿠키(refreshToken) 자동 전송
});

apiClient.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// single-flight: AuthGuard 마운트 복구와 401 인터셉터가 동시에 refresh를 불러도
// 네트워크 호출은 1번만 → single-use refresh 토큰을 두 번 소비해 401 나는 레이스 방지.
let refreshPromise: Promise<AuthResponse> | null = null;

export function refreshAuth(): Promise<AuthResponse> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = axios
    .post<ApiResponse<AuthResponse>>(
      `${BASE_URL}/api/auth/refresh`,
      {},
      { withCredentials: true }
    )
    .then(({ data }) => {
      const auth = data.data;
      useAuthStore.getState().setAuth(auth.accessToken, {
        userId: auth.userId,
        nickname: auth.nickname,
        email: auth.email,
      });
      return auth;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.startsWith('/api/auth/')
    ) {
      original._retry = true;
      try {
        const { accessToken } = await refreshAuth();
        original.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(original);
      } catch {
        useAuthStore.getState().clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
