'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/auth';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAuth = useAuthStore((s) => s.setAuth);

  // accessToken은 보안상 메모리에만 보관하므로 새로고침/새 탭이면 사라진다.
  // 마운트 시 httpOnly refresh 쿠키로 1회 복구를 시도하고, 끝날 때까지 로딩을 보여준다.
  const [bootstrapped, setBootstrapped] = useState(false);
  const attempted = useRef(false);

  // 1) 최초 마운트 시 1회만 refresh 복구 시도
  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (accessToken) {
      setBootstrapped(true);
      return;
    }

    authService
      .refresh()
      .then((data) => {
        setAuth(data.accessToken, {
          userId: data.userId,
          nickname: data.nickname,
          email: data.email,
        });
      })
      .catch(() => {
        // 복구 실패(쿠키 없음/만료) → 아래 가드 effect가 /login 으로 보낸다
      })
      .finally(() => {
        setBootstrapped(true);
      });
    // 마운트 시 1회만 실행 (accessToken 변동은 ref로 가드)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) 부트스트랩이 끝났는데 토큰이 없으면(복구 실패/로그아웃/만료) 로그인으로
  useEffect(() => {
    if (bootstrapped && !accessToken) {
      router.replace('/login');
    }
  }, [bootstrapped, accessToken, router]);

  if (!bootstrapped) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: '#888',
          fontSize: '0.9rem',
        }}
      >
        불러오는 중...
      </div>
    );
  }

  if (!accessToken) return null;
  return <>{children}</>;
}
