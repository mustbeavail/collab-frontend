import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import apiClient from './axios';
import { useAuthStore } from '@/store/authStore';

const BASE = 'http://localhost:8080';

let apiMock: MockAdapter;
let axiosMock: MockAdapter;
const mockLocation = { href: '' };

beforeEach(() => {
  // apiClient(요청/재시도)와 전역 axios(doRefresh)를 각각 mock
  apiMock = new MockAdapter(apiClient);
  axiosMock = new MockAdapter(axios);
  useAuthStore.setState({ accessToken: null, user: null });
  localStorage.clear();
  // window.location.href = '/login' 검증용 (jsdom location 우회)
  mockLocation.href = '';
  Object.defineProperty(window, 'location', { configurable: true, value: mockLocation });
});

afterEach(() => {
  apiMock.restore();
  axiosMock.restore();
});

describe('axios 인터셉터', () => {
  it('accessToken 이 있으면 Authorization 헤더를 붙인다', async () => {
    useAuthStore.setState({ accessToken: 'my-token', user: null });
    let captured: string | undefined;
    apiMock.onGet('/ping').reply((config) => {
      captured = config.headers?.Authorization as string;
      return [200, { ok: true }];
    });

    await apiClient.get('/ping');
    expect(captured).toBe('Bearer my-token');
  });

  it('401 을 받으면 refresh 후 원요청을 재시도한다', async () => {
    useAuthStore.setState({ accessToken: 'old', user: null });
    axiosMock.onPost(`${BASE}/api/auth/refresh`).reply(200, { data: { accessToken: 'fresh' } });
    apiMock.onGet('/data').replyOnce(401).onGet('/data').reply(200, { value: 42 });

    const res = await apiClient.get('/data');
    expect(res.data).toEqual({ value: 42 });
    // doRefresh 성공 시 setAccessToken('fresh') 가 호출됨
    expect(useAuthStore.getState().accessToken).toBe('fresh');
  });

  it('/api/auth/* 요청의 401 은 refresh 를 시도하지 않는다', async () => {
    useAuthStore.setState({ accessToken: 'x', user: null });
    let refreshCalled = false;
    axiosMock.onPost(`${BASE}/api/auth/refresh`).reply(() => {
      refreshCalled = true;
      return [200, { data: { accessToken: 'y' } }];
    });
    apiMock.onPost('/api/auth/login').reply(401);

    await expect(apiClient.post('/api/auth/login')).rejects.toBeDefined();
    expect(refreshCalled).toBe(false);
  });

  it('refresh 가 실패하면 clear 하고 /login 으로 보낸다', async () => {
    useAuthStore.setState({ accessToken: 'old', user: { userId: 'u', nickname: 'n', email: 'e@t.com' } });
    axiosMock.onPost(`${BASE}/api/auth/refresh`).reply(401);
    apiMock.onGet('/data').reply(401);

    await expect(apiClient.get('/data')).rejects.toBeDefined();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(mockLocation.href).toBe('/login');
  });

  it('동시 401 이어도 refresh 는 1회만 호출한다 (single-flight)', async () => {
    useAuthStore.setState({ accessToken: 'old', user: null });
    let refreshCount = 0;
    axiosMock.onPost(`${BASE}/api/auth/refresh`).reply(() => {
      refreshCount++;
      return [200, { data: { accessToken: 'fresh' } }];
    });
    apiMock.onGet('/a').replyOnce(401).onGet('/a').reply(200, { a: 1 });
    apiMock.onGet('/b').replyOnce(401).onGet('/b').reply(200, { b: 2 });

    await Promise.all([apiClient.get('/a'), apiClient.get('/b')]);
    expect(refreshCount).toBe(1);
  });
});
