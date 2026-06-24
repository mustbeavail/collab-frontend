'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/auth';
import { demoService } from '@/services/demo';
import { useAuthStore } from '@/store/authStore';
import { useDemoStore } from '@/store/demoStore';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { accessToken, setAuth } = useAuthStore();
  const startDemo = useDemoStore((s) => s.start);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const handleDemo = async () => {
    if (demoLoading) return;
    setError('');
    setDemoLoading(true);
    try {
      const acc = await demoService.acquireAccount();
      setAuth(acc.accessToken, { userId: acc.userId, nickname: acc.nickname, email: acc.email });
      startDemo();
      router.replace('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? '시연을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.';
      setError(msg);
    } finally {
      setDemoLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) router.replace('/');
  }, [accessToken, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authService.login({ email, password });
      setAuth(data.accessToken, {
        userId: data.userId,
        nickname: data.nickname,
        email: data.email,
      });
      router.replace('/');
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { message?: string; errorCode?: string } } })?.response?.data;
      const errorCode = res?.errorCode;
      const msg = res?.message ?? '로그인에 실패했습니다.';
      setError(msg);
      if (errorCode === 'EMAIL_NOT_REGISTERED') {
        setEmail('');
      } else if (errorCode === 'INVALID_CREDENTIALS') {
        setPassword('');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.logoArea}>
          <div className={styles.logoIcon}>C</div>
          <span className={styles.logoText}>Collab</span>
        </div>

        <div className={styles.card}>
          <h1 className={styles.title}>로그인</h1>
          <p className={styles.subtitle}>다시 오신 것을 환영해요</p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div>
              <label className={styles.label}>이메일</label>
              <input
                type="email"
                placeholder="example@email.com"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className={styles.label}>비밀번호</label>
              <input
                type="password"
                placeholder="비밀번호 입력"
                className={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && <p className={styles.errorMsg}>{error}</p>}

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? '로그인 중...' : '로그인'}
            </button>

            <button
              type="button"
              className={styles.demoBtn}
              onClick={handleDemo}
              disabled={demoLoading}
            >
              {demoLoading ? '시연 준비 중...' : '🚀 기능 시연'}
            </button>
          </form>

          <p className={styles.footer}>
            계정이 없으신가요?{' '}
            <Link href="/signup" className={styles.link}>회원가입</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
