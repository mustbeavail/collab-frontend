'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/auth';
import { userService } from '@/services/user';
import { useAuthStore } from '@/store/authStore';
import styles from './signup.module.css';

export default function SignupPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    email: '', password: '', passwordConfirm: '', nickname: '', about: '',
  });
  const [avatarFile, setAvatarFile]     = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [verifyCode, setVerifyCode]       = useState('');
  const [codeSent, setCodeSent]           = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [codeSending, setCodeSending]     = useState(false);
  const [codeVerifying, setCodeVerifying] = useState(false);
  const [codeError, setCodeError]         = useState('');
  const [codeSuccess, setCodeSuccess]     = useState('');

  const [nicknameChecked, setNicknameChecked]   = useState(false);
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(null);
  const [nicknameChecking, setNicknameChecking] = useState(false);
  const [nicknameCheckMsg, setNicknameCheckMsg] = useState('');

  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview); };
  }, [avatarPreview]);

  const setField = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (field === 'email') { setCodeSent(false); setEmailVerified(false); setCodeError(''); setCodeSuccess(''); }
      if (field === 'nickname') { setNicknameChecked(false); setNicknameAvailable(null); setNicknameCheckMsg(''); }
    };

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('이미지 파일만 선택할 수 있습니다.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('파일 크기는 5MB 이하여야 합니다.'); return; }
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError('');
  };

  const handleSendCode = async () => {
    if (!form.email) { setCodeError('이메일을 입력해주세요.'); return; }
    setCodeError(''); setCodeSuccess(''); setCodeSending(true);
    try {
      // 이메일 중복체크 먼저 수행
      await authService.checkEmail(form.email);
      await authService.sendEmailCode(form.email);
      setCodeSent(true);
      setCodeSuccess('인증코드를 발송했습니다. 이메일을 확인해주세요.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setCodeError(msg ?? '인증코드 발송에 실패했습니다.');
    } finally {
      setCodeSending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verifyCode) { setCodeError('인증코드를 입력해주세요.'); return; }
    setCodeError(''); setCodeVerifying(true);
    try {
      await authService.verifyEmailCode(form.email, verifyCode);
      setEmailVerified(true);
      setCodeSuccess('이메일 인증이 완료되었습니다.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setCodeError(msg ?? '인증코드가 올바르지 않습니다.');
    } finally {
      setCodeVerifying(false);
    }
  };

  const handleCheckNickname = async () => {
    if (!form.nickname) { setNicknameCheckMsg('닉네임을 입력해주세요.'); return; }
    setNicknameCheckMsg(''); setNicknameChecking(true);
    try {
      await authService.checkNickname(form.nickname);
      setNicknameChecked(true);
      setNicknameAvailable(true);
      setNicknameCheckMsg('사용 가능한 닉네임입니다.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setNicknameChecked(true);
      setNicknameAvailable(false);
      setNicknameCheckMsg(msg ?? '이미 사용 중인 닉네임입니다.');
    } finally {
      setNicknameChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!emailVerified) { setError('이메일 인증을 완료해주세요.'); return; }
    if (form.password !== form.passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    if (form.password.length < 8) { setError('비밀번호는 8자 이상이어야 합니다.'); return; }
    if (form.nickname.length > 20) { setError('닉네임은 20자 이하여야 합니다.'); return; }
    if (!nicknameChecked) { setError('닉네임 중복확인을 해주세요.'); return; }
    if (nicknameAvailable === false) { setError('사용할 수 없는 닉네임입니다.'); return; }

    setLoading(true);
    try {
      const data = await authService.signup({
        email: form.email,
        password: form.password,
        nickname: form.nickname,
        about: form.about || undefined,
      });
      setAuth(data.accessToken, data.refreshToken, {
        userId: data.userId,
        nickname: data.nickname,
        email: data.email,
      });

      if (avatarFile) {
        try { await userService.uploadAvatar(avatarFile); } catch { /* 사진 업로드 실패해도 가입은 유지 */ }
      }

      router.replace('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? '회원가입 중 오류가 발생했습니다.');
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
          <h1 className={styles.title}>회원가입</h1>
          <p className={styles.subtitle}>팀과 함께 시작하세요</p>

          {/* 프로필 사진 */}
          <div className={styles.avatarArea}>
            <button type="button" className={styles.avatarBtn} onClick={handleAvatarClick}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="프로필 미리보기" className={styles.avatarImg} />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              <div className={styles.avatarOverlay}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </button>
            <p className={styles.avatarHint}>프로필 사진 선택 (선택)</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className={styles.fileInput}
              onChange={handleAvatarChange}
            />
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            {/* 이메일 + 인증코드 발송 */}
            <div>
              <label className={styles.label}>이메일</label>
              <div className={styles.emailRow}>
                <input
                  type="email"
                  placeholder="example@email.com"
                  className={`${styles.input} ${emailVerified ? styles.inputVerified : ''}`}
                  value={form.email}
                  onChange={setField('email')}
                  required
                  disabled={emailVerified}
                  autoComplete="email"
                />
                {!emailVerified && (
                  <button
                    type="button"
                    className={styles.codeBtn}
                    onClick={handleSendCode}
                    disabled={codeSending}
                  >
                    {codeSending ? '확인 중...' : codeSent ? '재발송' : '인증코드 발송'}
                  </button>
                )}
                {emailVerified && (
                  <span className={styles.verifiedBadge}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    인증 완료
                  </span>
                )}
              </div>
            </div>

            {/* 인증코드 입력 */}
            {codeSent && !emailVerified && (
              <div>
                <label className={styles.label}>인증코드</label>
                <div className={styles.emailRow}>
                  <input
                    type="text"
                    placeholder="6자리 인증코드"
                    className={styles.input}
                    value={verifyCode}
                    onChange={(e) => { setVerifyCode(e.target.value); setCodeError(''); }}
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                  <button
                    type="button"
                    className={styles.codeBtn}
                    onClick={handleVerifyCode}
                    disabled={codeVerifying}
                  >
                    {codeVerifying ? '확인 중...' : '인증하기'}
                  </button>
                </div>
              </div>
            )}

            {codeSuccess && <p className={styles.successMsg}>{codeSuccess}</p>}
            {codeError   && <p className={styles.errorMsg}>{codeError}</p>}

            {/* 나머지 필드 */}
            <div>
              <label className={styles.label}>비밀번호</label>
              <input
                type="password"
                placeholder="8자 이상"
                className={styles.input}
                value={form.password}
                onChange={setField('password')}
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className={styles.label}>비밀번호 확인</label>
              <input
                type="password"
                placeholder="비밀번호 재입력"
                className={styles.input}
                value={form.passwordConfirm}
                onChange={setField('passwordConfirm')}
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className={styles.label}>닉네임</label>
              <div className={styles.emailRow}>
                <input
                  type="text"
                  placeholder="표시될 이름 (최대 20자)"
                  className={`${styles.input} ${nicknameAvailable === true ? styles.inputVerified : ''}`}
                  value={form.nickname}
                  onChange={setField('nickname')}
                  required
                />
                <button
                  type="button"
                  className={styles.codeBtn}
                  onClick={handleCheckNickname}
                  disabled={nicknameChecking || !form.nickname}
                >
                  {nicknameChecking ? '확인 중...' : nicknameAvailable === true ? '확인 완료' : '중복확인'}
                </button>
              </div>
              {nicknameCheckMsg && (
                <p className={nicknameAvailable === true ? styles.successMsg : styles.errorMsg}
                   style={{ marginTop: '6px' }}>
                  {nicknameCheckMsg}
                </p>
              )}
            </div>
            <div>
              <label className={styles.label}>소개 (선택)</label>
              <textarea
                placeholder="자신을 소개해주세요"
                rows={3}
                className={styles.textarea}
                value={form.about}
                onChange={setField('about')}
                maxLength={500}
              />
            </div>

            {error && <p className={styles.errorMsg}>{error}</p>}

            <button type="submit" className={styles.submitBtn} disabled={loading || !emailVerified}>
              {loading ? '처리 중...' : '가입하기'}
            </button>
          </form>

          <p className={styles.footer}>
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className={styles.link}>로그인</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
