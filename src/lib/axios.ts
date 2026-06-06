import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

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

// single-flight: 동시에 여러 401이 와도 refresh는 1번만 호출
let refreshPromise: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = axios
    .post<{ data: { accessToken: string } }>(
      `${BASE_URL}/api/auth/refresh`,
      {},
      { withCredentials: true }
    )
    .then(({ data }) => {
      const newAccessToken = data.data.accessToken;
      useAuthStore.getState().setAccessToken(newAccessToken);
      return newAccessToken;
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
        const newAccessToken = await doRefresh();
        original.headers.Authorization = `Bearer ${newAccessToken}`;
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
