'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from './Sidebar.module.css';
import type { ChatInfo } from '@/app/page';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import { useTeamStore } from '@/store/teamStore';
import { friendService } from '@/services/friend';
import { userService } from '@/services/user';
import { teamService } from '@/services/team';
import type { FriendItem } from '@/types/friend';
import type { UserSearchResult } from '@/types/user';
import UserProfileModal, { type ProfileTarget } from '@/components/user/UserProfileModal';
import TeamModal from '@/components/team/TeamModal';
import TeamInfoModal from '@/components/team/TeamInfoModal';
import type { TeamItem } from '@/types/team';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

type MenuFriend  = { friend: FriendItem; x: number; y: number };
type MenuTeam    = { teamIdx: number; name: string; x: number; y: number };
type MenuChannel = { id: string; ch: string; x: number; y: number };

interface Props {
  openChatIds: string[];
  shakingChatId: string | null;
  onChatOpen: (chat: ChatInfo) => void;
}

export default function Sidebar({ openChatIds, shakingChatId, onChatOpen }: Props) {
  const user = useAuthStore((s) => s.user);
  const { friends, onlineUsers, loading: friendsLoading, setFriends, removeFriend, setOnlineUsers, setLoading: setFriendsLoading } = useFriendStore();
  const { teams, loading: teamsLoading, setTeams, setLoading: setTeamsLoading, addTeam, updateTeamInStore, removeTeam } = useTeamStore();

  const [selectedTeams,     setSelectedTeams]     = useState<Set<number>>(new Set<number>());
  const [openCategories,    setOpenCategories]    = useState<Set<string>>(new Set<string>());
  const [menuFriend,        setMenuFriend]        = useState<MenuFriend | null>(null);
  const [menuTeam,          setMenuTeam]          = useState<MenuTeam | null>(null);
  const [menuChannel,       setMenuChannel]       = useState<MenuChannel | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // 프로필 모달
  const [viewingUser, setViewingUser] = useState<ProfileTarget | null>(null);

  // 내 프로필 사진(좌하단 표시용)
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);

  // 내가 보낸 대기중 친구요청(qa 항목6)
  const [sentPending, setSentPending] = useState<FriendItem[]>([]);

  // 팀 모달
  type TeamModalState = { mode: 'create' } | { mode: 'edit'; team: TeamItem };
  const [teamModal,     setTeamModal]     = useState<TeamModalState | null>(null);
  const [viewingTeam,   setViewingTeam]   = useState<TeamItem | null>(null);

  // 친구 추가 검색 패널
  const [friendAddOpen,   setFriendAddOpen]   = useState(false);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [searchResults,   setSearchResults]   = useState<UserSearchResult[]>([]);
  const [searchLoading,   setSearchLoading]   = useState(false);
  const [sentRequests,    setSentRequests]    = useState<Set<string>>(new Set());
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setFriendsLoading(true);
    friendService.getFriends()
      .then((list) => {
        setFriends(list);
        return friendService.getOnlineStatuses();
      })
      .then((statuses) => {
        const onlineSet = new Set(
          Object.entries(statuses).filter(([, v]) => v).map(([k]) => k)
        );
        setOnlineUsers(onlineSet);
      })
      .catch(() => setFriends([]))
      .finally(() => setFriendsLoading(false));
  }, [setFriends, setOnlineUsers, setFriendsLoading]);

  // 내 프로필 사진 로드(마운트 시 1회 — /profile에서 변경 후 메인 복귀하면 리마운트로 갱신)
  useEffect(() => {
    userService.getProfile()
      .then((p) => setMyAvatarUrl(p.avatarUrl ?? null))
      .catch(() => setMyAvatarUrl(null));
  }, []);

  // 내가 보낸 대기중 요청 로드(qa 항목6)
  useEffect(() => {
    friendService.getSentRequests()
      .then(setSentPending)
      .catch(() => setSentPending([]));
  }, []);

  useEffect(() => {
    setTeamsLoading(true);
    teamService.getMyTeams()
      .then(setTeams)
      .catch(() => setTeams([]))
      .finally(() => setTeamsLoading(false));
  }, [setTeams, setTeamsLoading]);

  // 팀 로드 후 첫 번째 팀 자동 선택
  useEffect(() => {
    if (teams.length > 0 && selectedTeams.size === 0) {
      const firstIdx = teams[0].teamIdx;
      setSelectedTeams(new Set([firstIdx]));
      setOpenCategories(new Set([`${firstIdx}-channels`]));
    }
  }, [teams]);

  // 검색어 변경 시 300ms 디바운스
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(() => {
      setSearchLoading(true);
      userService.searchUsers(searchQuery.trim())
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  const toggleFriendAdd = () => {
    setFriendAddOpen((v) => {
      if (v) { setSearchQuery(''); setSearchResults([]); }
      return !v;
    });
  };

  const handleSendRequest = async (targetUserId: string) => {
    try {
      await friendService.sendRequest(targetUserId);
      setSentRequests((prev) => new Set([...prev, targetUserId]));
      // 보낸 대기중 목록 갱신(친구패널에 '대기중' 표시)
      friendService.getSentRequests().then(setSentPending).catch(() => {});
    } catch {
      setSentRequests((prev) => new Set([...prev, targetUserId]));
    }
  };

  const closeAllMenus = () => { setMenuFriend(null); setMenuTeam(null); setMenuChannel(null); };

  const toggleSection = (key: string) =>
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const toggleTeam = (idx: number) => {
    setSelectedTeams(prev => {
      const next = new Set(prev);
      if (next.has(idx)) { next.delete(idx); }
      else {
        next.add(idx);
        setOpenCategories(cats => new Set([...cats, `${idx}-channels`]));
      }
      return next;
    });
  };

  const toggleCategory = (key: string) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleChatOpen = (chat: ChatInfo) => onChatOpen(chat);

  const openFriendDm = (f: FriendItem) => {
    closeAllMenus();
    handleChatOpen({ id: `dm-${f.friendIdx}`, name: f.nickname, type: 'dm', targetUserId: f.userId });
  };

  const handleCreateTeam = async (teamName: string, about: string) => {
    const created = await teamService.createTeam({ teamName, about: about || undefined });
    addTeam(created);
    setSelectedTeams(prev => new Set([...prev, created.teamIdx]));
    setOpenCategories(prev => new Set([...prev, `${created.teamIdx}-channels`]));
  };

  const handleUpdateTeam = async (teamIdx: number, teamName: string, about: string) => {
    const updated = await teamService.updateTeam(teamIdx, { teamName, about: about || undefined });
    updateTeamInStore(updated);
  };

  const handleDeleteTeam = async (teamIdx: number) => {
    if (!confirm('팀을 삭제하면 모든 채널과 내용이 사라집니다. 정말 삭제하시겠습니까?')) return;
    closeAllMenus();
    try {
      await teamService.deleteTeam(teamIdx);
      removeTeam(teamIdx);
      setSelectedTeams(prev => { const n = new Set(prev); n.delete(teamIdx); return n; });
    } catch {
      // 실패 시 변경 없음
    }
  };

  const handleLeaveTeam = async (teamIdx: number) => {
    if (!confirm('팀을 나가면 모든 채팅 내역에 접근할 수 없습니다. 정말 나가시겠습니까?')) return;
    closeAllMenus();
    try {
      await teamService.leaveTeam(teamIdx);
      removeTeam(teamIdx);
      setSelectedTeams(prev => { const n = new Set(prev); n.delete(teamIdx); return n; });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? '팀 나가기 중 오류가 발생했습니다.');
    }
  };

  const handleJoinChannel = async (teamIdx: number, roomIdx: number) => {
    try {
      const updated = await teamService.joinChannel(teamIdx, roomIdx);
      updateTeamInStore(updated);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? '채널 참여 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteFriend = async (friendIdx: number) => {
    if (!confirm('정말 친구를 삭제하시겠습니까?')) return;
    try {
      await friendService.deleteFriend(friendIdx);
      removeFriend(friendIdx);
    } catch {
      // 삭제 실패 시 메뉴만 닫음
    }
    closeAllMenus();
  };

  const openContextMenu = (f: FriendItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    closeAllMenus();
    setMenuFriend({ friend: f, x: rect.right + 8, y: rect.top });
  };

  const openTeamMenu = (teamIdx: number, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    closeAllMenus();
    setMenuTeam({ teamIdx, name, x: rect.right + 8, y: rect.top });
  };

  const openChannelMenu = (id: string, ch: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    closeAllMenus();
    setMenuChannel({ id, ch, x: rect.right + 8, y: rect.top });
  };

  // 아바타: 사진 있으면 이미지, 없으면 닉네임 첫 글자(qa 항목9)
  const Avatar = ({ url, name, className }: { url?: string | null; name: string; className: string }) =>
    url ? (
      <img className={className} src={`${API_BASE}${url}`} alt={name} style={{ objectFit: 'cover' }} />
    ) : (
      <div className={className}>{name[0]}</div>
    );

  const DotsIcon = () => (
    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
    </svg>
  );

  return (
    <>
    <aside className={styles.sidebar}>
      {/* 헤더 */}
      <div className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>C</div>
          <span className={styles.logoText}>Collab</span>
        </div>
      </div>

      <div className={styles.scrollArea}>
        {/* ─── 팀 ─── */}
        <div>
          <button className={styles.sectionHeader} onClick={() => toggleSection('teams')}>
            <span className={styles.sectionLabel}>팀</span>
            <svg className={`${styles.sectionChevron} ${collapsedSections.has('teams') ? '' : styles.sectionChevronOpen}`}
              width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {!collapsedSections.has('teams') && <div className={styles.itemList}>
            {teamsLoading && <div className={styles.loadingText}>불러오는 중...</div>}
            {!teamsLoading && teams.map(team => (
              <div key={team.teamIdx}>
                {/* 팀 행: 토글 버튼 + 점세개 버튼 */}
                <div className={styles.teamRow}>
                  <button
                    onClick={() => toggleTeam(team.teamIdx)}
                    className={`${styles.teamBtn} ${selectedTeams.has(team.teamIdx) ? styles.teamBtnActive : ''}`}
                  >
                    <div className={`${styles.teamAvatar} ${selectedTeams.has(team.teamIdx) ? styles.teamAvatarActive : ''}`}>
                      {team.teamName[0]}
                    </div>
                    <span className={styles.teamName}>{team.teamName}</span>
                    <svg
                      className={`${styles.teamChevron} ${selectedTeams.has(team.teamIdx) ? styles.teamChevronOpen : ''}`}
                      width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button
                    className={styles.dotBtn}
                    onClick={e => openTeamMenu(team.teamIdx, team.teamName, e)}
                    title="팀 메뉴"
                  >
                    <DotsIcon />
                  </button>
                </div>

                {selectedTeams.has(team.teamIdx) && (
                  <div className={styles.teamBody}>

                    {/* 채팅방 카테고리 */}
                    <button className={styles.categoryHeader} onClick={() => toggleCategory(`${team.teamIdx}-channels`)}>
                      <svg className={`${styles.catChevron} ${openCategories.has(`${team.teamIdx}-channels`) ? styles.catChevronOpen : ''}`}
                        width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                      채팅방
                      <span className={styles.categoryCount}>{team.channels.length}</span>
                    </button>
                    {openCategories.has(`${team.teamIdx}-channels`) && (
                      <div className={styles.categoryItems}>
                        {team.channels.map(ch => {
                          const id = `channel-${team.teamIdx}-${ch.roomIdx}`;
                          const isOpen    = openChatIds.includes(id);
                          const isShaking = shakingChatId === id;
                          if (!ch.joined) {
                            return (
                              <div key={ch.roomIdx} className={styles.channelRow}>
                                <button
                                  className={[styles.channelItem, styles.channelItemLocked].join(' ')}
                                  onClick={() => handleJoinChannel(team.teamIdx, ch.roomIdx)}
                                  title="클릭하여 채널 참여"
                                >
                                  <span className={styles.channelHash}>#</span>
                                  <span>{ch.roomName}</span>
                                  <span className={styles.joinBadge}>참여</span>
                                </button>
                              </div>
                            );
                          }
                          return (
                            <div key={ch.roomIdx} className={styles.channelRow}>
                              <button
                                className={[styles.channelItem, isOpen ? styles.channelItemOpen : '', isShaking ? styles.shaking : ''].join(' ')}
                                onClick={() => handleChatOpen({ id, name: ch.roomName, type: 'channel' })}
                              >
                                <span className={styles.channelHash}>#</span>
                                <span>{ch.roomName}</span>
                              </button>
                              <button
                                className={styles.dotBtn}
                                onClick={e => openChannelMenu(id, ch.roomName, e)}
                                title="채팅방 메뉴"
                              >
                                <DotsIcon />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 멤버 카테고리 */}
                    <button className={styles.categoryHeader} onClick={() => toggleCategory(`${team.teamIdx}-members`)}>
                      <svg className={`${styles.catChevron} ${openCategories.has(`${team.teamIdx}-members`) ? styles.catChevronOpen : ''}`}
                        width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                      멤버
                      <span className={styles.categoryCount}>{team.members.length}</span>
                    </button>
                    {openCategories.has(`${team.teamIdx}-members`) && (
                      <div className={styles.categoryItems}>
                        {team.members.map(m => (
                          <button
                            key={m.userId}
                            className={styles.memberItem}
                            onClick={() => setViewingUser({ userId: m.userId, nickname: m.nickname, email: m.userId })}
                            title={`${m.nickname} 프로필 보기`}
                          >
                            <div className={styles.memberAvatarWrap}>
                              <div className={styles.memberAvatar}>{m.nickname[0]}</div>
                              <div className={`${styles.memberDot} ${styles.offline}`} />
                            </div>
                            <div className={styles.memberInfo}>
                              <span className={styles.memberName}>{m.nickname}</span>
                              {m.role && <span className={styles.memberRole}>{m.role}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 일정 카테고리 */}
                    <button className={styles.categoryHeader} onClick={() => toggleCategory(`${team.teamIdx}-schedule`)}>
                      <svg className={`${styles.catChevron} ${openCategories.has(`${team.teamIdx}-schedule`) ? styles.catChevronOpen : ''}`}
                        width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                      일정
                      <span className={styles.categoryCount}>0</span>
                    </button>

                  </div>
                )}
              </div>
            ))}

            <button className={styles.addBtn} onClick={() => setTeamModal({ mode: 'create' })}>
              <div className={styles.addIcon}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className={styles.addText}>팀 만들기</span>
            </button>
          </div>}
          <div className={styles.sectionDivider} />
        </div>

        {/* ─── 채팅방 ─── */}
        <div>
          <button className={styles.sectionHeader} onClick={() => toggleSection('channels')}>
            <span className={styles.sectionLabel}>채팅방</span>
            <svg className={`${styles.sectionChevron} ${collapsedSections.has('channels') ? '' : styles.sectionChevronOpen}`}
              width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {!collapsedSections.has('channels') && (
            <div className={styles.itemList}>
              {teams.flatMap(team =>
                team.channels.filter(ch => ch.joined).map(ch => {
                  const id = `channel-${team.teamIdx}-${ch.roomIdx}`;
                  const isOpen    = openChatIds.includes(id);
                  const isShaking = shakingChatId === id;
                  return (
                    <div key={id} className={styles.channelRow}>
                      <button
                        className={[styles.channelItem, isOpen ? styles.channelItemOpen : '', isShaking ? styles.shaking : ''].join(' ')}
                        onClick={() => handleChatOpen({ id, name: ch.roomName, type: 'channel' })}
                      >
                        <span className={styles.channelHash}>#</span>
                        <span>{ch.roomName}</span>
                      </button>
                      <button
                        className={styles.dotBtn}
                        onClick={e => openChannelMenu(id, ch.roomName, e)}
                        title="채팅방 메뉴"
                      >
                        <DotsIcon />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
          <div className={styles.sectionDivider} />
        </div>

        {/* ─── 친구 ─── */}
        <div>
          <div className={styles.friendSectionHeaderRow}>
            <button className={styles.sectionHeaderFriend} onClick={() => toggleSection('friends')}>
              <span className={styles.sectionLabel}>친구</span>
              <svg className={`${styles.sectionChevron} ${collapsedSections.has('friends') ? '' : styles.sectionChevronOpen}`}
                width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              className={`${styles.friendAddToggle} ${friendAddOpen ? styles.friendAddToggleActive : ''}`}
              onClick={toggleFriendAdd}
              title={friendAddOpen ? '닫기' : '친구 추가'}
            >
              {friendAddOpen
                ? <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                : <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
              }
            </button>
          </div>

          {!collapsedSections.has('friends') && (
            <div className={styles.itemList}>
              {/* 친구 추가 인라인 패널 */}
              {friendAddOpen && (
                <div className={styles.friendSearchPanel}>
                  <input
                    className={styles.friendSearchInput}
                    placeholder="닉네임 또는 이메일 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  {searchLoading && (
                    <div className={styles.searchStatus}>검색 중...</div>
                  )}
                  {!searchLoading && searchQuery.trim() && searchResults.length === 0 && (
                    <div className={styles.searchStatus}>검색 결과가 없습니다.</div>
                  )}
                  {searchResults.map((u) => {
                    const isAlreadyFriend = friends.some((f) => f.userId === u.userId);
                    const isSent = sentRequests.has(u.userId);
                    return (
                      <div key={u.userId} className={styles.searchResultItem}>
                        <button
                          className={styles.searchResultProfile}
                          onClick={() => setViewingUser(u)}
                          title="프로필 보기"
                        >
                          <Avatar url={u.avatarUrl} name={u.nickname} className={styles.searchResultAvatar} />
                          <div className={styles.searchResultInfo}>
                            <span className={styles.searchResultName}>{u.nickname}</span>
                            <span className={styles.searchResultEmail}>{u.email}</span>
                          </div>
                        </button>
                        {isAlreadyFriend ? (
                          <span className={styles.searchTag}>친구</span>
                        ) : isSent ? (
                          <span className={styles.searchTagSent}>요청됨</span>
                        ) : (
                          <button
                            className={styles.searchRequestBtn}
                            onClick={() => handleSendRequest(u.userId)}
                          >
                            요청
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {friendsLoading && (
                <div className={styles.loadingText}>불러오는 중...</div>
              )}
              {!friendsLoading && friends.map(f => {
                const isShaking = shakingChatId === `dm-${f.friendIdx}`;
                return (
                  <button
                    key={f.friendIdx}
                    className={[styles.friendItem, isShaking ? styles.shaking : ''].join(' ')}
                    onClick={e => openContextMenu(f, e)}
                  >
                    <div className={styles.avatarWrap}>
                      <Avatar url={f.avatarUrl} name={f.nickname} className={styles.friendAvatar} />
                      <div className={`${styles.statusDot} ${onlineUsers.has(f.userId) ? styles.online : styles.offline}`} />
                    </div>
                    <span className={styles.friendName}>{f.nickname}</span>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" className={styles.friendMenuIcon}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                );
              })}

              {/* 내가 보낸 대기중 요청(qa 항목6) — 아이디 표시 */}
              {sentPending.length > 0 && (
                <>
                  <div style={{ padding: '8px 12px 4px', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    보낸 요청 · 대기중
                  </div>
                  {sentPending.map((s) => (
                    <button
                      key={`sent-${s.friendIdx}`}
                      className={styles.friendItem}
                      onClick={() => setViewingUser({ userId: s.userId, nickname: s.nickname, email: s.email })}
                      title={`${s.nickname} 프로필 보기`}
                      style={{ opacity: 0.7 }}
                    >
                      <div className={styles.avatarWrap}>
                        <Avatar url={s.avatarUrl} name={s.nickname} className={styles.friendAvatar} />
                      </div>
                      <div className={styles.searchResultInfo}>
                        <span className={styles.friendName}>{s.nickname}</span>
                        <span className={styles.searchResultEmail}>{s.userId}</span>
                      </div>
                      <span className={styles.searchTagSent}>대기중</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
          <div className={styles.sectionDivider} />
        </div>
      </div>

      {/* 푸터 */}
      <div className={styles.footer}>
        <div className={styles.userCard}>
          <button
            type="button"
            className={styles.myInfoBtn}
            onClick={() => {
              if (user) setViewingUser({ userId: user.userId, nickname: user.nickname, email: user.email });
            }}
          >
            <div className={styles.myAvatarWrap}>
              {myAvatarUrl ? (
                <img
                  className={styles.myAvatar}
                  src={`${API_BASE}${myAvatarUrl}`}
                  alt={user?.nickname ?? ''}
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div className={styles.myAvatar}>{user?.nickname?.[0] ?? '?'}</div>
              )}
              <div className={styles.myOnlineDot} />
            </div>
            <div className={styles.userInfo}>
              <p className={styles.userName}>{user?.nickname ?? '알 수 없음'}</p>
              <p className={styles.userStatus}>{user?.email ?? ''}</p>
            </div>
          </button>
          <Link href="/profile" className={styles.settingsLink}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>
      </div>

      {/* 공용 백드롭 */}
      {(menuFriend || menuTeam || menuChannel) && (
        <div className={styles.menuBackdrop} onClick={closeAllMenus} />
      )}

      {/* 친구 컨텍스트 메뉴 */}
      {menuFriend && (
        <div className={styles.contextMenu} style={{ top: menuFriend.y, left: menuFriend.x }}>
          <button
            className={styles.menuItem}
            onClick={() => { setViewingUser(menuFriend.friend); closeAllMenus(); }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            친구 정보 보기
          </button>
          <button className={styles.menuItem} onClick={() => openFriendDm(menuFriend.friend)}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            DM 채팅 열기
          </button>
          <button className={styles.menuItem}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            팀으로 초대
          </button>
          <div className={styles.menuDivider} />
          <button
            className={`${styles.menuItem} ${styles.menuItemDanger}`}
            onClick={() => handleDeleteFriend(menuFriend.friend.friendIdx)}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
            </svg>
            친구 삭제
          </button>
        </div>
      )}

      {/* 팀 컨텍스트 메뉴 */}
      {menuTeam && (() => {
        const currentTeam = teams.find(t => t.teamIdx === menuTeam.teamIdx);
        const myRole = currentTeam?.myRole ?? 'MEMBER';
        const canEdit = myRole === 'LEADER' || myRole === 'MANAGER';
        const canDelete = myRole === 'LEADER';
        return (
          <div className={styles.contextMenu} style={{ top: menuTeam.y, left: menuTeam.x }}>
            <div className={styles.menuTitle}>{menuTeam.name}</div>
            <div className={styles.menuDivider} />
            <button
              className={styles.menuItem}
              onClick={() => { closeAllMenus(); if (currentTeam) setViewingTeam(currentTeam); }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              팀 정보 보기
            </button>
            {canEdit && (
              <button
                className={styles.menuItem}
                onClick={() => { closeAllMenus(); if (currentTeam) setTeamModal({ mode: 'edit', team: currentTeam }); }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                팀 수정
              </button>
            )}
            {canDelete && (
              <>
                <div className={styles.menuDivider} />
                <button
                  className={`${styles.menuItem} ${styles.menuItemDanger}`}
                  onClick={() => handleDeleteTeam(menuTeam.teamIdx)}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  팀 삭제
                </button>
              </>
            )}
            {!canDelete && (
              <>
                <div className={styles.menuDivider} />
                <button
                  className={`${styles.menuItem} ${styles.menuItemDanger}`}
                  onClick={() => handleLeaveTeam(menuTeam.teamIdx)}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  팀 나가기
                </button>
              </>
            )}
          </div>
        );
      })()}

      {/* 채팅방 컨텍스트 메뉴 */}
      {menuChannel && (
        <div className={styles.contextMenu} style={{ top: menuChannel.y, left: menuChannel.x }}>
          <div className={styles.menuTitle}># {menuChannel.ch}</div>
          <div className={styles.menuDivider} />
          <button className={styles.menuItem}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            채팅방 정보 보기
          </button>
          <div className={styles.menuDivider} />
          <button className={`${styles.menuItem} ${styles.menuItemDanger}`}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            채팅방 나가기
          </button>
        </div>
      )}
    </aside>

    {viewingUser && (
      <UserProfileModal
        user={viewingUser}
        onClose={() => setViewingUser(null)}
        onDm={'friendIdx' in viewingUser
          ? () => { openFriendDm(viewingUser as FriendItem); setViewingUser(null); }
          : undefined
        }
      />
    )}

    {viewingTeam && (
      <TeamInfoModal
        team={viewingTeam}
        onClose={() => setViewingTeam(null)}
        onEdit={() => {
          setTeamModal({ mode: 'edit', team: viewingTeam });
          setViewingTeam(null);
        }}
      />
    )}

    {teamModal && (
      <TeamModal
        mode={teamModal.mode}
        team={teamModal.mode === 'edit' ? teamModal.team : undefined}
        onConfirm={async (teamName, about) => {
          if (teamModal.mode === 'create') {
            await handleCreateTeam(teamName, about);
          } else {
            await handleUpdateTeam(teamModal.team.teamIdx, teamName, about);
          }
        }}
        onClose={() => setTeamModal(null)}
      />
    )}
    </>
  );
}
