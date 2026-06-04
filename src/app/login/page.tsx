'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/auth';
import { useAuthStore } from '@/store/authStore';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { accessToken, setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (accessToken) router.replace('/');
  }, [accessToken, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authService.login({ email, password });
      setAuth(data.accessToken, data.refreshToken, {
        userId: data.userId,
        nickname: data.nickname,
        email: data.email,
      });
      router.replace('/');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? '이메일 또는 비밀번호가 올바르지 않습니다.');
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
