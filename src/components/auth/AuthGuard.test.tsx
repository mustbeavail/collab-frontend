import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AuthGuard from './AuthGuard';
import { useAuthStore } from '@/store/authStore';

// next/navigation 의 useRouter 와 @/lib/axios 의 refreshAuth 를 가짜로 대체한다.
// AuthGuard 는 인터셉터와 동일한 single-flight refreshAuth 를 직접 호출한다.
// vi.hoisted 로 mock 함수를 먼저 만들어 hoisting 순서 문제를 피한다.
const { refreshMock, replaceMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock('@/lib/axios', () => ({
  refreshAuth: refreshMock,
  default: {},
}));

beforeEach(() => {
  refreshMock.mockReset();
  replaceMock.mockReset();
  // 실제 zustand store 를 쓰되 매 테스트마다 초기화
  useAuthStore.setState({ accessToken: null, user: null });
  localStorage.clear();
});

describe('AuthGuard 부트스트랩', () => {
  it('이미 토큰이 있으면 refresh 없이 자식을 렌더한다', async () => {
    useAuthStore.setState({
      accessToken: 'existing-token',
      user: { userId: 'u@test.com', nickname: 'nick', email: 'u@test.com' },
    });

    render(
      <AuthGuard>
        <div>보호된 화면</div>
      </AuthGuard>
    );

    expect(await screen.findByText('보호된 화면')).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('토큰이 없으면 refresh 로 복구한 뒤 자식을 렌더한다 (새로고침 시나리오)', async () => {
    // 실제 refreshAuth 는 성공 시 store 를 직접 갱신하므로 mock 도 동일하게 흉내낸다.
    refreshMock.mockImplementation(async () => {
      const auth = { accessToken: 'recovered-token', userId: 'u@test.com', nickname: 'nick', email: 'u@test.com' };
      useAuthStore.getState().setAuth(auth.accessToken, { userId: auth.userId, nickname: auth.nickname, email: auth.email });
      return auth;
    });

    render(
      <AuthGuard>
        <div>보호된 화면</div>
      </AuthGuard>
    );

    expect(await screen.findByText('보호된 화면')).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().accessToken).toBe('recovered-token');
    expect(useAuthStore.getState().user?.nickname).toBe('nick');
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('복구에 실패하면 /login 으로 이동한다', async () => {
    refreshMock.mockRejectedValue(new Error('refresh 쿠키 없음/만료'));

    render(
      <AuthGuard>
        <div>보호된 화면</div>
      </AuthGuard>
    );

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('보호된 화면')).not.toBeInTheDocument();
  });

  it('복구가 끝나기 전에는 로딩을 표시하고 자식을 감춘다', () => {
    refreshMock.mockReturnValue(new Promise(() => {})); // 계속 pending

    render(
      <AuthGuard>
        <div>보호된 화면</div>
      </AuthGuard>
    );

    expect(screen.getByText('불러오는 중...')).toBeInTheDocument();
    expect(screen.queryByText('보호된 화면')).not.toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('refresh 는 마운트 시 1회만 호출한다', async () => {
    refreshMock.mockImplementation(async () => {
      const auth = { accessToken: 'recovered-token', userId: 'u@test.com', nickname: 'nick', email: 'u@test.com' };
      useAuthStore.getState().setAuth(auth.accessToken, { userId: auth.userId, nickname: auth.nickname, email: auth.email });
      return auth;
    });

    render(
      <AuthGuard>
        <div>보호된 화면</div>
      </AuthGuard>
    );

    await screen.findByText('보호된 화면');
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
