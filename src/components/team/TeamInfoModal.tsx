'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './TeamInfoModal.module.css';
import type { TeamItem } from '@/types/team';
import type { UserSearchResult } from '@/types/user';
import { teamService } from '@/services/team';
import { userService } from '@/services/user';
import { useTeamStore } from '@/store/teamStore';
import UserProfileModal, { type ProfileTarget } from '@/components/user/UserProfileModal';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

const ROLE_LABEL: Record<string, string> = {
  LEADER: '리더',
  MANAGER: '매니저',
  MEMBER: '멤버',
};

const ROLE_PRIORITY: Record<string, number> = {
  LEADER: 3,
  MANAGER: 2,
  MEMBER: 1,
};

interface Props {
  team: TeamItem;
  onClose: () => void;
  onEdit?: () => void;
  initialInviteOpen?: boolean;
}

export default function TeamInfoModal({ team, onClose, onEdit, initialInviteOpen }: Props) {
  const updateTeamInStore = useTeamStore((s) => s.updateTeamInStore);

  const canEdit = team.myRole === 'LEADER' || team.myRole === 'MANAGER';
  const canInvite = team.myRole === 'LEADER' || team.myRole === 'MANAGER';
  const isLeader = team.myRole === 'LEADER';
  const myPriority = ROLE_PRIORITY[team.myRole] ?? 1;

  const [viewingProfile, setViewingProfile] = useState<ProfileTarget | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(initialInviteOpen ?? false);

  // 친구검색식 멤버 초대(qa 항목14)
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const memberIds = new Set(team.members.map((m) => m.userId));

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQ.trim()) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(() => {
      setSearchLoading(true);
      userService.searchUsers(searchQ.trim())
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQ]);

  const openMemberProfile = (userId: string, nickname: string) => {
    setViewingProfile({ userId, nickname, email: userId });
  };

  const handleInviteUser = async (targetUserId: string) => {
    setInviteError('');
    try {
      await teamService.inviteMember(team.teamIdx, targetUserId);
      setInvitedIds((prev) => new Set([...prev, targetUserId]));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setInviteError(msg ?? '초대 중 오류가 발생했습니다.');
    }
  };

  const handleKick = async (userId: string, nickname: string) => {
    if (!confirm(`${nickname}님을 팀에서 추방하시겠습니까?`)) return;
    try {
      await teamService.kickMember(team.teamIdx, userId);
      const updated = await teamService.getMyTeams();
      const found = updated.find((t) => t.teamIdx === team.teamIdx);
      if (found) updateTeamInStore(found);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? '추방 중 오류가 발생했습니다.');
    }
  };

  const handleRoleChange = async (userId: string, nickname: string, currentRole: string, newRole: string) => {
    if (newRole === currentRole) return;
    // 권한 변경 시 강등/상승 상관없이 컨펌(qa 항목18)
    const label = ROLE_LABEL[newRole] ?? newRole;
    if (!confirm(`${nickname}님의 역할을 '${label}'(으)로 변경하시겠습니까?`)) return;
    try {
      const updated = await teamService.changeRole(team.teamIdx, userId, newRole);
      updateTeamInStore(updated);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? '역할 변경 중 오류가 발생했습니다.');
    }
  };

  return (
    <>
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>팀 정보</h2>
          <div className={styles.headerActions}>
            {canEdit && (
              <button className={styles.editBtn} onClick={onEdit} title="팀 수정">
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            <button className={styles.closeBtn} onClick={onClose}>
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {/* 팀 아바타 + 이름 */}
          <div className={styles.teamIdentity}>
            <div className={styles.teamAvatar}>{team.teamName[0]}</div>
            <div>
              <p className={styles.teamName}>{team.teamName}</p>
            </div>
          </div>

          {/* 소개 */}
          {team.about && (
            <div className={styles.section}>
              <p className={styles.sectionLabel}>소개</p>
              <p className={styles.aboutText}>{team.about}</p>
            </div>
          )}

          {/* 멤버 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionLabel}>멤버 {team.members.length}명</p>
              {canInvite && (
                <button
                  className={styles.inviteBtn}
                  onClick={() => { setInviteOpen((v) => !v); setInviteError(''); }}
                >
                  {inviteOpen ? '취소' : '+ 초대'}
                </button>
              )}
            </div>

            {/* 멤버 초대 — 친구검색식(qa 항목14): 이메일 직접입력 대신 검색해서 초대 */}
            {inviteOpen && (
              <div className={styles.inviteForm} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                <input
                  className={styles.inviteInput}
                  type="text"
                  placeholder="닉네임 또는 이메일 검색"
                  value={searchQ}
                  onChange={(e) => { setSearchQ(e.target.value); setInviteError(''); }}
                  autoFocus
                />
                {searchLoading && <p className={styles.inviteHint}>검색 중...</p>}
                {!searchLoading && searchQ.trim() && searchResults.length === 0 && (
                  <p className={styles.inviteHint}>검색 결과가 없습니다.</p>
                )}
                {searchResults.map((u) => {
                  const already = memberIds.has(u.userId);
                  const invited = invitedIds.has(u.userId);
                  return (
                    <div key={u.userId} className={styles.inviteResultRow}>
                      <div className={styles.inviteResultProfile}>
                        {u.avatarUrl
                          ? <img src={`${API_BASE}${u.avatarUrl}`} alt="" className={styles.inviteResultAvatar} />
                          : <div className={styles.inviteResultAvatar}>{u.nickname?.[0] ?? '?'}</div>}
                        <div className={styles.inviteResultInfo}>
                          <span className={styles.inviteResultName}>{u.nickname}</span>
                          <span className={styles.inviteResultEmail}>{u.userId}</span>
                        </div>
                      </div>
                      {already ? (
                        <span className={styles.inviteTag}>멤버</span>
                      ) : invited ? (
                        <span className={styles.inviteTag}>초대됨</span>
                      ) : (
                        <button className={styles.inviteSendBtn} onClick={() => handleInviteUser(u.userId)}>초대</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {inviteError && <p className={styles.inviteError}>{inviteError}</p>}

            <div className={styles.memberList}>
              {team.members.map((m) => {
                const isSelf = false; // userId 비교는 서버에서 처리
                const targetPriority = ROLE_PRIORITY[m.role] ?? 1;
                const canKick = (team.myRole === 'LEADER' || team.myRole === 'MANAGER')
                  && myPriority > targetPriority;
                const canChangeRole = isLeader;

                return (
                  <div key={m.userId} className={styles.memberRow}>
                    <button
                      className={styles.memberProfile}
                      onClick={() => openMemberProfile(m.userId, m.nickname)}
                      title={`${m.nickname} 프로필 보기`}
                    >
                      <div className={styles.memberAvatar}>{m.nickname?.[0] ?? '?'}</div>
                      <span className={styles.memberName}>{m.nickname}</span>
                    </button>

                    <div className={styles.memberActions}>
                      {canChangeRole ? (
                        <select
                          className={styles.roleSelect}
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.userId, m.nickname, m.role, e.target.value)}
                          title="역할 변경"
                        >
                          <option value="LEADER">리더</option>
                          <option value="MANAGER">매니저</option>
                          <option value="MEMBER">멤버</option>
                        </select>
                      ) : (
                        <span className={styles.memberRole}>{ROLE_LABEL[m.role] ?? m.role}</span>
                      )}

                      {canKick && (
                        <button
                          className={styles.kickBtn}
                          onClick={() => handleKick(m.userId, m.nickname)}
                          title={`${m.nickname} 추방`}
                        >
                          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                              d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 채널 */}
          <div className={styles.section}>
            <p className={styles.sectionLabel}>채팅방 {team.channels.length}개</p>
            <div className={styles.channelList}>
              {team.channels.map((ch) => (
                <div key={ch.roomIdx} className={styles.channelRow}>
                  <span className={styles.channelHash}>#</span>
                  <span>{ch.roomName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>

    {viewingProfile && (
      <UserProfileModal
        user={viewingProfile}
        onClose={() => setViewingProfile(null)}
      />
    )}
    </>
  );
}
