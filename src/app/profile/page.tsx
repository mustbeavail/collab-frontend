'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/auth';
import { userService } from '@/services/user';
import AuthGuard from '@/components/auth/AuthGuard';
import styles from './profile.module.css';

function ProfileContent() {
  const router = useRouter();
  const { user, refreshToken, updateUser, clear } = useAuthStore();

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [about, setAbout] = useState('');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPwConfirm, setNewPwConfirm] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMsg('');
    setSaveError('');

    if (newPw && newPw !== newPwConfirm) {
      setSaveError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPw && newPw.length < 8) {
      setSaveError('새 비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    setSaving(true);
    try {
      await userService.updateProfile({ nickname, about });
      if (newPw && currentPw) {
        await userService.changePassword({ currentPassword: currentPw, newPassword: newPw });
      }
      updateUser({ nickname });
      setSaveMsg('저장되었습니다.');
      setCurrentPw('');
      setNewPw('');
      setNewPwConfirm('');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSaveError(msg ?? '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('로그아웃하시겠습니까?')) return;
    try {
      if (refreshToken) await authService.logout(refreshToken);
    } finally {
      clear();
      router.replace('/login');
    }
  };

  const handleWithdraw = async () => {
    if (!confirm('정말 탈퇴하시겠습니까? 모든 데이터가 삭제됩니다.')) return;
    try {
      await userService.withdraw();
    } finally {
      clear();
      router.replace('/login');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link href="/" className={styles.backLink}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          돌아가기
        </Link>

        <div className={styles.card}>
          <div className={styles.avatarArea}>
            <div className={styles.avatarWrap}>
              <div className={styles.avatar}>{user?.nickname?.[0] ?? '?'}</div>
              <button className={styles.avatarEditBtn} type="button">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
            <p className={styles.avatarHint}>프로필 사진 변경</p>
          </div>

          <h1 className={styles.title}>회원정보 수정</h1>
          <p className={styles.subtitle}>내 계정 정보를 관리하세요</p>

          <form className={styles.form} onSubmit={handleSave}>
            <div>
              <label className={styles.label}>이메일</label>
              <input type="email" value={user?.email ?? ''} disabled className={styles.input} />
            </div>
            <div>
              <label className={styles.label}>닉네임</label>
              <input
                type="text"
                className={styles.input}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                required
              />
            </div>
            <div>
              <label className={styles.label}>소개</label>
              <textarea
                rows={3}
                className={styles.textarea}
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="자신을 소개해주세요"
                maxLength={500}
              />
            </div>

            <div className={styles.divider}>
              <p className={styles.sectionTitle}>비밀번호 변경</p>
              <div className={styles.pwFields}>
                <input
                  type="password"
                  placeholder="현재 비밀번호"
                  className={styles.input}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  autoComplete="current-password"
                />
                <input
                  type="password"
                  placeholder="새 비밀번호 (8자 이상)"
                  className={styles.input}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  autoComplete="new-password"
                />
                <input
                  type="password"
                  placeholder="새 비밀번호 확인"
                  className={styles.input}
                  value={newPwConfirm}
                  onChange={(e) => setNewPwConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {saveMsg && (
              <p style={{ color: 'var(--online)', fontSize: '0.8125rem' }}>{saveMsg}</p>
            )}
            {saveError && (
              <p style={{ color: 'var(--danger)', fontSize: '0.8125rem' }}>{saveError}</p>
            )}

            <button type="submit" className={styles.submitBtn} disabled={saving}>
              {saving ? '저장 중...' : '저장하기'}
            </button>
            <button type="button" className={styles.dangerBtn} onClick={handleLogout}>
              로그아웃
            </button>
            <button type="button" className={styles.dangerBtn} onClick={handleWithdraw}>
              회원 탈퇴
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}
