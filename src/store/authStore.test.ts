import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ accessToken: null, user: null });
});

describe('authStore', () => {
  it('setAuth 는 accessToken 과 user 를 함께 설정한다', () => {
    useAuthStore.getState().setAuth('tok', { userId: 'u', nickname: 'n', email: 'e@t.com' });
    expect(useAuthStore.getState().accessToken).toBe('tok');
    expect(useAuthStore.getState().user?.userId).toBe('u');
  });

  it('setAccessToken 은 accessToken 만 교체하고 user 는 유지한다', () => {
    useAuthStore.getState().setAuth('old', { userId: 'u', nickname: 'n', email: 'e@t.com' });
    useAuthStore.getState().setAccessToken('new');
    expect(useAuthStore.getState().accessToken).toBe('new');
    expect(useAuthStore.getState().user?.userId).toBe('u');
  });

  it('updateUser 는 user 가 있을 때만 부분 병합한다', () => {
    useAuthStore.getState().setAuth('tok', { userId: 'u', nickname: 'old', email: 'e@t.com' });
    useAuthStore.getState().updateUser({ nickname: 'new' });
    expect(useAuthStore.getState().user?.nickname).toBe('new');
    expect(useAuthStore.getState().user?.email).toBe('e@t.com');
  });

  it('updateUser 는 user 가 null 이면 무시한다', () => {
    useAuthStore.setState({ accessToken: null, user: null });
    useAuthStore.getState().updateUser({ nickname: 'x' });
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('clear 는 토큰과 user 를 모두 비운다', () => {
    useAuthStore.getState().setAuth('tok', { userId: 'u', nickname: 'n', email: 'e@t.com' });
    useAuthStore.getState().clear();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('persist 는 accessToken 을 저장하지 않는다 (보안: 메모리 전용)', async () => {
    useAuthStore.getState().setAuth('secret-token', { userId: 'u', nickname: 'n', email: 'e@t.com' });
    await Promise.resolve(); // persist 기록 tick 대기
    const raw = localStorage.getItem('collab-auth');
    expect(raw).not.toBeNull();
    expect(raw).not.toContain('secret-token'); // accessToken 은 빠져야 함
    expect(raw).toContain('"user"'); // user 는 저장됨
  });
});
