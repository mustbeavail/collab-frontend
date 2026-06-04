import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAuthStore } = require('@/store/authStore');
    const token: string | null = useAuthStore.getState().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useAuthStore } = require('@/store/authStore');
      const { refreshToken, setTokens, clear } = useAuthStore.getState();

      if (!refreshToken) {
        clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(
          `${BASE_URL}/api/auth/refresh`,
          { refreshToken }
        );
        const { accessToken: newAccess, refreshToken: newRefresh } = data.data;
        setTokens(newAccess, newRefresh);
        original.headers.Authorization = `Bearer ${newAccess}`;
        return apiClient(original);
      } catch {
        clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
