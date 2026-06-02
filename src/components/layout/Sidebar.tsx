'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './Sidebar.module.css';
import { teams, friends } from '@/data/mockData';
import type { Friend } from '@/data/mockData';
import type { ChatInfo } from '@/app/page';

type MenuFriend  = { friend: Friend; x: number; y: number };
type MenuTeam    = { teamId: number; name: string; x: number; y: number };
type MenuChannel = { id: string; ch: string; x: number; y: number };

interface Props {
  openChatIds: string[];
  shakingChatId: string | null;
  onChatOpen: (chat: ChatInfo) => void;
}

export default function Sidebar({ openChatIds, shakingChatId, onChatOpen }: Props) {
  const [selectedTeams,     setSelectedTeams]     = useState<Set<number>>(new Set([1]));
  const [openCategories,    setOpenCategories]    = useState<Set<string>>(new Set(['1-channels']));
  const [menuFriend,        setMenuFriend]        = useState<MenuFriend | null>(null);
  const [menuTeam,          setMenuTeam]          = useState<MenuTeam | null>(null);
  const [menuChannel,       setMenuChannel]       = useState<MenuChannel | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const closeAllMenus = () => { setMenuFriend(null); setMenuTeam(null); setMenuChannel(null); };

  const toggleSection = (key: string) =>
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const toggleTeam = (id: number) => {
    setSelectedTeams(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else {
        next.add(id);
        setOpenCategories(cats => new Set([...cats, `${id}-channels`]));
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

  const openFriendDm = (f: Friend) => {
    closeAllMenus();
    handleChatOpen({ id: `dm-${f.id}`, name: f.name, type: 'dm' });
  };

  const openContextMenu = (f: Friend, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    closeAllMenus();
    setMenuFriend({ friend: f, x: rect.right + 8, y: rect.top });
  };

  const openTeamMenu = (teamId: number, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    closeAllMenus();
    setMenuTeam({ teamId, name, x: rect.right + 8, y: rect.top });
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
            {teams.map(team => (
              <div key={team.id}>
                {/* 팀 행: 토글 버튼 + 점세개 버튼 */}
                <div className={styles.teamRow}>
                  <button
                    onClick={() => toggleTeam(team.id)}
                    className={`${styles.teamBtn} ${selectedTeams.has(team.id) ? styles.teamBtnActive : ''}`}
                  >
                    <div className={`${styles.teamAvatar} ${selectedTeams.has(team.id) ? styles.teamAvatarActive : ''}`}>
                      {team.initial}
                    </div>
                    <span className={styles.teamName}>{team.name}</span>
                    <svg
                      className={`${styles.teamChevron} ${selectedTeams.has(team.id) ? styles.teamChevronOpen : ''}`}
                      width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button
                    className={styles.dotBtn}
                    onClick={e => openTeamMenu(team.id, team.name, e)}
                    title="팀 메뉴"
                  >
                    <DotsIcon />
                  </button>
                </div>

                {selectedTeams.has(team.id) && (
                  <div className={styles.teamBody}>

                    {/* 채팅방 카테고리 */}
                    <button className={styles.categoryHeader} onClick={() => toggleCategory(`${team.id}-channels`)}>
                      <svg className={`${styles.catChevron} ${openCategories.has(`${team.id}-channels`) ? styles.catChevronOpen : ''}`}
                        width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                      채팅방
                      <span className={styles.categoryCount}>{team.channels.length}</span>
                    </button>
                    {openCategories.has(`${team.id}-channels`) && (
                      <div className={styles.categoryItems}>
                        {team.channels.map(ch => {
                          const id = `channel-${team.id}-${ch}`;
                          const isOpen    = openChatIds.includes(id);
                          const isShaking = shakingChatId === id;
                          return (
                            <div key={ch} className={styles.channelRow}>
                              <button
                                className={[styles.channelItem, isOpen ? styles.channelItemOpen : '', isShaking ? styles.shaking : ''].join(' ')}
                                onClick={() => handleChatOpen({ id, name: ch, type: 'channel' })}
                              >
                                <span className={styles.channelHash}>#</span>
                                <span>{ch}</span>
                              </button>
                              <button
                                className={styles.dotBtn}
                                onClick={e => openChannelMenu(id, ch, e)}
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
                    <button className={styles.categoryHeader} onClick={() => toggleCategory(`${team.id}-members`)}>
                      <svg className={`${styles.catChevron} ${openCategories.has(`${team.id}-members`) ? styles.catChevronOpen : ''}`}
                        width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                      멤버
                      <span className={styles.categoryCount}>{team.members.length}</span>
                    </button>
                    {openCategories.has(`${team.id}-members`) && (
                      <div className={styles.categoryItems}>
                        {team.members.map(m => (
                          <div key={m.id} className={styles.memberItem}>
                            <div className={styles.memberAvatarWrap}>
                              <div className={styles.memberAvatar}>{m.name[0]}</div>
                              <div className={`${styles.memberDot} ${m.online ? styles.online : styles.offline}`} />
                            </div>
                            <div className={styles.memberInfo}>
                              <span className={styles.memberName}>{m.name}</span>
                              {m.role && <span className={styles.memberRole}>{m.role}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 일정 카테고리 */}
                    <button className={styles.categoryHeader} onClick={() => toggleCategory(`${team.id}-schedule`)}>
                      <svg className={`${styles.catChevron} ${openCategories.has(`${team.id}-schedule`) ? styles.catChevronOpen : ''}`}
                        width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                      일정
                      <span className={styles.categoryCount}>{team.schedule.length}</span>
                    </button>
                    {openCategories.has(`${team.id}-schedule`) && (
                      <div className={styles.categoryItems}>
                        {team.schedule.map(s => (
                          <div key={s.id} className={styles.scheduleItem}>
                            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" className={styles.scheduleIcon}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <div className={styles.scheduleText}>
                              <span className={styles.scheduleTitle}>{s.title}</span>
                              <span className={styles.scheduleDate}>{s.date}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

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
                  const id = `channel-${team.id}-${ch}`;
                  const isOpen    = openChatIds.includes(id);
                  const isShaking = shakingChatId === id;
                  return (
                    <div key={id} className={styles.channelRow}>
                      <button
                        className={[styles.channelItem, isOpen ? styles.channelItemOpen : '', isShaking ? styles.shaking : ''].join(' ')}
                        onClick={() => handleChatOpen({ id, name: ch, type: 'channel' })}
                      >
                        <span className={styles.channelHash}>#</span>
                        <span>{ch}</span>
                      </button>
                      <button
                        className={styles.dotBtn}
                        onClick={e => openChannelMenu(id, ch, e)}
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
          <button className={styles.sectionHeader} onClick={() => toggleSection('friends')}>
            <span className={styles.sectionLabel}>친구</span>
            <svg className={`${styles.sectionChevron} ${collapsedSections.has('friends') ? '' : styles.sectionChevronOpen}`}
              width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {!collapsedSections.has('friends') && (
            <div className={styles.itemList}>
              {friends.map(f => {
                const isShaking = shakingChatId === `dm-${f.id}`;
                return (
                  <button
                    key={f.id}
                    className={[styles.friendItem, isShaking ? styles.shaking : ''].join(' ')}
                    onClick={e => openContextMenu(f, e)}
                  >
                    <div className={styles.avatarWrap}>
                      <div className={styles.friendAvatar}>{f.name[0]}</div>
                      <div className={`${styles.statusDot} ${f.online ? styles.online : styles.offline}`} />
                    </div>
                    <span className={styles.friendName}>{f.name}</span>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" className={styles.friendMenuIcon}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                );
              })}
              <button className={styles.addBtn}>
                <div className={styles.addIcon}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className={styles.addText}>친구 추가</span>
              </button>
            </div>
          )}
          <div className={styles.sectionDivider} />
        </div>
      </div>

      {/* 푸터 */}
      <div className={styles.footer}>
        <div className={styles.userCard}>
          <div className={styles.myAvatarWrap}>
            <div className={styles.myAvatar}>나</div>
            <div className={styles.myOnlineDot} />
          </div>
          <div className={styles.userInfo}>
            <p className={styles.userName}>내 이름</p>
            <p className={styles.userStatus}>온라인</p>
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
          <button className={styles.menuItem}>
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
          <button className={`${styles.menuItem} ${styles.menuItemDanger}`}>
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
  );
}
