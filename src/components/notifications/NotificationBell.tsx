'use client';

import { useEffect, useRef, useState } from 'react';
import { useNotificationStore } from '@/store/notificationStore';
import { useFriendStore } from '@/store/friendStore';
import { useTeamStore } from '@/store/teamStore';
import { friendService } from '@/services/friend';
import { teamService } from '@/services/team';
import UserProfileModal, { type ProfileTarget } from '@/components/user/UserProfileModal';
import TeamInfoModal from '@/components/team/TeamInfoModal';
import type { TeamItem } from '@/types/team';
import styles from './NotificationBell.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

type TabType = 'all' | 'friend' | 'team';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [profileTarget, setProfileTarget] = useState<ProfileTarget | null>(null);
  const [viewingTeam, setViewingTeam] = useState<TeamItem | null>(null);
  const [readCount, setReadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { pendingRequests, setPendingRequests, removeRequest, teamInvitations, setTeamInvitations, removeTeamInvitation } =
    useNotificationStore();
  const addFriend = useFriendStore((s) => s.addFriend);
  const addTeam = useTeamStore((s) => s.addTeam);

  const totalCount = pendingRequests.length + teamInvitations.length;
  const unreadBadge = Math.max(0, totalCount - readCount);

  useEffect(() => {
    friendService.getPendingRequests().then(setPendingRequests).catch(() => {});
  }, [setPendingRequests]);

  useEffect(() => {
    teamService.getMyInvitations().then(setTeamInvitations).catch(() => {});
  }, [setTeamInvitations]);

  useEffect(() => {
    if (open) setReadCount(totalCount);
  }, [open, totalCount]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (profileTarget || viewingTeam) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, profileTarget, viewingTeam]);

  const handleAcceptFriend = async (friendIdx: number) => {
    const req = pendingRequests.find((r) => r.friendIdx === friendIdx);
    try {
      await friendService.acceptRequest(friendIdx);
      removeRequest(friendIdx);
      if (req) addFriend(req);
    } catch {
      // 서버 오류 무시
    }
  };

  const handleRejectFriend = async (friendIdx: number) => {
    if (!confirm('친구 요청을 거절하시겠습니까?')) return;
    try {
      await friendService.rejectRequest(friendIdx);
      removeRequest(friendIdx);
    } catch {
      // 서버 오류 무시
    }
  };

  const handleAcceptTeam = async (tmIdx: number) => {
    try {
      const team = await teamService.acceptInvitation(tmIdx);
      removeTeamInvitation(tmIdx);
      addTeam(team);
    } catch {
      // 서버 오류 무시
    }
  };

  const handleRejectTeam = async (tmIdx: number) => {
    if (!confirm('팀 초대를 거절하시겠습니까?')) return;
    try {
      await teamService.rejectInvitation(tmIdx);
      removeTeamInvitation(tmIdx);
    } catch {
      // 서버 오류 무시
    }
  };

  const handleViewProfile = (req: { userId: string; nickname: string; email: string }) => {
    setProfileTarget({ userId: req.userId, nickname: req.nickname, email: req.email });
  };

  // 팀 초대 클릭 → 팀 정보 보기(qa 항목20)
  const handleViewTeam = async (teamIdx: number) => {
    try {
      const team = await teamService.getTeamInfo(teamIdx);
      setViewingTeam(team);
    } catch {
      // 조회 실패 무시
    }
  };

  const visibleFriends = activeTab === 'all' || activeTab === 'friend' ? pendingRequests : [];
  const visibleTeams   = activeTab === 'all' || activeTab === 'team'   ? teamInvitations : [];
  const visibleTotal   = visibleFriends.length + visibleTeams.length;

  return (
    <>
    {profileTarget && (
      <UserProfileModal
        user={profileTarget}
        onClose={() => setProfileTarget(null)}
      />
    )}
    {viewingTeam && (
      <TeamInfoModal
        team={viewingTeam}
        onClose={() => setViewingTeam(null)}
      />
    )}
    <div ref={containerRef} className={styles.container}>
      <button
        className={`${styles.bell} ${open ? styles.bellActive : ''}`}
        onClick={() => {
          if (!open) setReadCount(totalCount);
          setOpen((v) => !v);
        }}
        title="알림"
      >
        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadBadge > 0 && (
          <span className={styles.badge}>{unreadBadge > 99 ? '99+' : unreadBadge}</span>
        )}
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <span className={styles.dropdownTitle}>알림</span>
          </div>

          {/* 탭 */}
          <div className={styles.tabs}>
            {(['all', 'friend', 'team'] as TabType[]).map(t => {
              const count = t === 'all' ? totalCount : t === 'friend' ? pendingRequests.length : teamInvitations.length;
              return (
                <button
                  key={t}
                  className={`${styles.tab} ${activeTab === t ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab(t)}
                >
                  {t === 'all' ? '전체' : t === 'friend' ? '친구' : '팀'}
                  {count > 0 && <span className={styles.tabBadge}>{count}</span>}
                </button>
              );
            })}
          </div>

          {visibleTotal === 0 ? (
            <div className={styles.empty}>새 알림이 없습니다.</div>
          ) : (
            <div className={styles.list}>
              {visibleFriends.map((req) => (
                <div key={req.friendIdx} className={styles.item}>
                  {req.avatarUrl ? (
                    <img
                      className={`${styles.avatar} ${styles.avatarClickable}`}
                      src={`${API_BASE}${req.avatarUrl}`}
                      alt={req.nickname}
                      style={{ objectFit: 'cover' }}
                      onClick={() => handleViewProfile(req)}
                      title="프로필 보기"
                    />
                  ) : (
                    <div
                      className={`${styles.avatar} ${styles.avatarClickable}`}
                      onClick={() => handleViewProfile(req)}
                      title="프로필 보기"
                    >{req.nickname[0]}</div>
                  )}
                  <div className={styles.info}>
                    <span
                      className={`${styles.name} ${styles.nameClickable}`}
                      onClick={() => handleViewProfile(req)}
                    >{req.nickname}</span>
                    <span className={styles.desc}>친구 요청을 보냈습니다.</span>
                  </div>
                  <div className={styles.actions}>
                    <button className={styles.acceptBtn} onClick={() => handleAcceptFriend(req.friendIdx)}>수락</button>
                    <button className={styles.rejectBtn} onClick={() => handleRejectFriend(req.friendIdx)}>거절</button>
                  </div>
                </div>
              ))}

              {visibleTeams.length > 0 && visibleFriends.length > 0 && (
                <div className={styles.divider} />
              )}

              {visibleTeams.map((inv) => (
                <div key={inv.tmIdx} className={styles.item}>
                  <div
                    className={`${styles.teamIcon} ${styles.avatarClickable}`}
                    onClick={() => handleViewTeam(inv.teamIdx)}
                    title="팀 정보 보기"
                  >
                    {inv.teamName[0]}
                  </div>
                  <div className={styles.info}>
                    <span
                      className={`${styles.name} ${styles.nameClickable}`}
                      onClick={() => handleViewTeam(inv.teamIdx)}
                    >{inv.teamName}</span>
                    <span className={styles.desc}>팀 초대가 왔습니다.</span>
                  </div>
                  <div className={styles.actions}>
                    <button className={styles.acceptBtn} onClick={() => handleAcceptTeam(inv.tmIdx)}>수락</button>
                    <button className={styles.rejectBtn} onClick={() => handleRejectTeam(inv.tmIdx)}>거절</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}
