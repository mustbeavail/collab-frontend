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
  const { friends, loading: friendsLoading, setFriends, removeFriend, setLoading: setFriendsLoading } = useFriendStore();
  const { teams, loading: teamsLoading, setTeams, setLoading: setTeamsLoading } = useTeamStore();

  const [selectedTeams,     setSelectedTeams]     = useState<Set<number>>(new Set<number>());
  const [openCategories,    setOpenCategories]    = useState<Set<string>>(new Set<string>());
  const [menuFriend,        setMenuFriend]        = useState<MenuFriend | null>(null);
  const [menuTeam,          setMenuTeam]          = useState<MenuTeam | null>(null);
  const [menuChannel,       setMenuChannel]       = useState<MenuChannel | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // 프로필 모달
  const [viewingUser, setViewingUser] = useState<ProfileTarget | null>(null);

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
      .then(setFriends)
      .catch(() => setFriends([]))
      .finally(() => setFriendsLoading(false));
  }, [setFriends, setFriendsLoading]);

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
    handleChatOpen({ id: `dm-${f.friendIdx}`, name: f.nickname, type: 'dm' });
  };

  const handleDeleteFriend = async (friendIdx: number) => {
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
                          <div key={m.userId} className={styles.memberItem}>
                            <div className={styles.memberAvatarWrap}>
                              <div className={styles.memberAvatar}>{m.nickname[0]}</div>
                              <div className={`${styles.memberDot} ${styles.offline}`} />
                            </div>
                            <div className={styles.memberInfo}>
                              <span className={styles.memberName}>{m.nickname}</span>
                              {m.role && <span className={styles.memberRole}>{m.role}</span>}
                            </div>
                          </div>
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

            <button className={styles.addBtn}>
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
                team.channels.map(ch => {
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
                          <div className={styles.searchResultAvatar}>{u.nickname[0]}</div>
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
                      <div className={styles.friendAvatar}>{f.nickname[0]}</div>
                      <div className={`${styles.statusDot} ${styles.offline}`} />
                    </div>
                    <span className={styles.friendName}>{f.nickname}</span>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" className={styles.friendMenuIcon}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}
          <div className={styles.sectionDivider} />
        </div>
      </div>

      {/* 푸터 */}
      <div className={styles.footer}>
        <div className={styles.userCard}>
          <div className={styles.myAvatarWrap}>
            <div className={styles.myAvatar}>{user?.nickname?.[0] ?? '?'}</div>
            <div className={styles.myOnlineDot} />
          </div>
          <div className={styles.userInfo}>
            <p className={styles.userName}>{user?.nickname ?? '알 수 없음'}</p>
            <p className={styles.userStatus}>{user?.email ?? ''}</p>
          </div>
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
      {menuTeam && (
        <div className={styles.contextMenu} style={{ top: menuTeam.y, left: menuTeam.x }}>
          <div className={styles.menuTitle}>{menuTeam.name}</div>
          <div className={styles.menuDivider} />
          <button className={styles.menuItem}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            팀 정보 보기
          </button>
          <div className={styles.menuDivider} />
          <button className={`${styles.menuItem} ${styles.menuItemDanger}`}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            팀 나가기
          </button>
        </div>
      )}

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
    </>
  );
}
