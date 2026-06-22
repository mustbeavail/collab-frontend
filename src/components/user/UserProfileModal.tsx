'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
import styles from './UserProfileModal.module.css';
import { userService } from '@/services/user';
import { friendService } from '@/services/friend';
import type { UserPublicProfile } from '@/types/user';

export interface ProfileTarget {
  userId: string;
  nickname: string;
  email: string;
}

export interface ProfileAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface Props {
  user: ProfileTarget;
  onClose: () => void;
  onDm?: () => void;
  // 권한별 추가 액션(qa 항목17: 팀 멤버 추방/권한위임/채팅하기 등)
  actions?: ProfileAction[];
}

function formatJoinAt(raw?: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function UserProfileModal({ user, onClose, onDm, actions }: Props) {
  const [profile, setProfile] = useState<UserPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [enlarged, setEnlarged] = useState(false);
  // 친구 상태(I-1): NONE/SELF/FRIEND/SENT/RECEIVED. 친구 요청 후 즉시 SENT로 갱신.
  const [friendStatus, setFriendStatus] = useState<string>('NONE');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    setLoading(true);
    userService.getUserPublicProfile(user.userId)
      .then((p) => { setProfile(p); setFriendStatus(p.friendStatus ?? 'NONE'); })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [user.userId]);

  // 탈퇴 회원은 정보 일절 미표시(I-5)
  const isWithdrawn = profile?.withdrawn === true;
  const display = profile ?? user;
  const nickname = isWithdrawn ? '(탈퇴한 회원)' : display.nickname;
  const initial = nickname?.[0]?.toUpperCase() ?? '?';
  const joinDateStr = formatJoinAt(profile?.joinAt);

  const handleAddFriend = async () => {
    setRequesting(true);
    try {
      await friendService.sendRequest(user.userId);
      setFriendStatus('SENT');
    } catch {
      // 이미 관계 존재 등 — 요청됨으로 표시
      setFriendStatus('SENT');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} title="닫기">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* 아바타 (클릭 시 확대) — 탈퇴 회원은 사진 미표시 */}
        {!isWithdrawn && profile?.avatarUrl ? (
          <img
            className={styles.avatarImg}
            src={`${API_BASE}${profile.avatarUrl}`}
            alt={nickname}
            style={{ cursor: 'zoom-in' }}
            onClick={() => setEnlarged(true)}
            title="클릭하여 크게 보기"
          />
        ) : (
          <div className={styles.avatar}>{loading ? '…' : initial}</div>
        )}

        {/* 닉네임 */}
        <p className={styles.nickname}>{nickname}</p>

        {/* 아이디(=이메일) — 탈퇴 회원은 미표시(I-5) */}
        {!isWithdrawn && <p className={styles.userId}>{display.userId}</p>}

        {/* 구분선 */}
        <div className={styles.divider} />

        {/* 상세 정보 — 탈퇴 회원은 메일/자기소개/가입일 일절 미표시(I-5) */}
        {isWithdrawn ? (
          <div className={styles.infoList}>
            <div className={styles.infoRow}>
              <span className={`${styles.infoValue} ${styles.aboutEmpty}`}>탈퇴한 회원입니다.</span>
            </div>
          </div>
        ) : (
          <div className={styles.infoList}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>이메일</span>
              <span className={styles.infoValue}>{display.email}</span>
            </div>

            {loading && (
              <div className={styles.infoRow}>
                <span className={styles.loadingText}>불러오는 중...</span>
              </div>
            )}

            {!loading && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>자기소개</span>
                <span className={`${styles.infoValue} ${styles.about} ${!profile?.about ? styles.aboutEmpty : ''}`}>
                  {profile?.about || '자기소개가 없습니다.'}
                </span>
              </div>
            )}

            {!loading && joinDateStr && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>가입일</span>
                <span className={styles.infoValue}>{joinDateStr}</span>
              </div>
            )}
          </div>
        )}

        {/* 친구 추가(I-1) — 탈퇴/본인/이미친구 제외, 다른 회원일 때만 */}
        {!loading && !isWithdrawn && friendStatus !== 'SELF' && (
          <>
            {friendStatus === 'NONE' && (
              <button className={styles.dmBtn} onClick={handleAddFriend} disabled={requesting}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                {requesting ? '요청 중...' : '친구 추가'}
              </button>
            )}
            {friendStatus === 'SENT' && (
              <button className={styles.dmBtn} disabled style={{ opacity: 0.6, cursor: 'default' }}>
                친구 요청됨
              </button>
            )}
            {friendStatus === 'RECEIVED' && (
              <button className={styles.dmBtn} disabled style={{ opacity: 0.6, cursor: 'default' }}>
                받은 친구 요청 있음
              </button>
            )}
            {friendStatus === 'FRIEND' && (
              <button className={styles.dmBtn} disabled style={{ opacity: 0.6, cursor: 'default' }}>
                이미 친구입니다
              </button>
            )}
          </>
        )}

        {onDm && (
          <button className={styles.dmBtn} onClick={onDm}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            채팅 열기
          </button>
        )}

        {actions && actions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {actions.map((a, i) => (
              <button
                key={i}
                className={styles.dmBtn}
                onClick={a.onClick}
                style={a.danger ? { background: 'var(--danger, #e5484d)', color: '#fff' } : undefined}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 프로필 사진 확대 보기 */}
      {enlarged && profile?.avatarUrl && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
          onClick={(e) => { e.stopPropagation(); setEnlarged(false); }}
        >
          <img
            src={`${API_BASE}${profile.avatarUrl}`}
            alt={nickname}
            style={{
              // 통일된 고정 정사각 박스 + 비율유지(contain). 원본 크기와 무관하게 동일 크기.
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
