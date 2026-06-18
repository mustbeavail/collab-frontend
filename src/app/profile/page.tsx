'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/auth';
import { userService } from '@/services/user';
import AuthGuard from '@/components/auth/AuthGuard';
import { StompProvider } from '@/providers/StompProvider';
import styles from './profile.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

function ProfileContent() {
  const router = useRouter();
  const { user, updateUser, clear } = useAuthStore();

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [originalNickname, setOriginalNickname] = useState(user?.nickname ?? '');
  const [about, setAbout] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPwConfirm, setNewPwConfirm] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [nickChecked, setNickChecked] = useState<'idle' | 'ok' | 'dup'>('idle');
  const [nickCheckMsg, setNickCheckMsg] = useState('');
  const [nickChecking, setNickChecking] = useState(false);
  const [avatarEnlarged, setAvatarEnlarged] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    userService.getProfile().then((profile) => {
      setAbout(profile.about ?? '');
      setAvatarUrl(profile.avatarUrl ?? null);
      setNickname(profile.nickname);
      setOriginalNickname(profile.nickname);
    });
  }, []);

  const isNickChanged = nickname.trim() !== originalNickname;

  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNickname(e.target.value);
    setNickChecked('idle');
    setNickCheckMsg('');
  };

  const handleCheckNick = async () => {
    if (!nickname.trim()) return;
    setNickChecking(true);
    setNickCheckMsg('');
    try {
      const result = await userService.checkNickname(nickname.trim());
      if (result.available) {
        setNickChecked('ok');
        setNickCheckMsg('사용 가능한 닉네임입니다.');
      } else {
        setNickChecked('dup');
        setNickCheckMsg('이미 사용 중인 닉네임입니다.');
      }
    } catch {
      setNickCheckMsg('확인 중 오류가 발생했습니다.');
    } finally {
      setNickChecking(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!confirm('프로필 사진을 제거하시겠습니까?')) return;
    setAvatarUploading(true);
    setSaveError('');
    try {
      await userService.deleteAvatar();
      setAvatarUrl(null);
    } catch {
      setSaveError('사진 제거 중 오류가 발생했습니다.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setSaveError('');
    try {
      const url = await userService.uploadAvatar(file);
      setAvatarUrl(url);
    } catch {
      setSaveError('사진 업로드 중 오류가 발생했습니다.');
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMsg('');
    setSaveError('');

    if (isNickChanged && nickChecked !== 'ok') {
      setSaveError('닉네임 중복확인이 필요합니다.');
      return;
    }
    if (newPw && newPw !== newPwConfirm) {
      setSaveError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPw && currentPw && newPw === currentPw) {
      setSaveError('새 비밀번호가 현재 비밀번호와 동일합니다.');
      return;
    }

    setSaving(true);
    try {
      await userService.updateProfile({ nickname: nickname.trim(), about });
      if (newPw && currentPw) {
        await userService.changePassword({ currentPassword: currentPw, newPassword: newPw });
      }
      updateUser({ nickname: nickname.trim() });
      setOriginalNickname(nickname.trim());
      setNickChecked('idle');
      setNickCheckMsg('');
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
      await authService.logout();
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
              {avatarUrl ? (
                <img
                  src={`${API_BASE}${avatarUrl}`}
                  alt="프로필"
                  className={styles.avatarImg}
                  style={{ cursor: 'zoom-in' }}
                  onClick={() => setAvatarEnlarged(true)}
                  title="클릭하여 크게 보기"
                />
              ) : (
                <div className={styles.avatar}>{user?.nickname?.[0] ?? '?'}</div>
              )}
              <button
                className={styles.avatarEditBtn}
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
              >
                {avatarUploading ? (
                  <span style={{ fontSize: '0.625rem' }}>...</span>
                ) : (
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                )}
              </button>
              {/* 등록된 사진 제거(x) */}
              {avatarUrl && !avatarUploading && (
                <button
                  className={styles.avatarRemoveBtn}
                  type="button"
                  onClick={handleRemoveAvatar}
                  title="프로필 사진 제거"
                  aria-label="프로필 사진 제거"
                  style={{
                    position: 'absolute', top: 0, right: 0,
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--danger, #e5484d)', color: '#fff',
                    border: '2px solid var(--bg-surface, #fff)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', padding: 0,
                  }}
                >
                  <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <p
              className={styles.avatarHint}
              onClick={() => fileInputRef.current?.click()}
              style={{ cursor: 'pointer' }}
            >
              프로필 사진 변경
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
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
              <div className={styles.nicknameRow}>
                <input
                  type="text"
                  className={styles.input}
                  value={nickname}
                  onChange={handleNicknameChange}
                  maxLength={20}
                  required
                />
                <button
                  type="button"
                  className={styles.checkBtn}
                  onClick={handleCheckNick}
                  disabled={!isNickChanged || nickChecking}
                >
                  {nickChecking ? '확인 중' : '중복확인'}
                </button>
              </div>
              {nickCheckMsg && (
                <p className={styles.nickMsg} style={{ color: nickChecked === 'ok' ? 'var(--online)' : 'var(--danger)' }}>
                  {nickCheckMsg}
                </p>
              )}
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
                  placeholder="새 비밀번호"
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

      {/* 프로필 사진 확대 보기 */}
      {avatarEnlarged && avatarUrl && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
          onClick={() => setAvatarEnlarged(false)}
        >
          <img
            src={`${API_BASE}${avatarUrl}`}
            alt="프로필"
            style={{
              // 통일된 고정 정사각 박스 + 비율유지(contain). 원본 크기와 무관하게 동일 크기로 확대.
              width: 'min(90vw, 90vh, 420px)',
              height: 'min(90vw, 90vh, 420px)',
              borderRadius: 8,
              objectFit: 'contain',
              background: 'rgba(255,255,255,0.04)',
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      {/* 편집 중에도 WS 연결을 유지해 접속 상태가 끊기지 않게 한다(버그 항목7). */}
      <StompProvider>
        <ProfileContent />
      </StompProvider>
    </AuthGuard>
  );
}
