'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import styles from './Sidebar.module.css';
import type { ChatInfo } from '@/app/page';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import { useTeamStore } from '@/store/teamStore';
import { friendService } from '@/services/friend';
import { userService } from '@/services/user';
import { teamService } from '@/services/team';
import { chatService, type DmRoom } from '@/services/chat';
import { scheduleService, type ScheduleEvent } from '@/services/schedule';
import { useChatNotifStore } from '@/store/chatNotifStore';
import type { FriendItem } from '@/types/friend';
import type { UserSearchResult } from '@/types/user';
import UserProfileModal, { type ProfileTarget } from '@/components/user/UserProfileModal';
import ScheduleDetailModal from '@/components/calendar/ScheduleDetailModal';
import TeamModal from '@/components/team/TeamModal';
import ChannelModal from '@/components/team/ChannelModal';
import TeamInfoModal from '@/components/team/TeamInfoModal';
import type { TeamItem } from '@/types/team';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

const ROLE_PRIORITY: Record<string, number> = { LEADER: 3, MANAGER: 2, MEMBER: 1 };

// 일정 날짜 포맷 "MM/DD HH:mm"(qa 항목22)
function fmtSchedule(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 팀 멤버 프로필 액션 컨텍스트(qa 항목17)
type MemberCtx = { teamIdx: number; myRole: string; memberRole: string; userId: string; nickname: string };

type MenuFriend  = { friend: FriendItem; x: number; y: number };
type MenuTeam    = { teamIdx: number; name: string; x: number; y: number };
type MenuChannel = { id: string; ch: string; roomIdx: number; canDelete: boolean; canRename: boolean; joined: boolean; x: number; y: number };

// I-15: 인원수 색점 폐기 → 채팅방 패널을 인원수별 카테고리(DM/단톡방/휴면)로 세분화.
// 카테고리 기준(인원수)은 기존 색 구분과 동일: 2인=DM, 3인↑=단톡방, 1인 이하=휴면.
const chatCategoryKey = (n: number) => (n >= 3 ? 'group' : n === 2 ? 'dm' : 'idle');

interface Props {
  openChatIds: string[];
  shakingChatId: string | null;
  onChatOpen: (chat: ChatInfo) => void;
}

export default function Sidebar({ openChatIds, shakingChatId, onChatOpen }: Props) {
  const user = useAuthStore((s) => s.user);
  const { friends, onlineUsers, loading: friendsLoading, setFriends, removeFriend, setUserOnline, setLoading: setFriendsLoading } = useFriendStore();
  const { teams, loading: teamsLoading, setTeams, setLoading: setTeamsLoading, addTeam, updateTeamInStore, removeTeam, removeChannelFromTeam } = useTeamStore();

  const [selectedTeams,     setSelectedTeams]     = useState<Set<number>>(new Set<number>());
  const [openCategories,    setOpenCategories]    = useState<Set<string>>(new Set<string>());
  const [menuFriend,        setMenuFriend]        = useState<MenuFriend | null>(null);
  const [menuTeam,          setMenuTeam]          = useState<MenuTeam | null>(null);
  const [menuChannel,       setMenuChannel]       = useState<MenuChannel | null>(null);
  // 친구를 팀으로 초대: 팀 선택 팝업(버그 항목 '추가')
  const [inviteFriendMenu,  setInviteFriendMenu]  = useState<{ friend: FriendItem; x: number; y: number } | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // 프로필 모달
  const [viewingUser, setViewingUser] = useState<ProfileTarget | null>(null);

  // 내 프로필 사진(좌하단 표시용)
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);

  // 내가 보낸 대기중 친구요청(qa 항목6)
  const [sentPending, setSentPending] = useState<FriendItem[]>([]);

  // 내 DM/그룹 채팅방 목록(qa 항목15)
  const [dmRooms, setDmRooms] = useState<DmRoom[]>([]);
  const unread = useChatNotifStore((s) => s.unread);
  const justLeftRoomIdx = useChatNotifStore((s) => s.justLeftRoomIdx);
  const clearLeft = useChatNotifStore((s) => s.clearLeft);
  const roomListDirty = useChatNotifStore((s) => s.roomListDirty);

  // 내 일정 목록(qa 항목22) — 팀/비팀 전부
  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [detailEvent, setDetailEvent] = useState<ScheduleEvent | null>(null);

  // 팀 모달
  type TeamModalState = { mode: 'create' } | { mode: 'edit'; team: TeamItem };
  const [teamModal,     setTeamModal]     = useState<TeamModalState | null>(null);
  const [channelModalTeam, setChannelModalTeam] = useState<number | null>(null);
  // 채팅방 이름변경 모달(I-13)
  const [renameModal, setRenameModal] = useState<{ roomIdx: number; current: string } | null>(null);
  const [viewingTeam,   setViewingTeam]   = useState<TeamItem | null>(null);
  const [viewingTeamInvite, setViewingTeamInvite] = useState(false);
  // 팀 멤버 프로필 액션(qa 항목17)
  const [memberCtx,     setMemberCtx]     = useState<MemberCtx | null>(null);

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
        // 전체 교체(setOnlineUsers) 대신 병합(setUserOnline)으로 self/팀멤버 시드를 덮어쓰지 않는다.
        Object.entries(statuses).forEach(([uid, on]) => { if (on) setUserOnline(uid); });
      })
      .catch(() => setFriends([]))
      .finally(() => setFriendsLoading(false));
  }, [setFriends, setUserOnline, setFriendsLoading]);

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

  // 내 DM/그룹 채팅방 목록 로드(qa 항목15)
  const loadDmRooms = useCallback(() => {
    chatService.getMyDmRooms().then(setDmRooms).catch(() => setDmRooms([]));
  }, []);
  // 마운트 + 채팅 열림/닫힘 시 갱신(새 DM이 목록에 반영되도록)
  useEffect(() => { loadDmRooms(); }, [loadDmRooms, openChatIds]);

  // 새 메시지 알림 시 채팅방 목록 갱신 — 아직 목록에 없는 방(초대받은 방)이 있을 수 있으므로(E(8))
  useEffect(() => { if (roomListDirty > 0) loadDmRooms(); }, [roomListDirty, loadDmRooms]);

  // ChatWindow 나가기 신호 → 채팅방패널·팀패널 즉시 제거
  useEffect(() => {
    if (justLeftRoomIdx == null) return;
    setDmRooms(prev => prev.filter(r => r.roomIdx !== justLeftRoomIdx));
    teams.forEach(t => {
      if (t.channels.some(ch => ch.roomIdx === justLeftRoomIdx)) {
        removeChannelFromTeam(t.teamIdx, justLeftRoomIdx);
      }
    });
    clearLeft();
  }, [justLeftRoomIdx, clearLeft, removeChannelFromTeam, teams]);

  // 내 일정 로드(qa 항목22)
  useEffect(() => {
    scheduleService.getMySchedules()
      .then(setSchedules)
      .catch(() => setSchedules([]));
  }, []);

  // 팀 멤버의 접속 상태를 onlineUsers에 시드(버그 항목20). 이후 실시간 갱신은 WS USER_STATUS가 담당.
  useEffect(() => {
    teams.forEach(t => t.members.forEach(m => { if (m.online) setUserOnline(m.userId); }));
  }, [teams, setUserOnline]);

  // 자기 자신은 로그인 중이면 항상 접속중(자기 USER_STATUS는 WS로 받지 않으므로 직접 표시, 버그 항목20)
  useEffect(() => {
    if (user?.userId) setUserOnline(user.userId);
  }, [user?.userId, setUserOnline]);

  useEffect(() => {
    setTeamsLoading(true);
    teamService.getMyTeams()
      .then(setTeams)
      .catch(() => setTeams([]))
      .finally(() => setTeamsLoading(false));
  }, [setTeams, setTeamsLoading]);

  // (버그 항목19) 팀 목록 자동 열림 제거 — 기본 전부 닫아두고 사용자가 클릭 시만 드롭다운.

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

  const closeAllMenus = () => { setMenuFriend(null); setMenuTeam(null); setMenuChannel(null); setInviteFriendMenu(null); };

  // 친구를 내가 권한 가진 팀으로 초대(버그 항목 '추가')
  const invitableTeams = teams.filter(t => t.myRole === 'LEADER' || t.myRole === 'MANAGER');
  const handleInviteFriendToTeam = async (teamIdx: number, targetUserId: string) => {
    try {
      await teamService.inviteMember(teamIdx, targetUserId);
      alert('팀으로 초대했습니다.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? '초대에 실패했습니다.');
    } finally {
      setInviteFriendMenu(null);
    }
  };

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

  // 팀 채팅방 추가(qa 항목21) — 모달로 입력받아 생성
  const handleCreateChannel = (teamIdx: number) => {
    setChannelModalTeam(teamIdx);
  };
  const submitCreateChannel = async (roomName: string) => {
    if (channelModalTeam == null) return;
    const updated = await teamService.createChannel(channelModalTeam, roomName);
    updateTeamInStore(updated);
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
    if (!confirm('팀을 삭제하면 모든 채팅방과 내용이 사라집니다. 정말 삭제하시겠습니까?')) return;
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

  // 채팅방 나가기(버그 항목16/18) — 팀 채팅방/일반 채팅방 공통. 나간 뒤 목록·열린 창 정리.
  const handleLeaveRoom = async (roomIdx: number, chatId: string) => {
    if (!confirm('채팅방에서 나가시겠습니까?')) return;
    closeAllMenus();
    try {
      await chatService.leaveRoom(roomIdx);
      // 즉시 목록에서 제거
      setDmRooms(prev => prev.filter(r => r.roomIdx !== roomIdx));
      const teamMatch = chatId.match(/^channel-(\d+)-\d+$/);
      if (teamMatch) removeChannelFromTeam(parseInt(teamMatch[1]), roomIdx);
      // 열려 있으면 닫기
      if (openChatIds.includes(chatId)) onChatOpen({ id: chatId, name: '', type: 'channel' }); // 토글 닫기
      loadDmRooms();
      const updated = await teamService.getMyTeams();
      setTeams(updated);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? '채팅방 나가기 중 오류가 발생했습니다.');
    }
  };

  // ─── 팀 멤버 프로필 액션(qa 항목17) ───
  const refreshTeam = async (teamIdx: number) => {
    try {
      const updated = await teamService.getMyTeams();
      const found = updated.find((t) => t.teamIdx === teamIdx);
      if (found) updateTeamInStore(found);
    } catch { /* 무시 */ }
  };

  const closeMemberProfile = () => { setViewingUser(null); setMemberCtx(null); };

  const handleKickMember = async (ctx: MemberCtx) => {
    if (!confirm(`${ctx.nickname}님을 팀에서 추방하시겠습니까?`)) return;
    try {
      await teamService.kickMember(ctx.teamIdx, ctx.userId);
      await refreshTeam(ctx.teamIdx);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? '추방 중 오류가 발생했습니다.');
    }
    closeMemberProfile();
  };

  const handleDelegateLeader = async (ctx: MemberCtx) => {
    if (!confirm(`${ctx.nickname}님에게 리더를 위임하시겠습니까? 본인은 매니저로 변경됩니다.`)) return;
    try {
      await teamService.changeRole(ctx.teamIdx, ctx.userId, 'LEADER');
      await refreshTeam(ctx.teamIdx);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? '권한 위임 중 오류가 발생했습니다.');
    }
    closeMemberProfile();
  };

  const buildMemberActions = (ctx: MemberCtx) => {
    const actions: { label: string; onClick: () => void; danger?: boolean }[] = [];
    const isSelf = ctx.userId === user?.userId;
    // 채팅하기(DM) — 자기 자신에게는 표시하지 않음(버그 항목21)
    if (!isSelf) {
      actions.push({
        label: '채팅하기',
        onClick: () => {
          handleChatOpen({ id: `dm-u-${ctx.userId}`, name: ctx.nickname, type: 'dm', targetUserId: ctx.userId });
          closeMemberProfile();
        },
      });
    }
    const myP = ROLE_PRIORITY[ctx.myRole] ?? 1;
    const tP = ROLE_PRIORITY[ctx.memberRole] ?? 1;
    // 리더 위임: 리더만, 대상이 리더가 아닐 때
    if (ctx.myRole === 'LEADER' && ctx.memberRole !== 'LEADER') {
      actions.push({ label: '리더 위임', onClick: () => handleDelegateLeader(ctx) });
    }
    // 추방: 리더/매니저가 자기보다 낮은 역할만
    if ((ctx.myRole === 'LEADER' || ctx.myRole === 'MANAGER') && myP > tP) {
      actions.push({ label: '추방', danger: true, onClick: () => handleKickMember(ctx) });
    }
    return actions;
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

  const openChannelMenu = (id: string, ch: string, roomIdx: number, canDelete: boolean, canRename: boolean, joined: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    closeAllMenus();
    setMenuChannel({ id, ch, roomIdx, canDelete, canRename, joined, x: rect.right + 8, y: rect.top });
  };

  // 팀 채팅방 삭제(팀 LEADER만, 버그 추가요청)
  const handleDeleteRoom = async (roomIdx: number, chatId: string) => {
    if (!confirm('이 채팅방을 삭제하시겠습니까? 모든 대화 내용이 사라집니다.')) return;
    closeAllMenus();
    try {
      await chatService.deleteRoom(roomIdx);
      if (openChatIds.includes(chatId)) onChatOpen({ id: chatId, name: '', type: 'channel' }); // 열려있으면 닫기
      loadDmRooms();
      const updated = await teamService.getMyTeams();
      setTeams(updated);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? '채팅방 삭제 중 오류가 발생했습니다.');
    }
  };

  // 채팅방 이름변경(I-13) — 모든 패널 목록·열린 창에 반영
  const applyRoomRename = useCallback((roomIdx: number, newName: string) => {
    // 이름변경 이벤트가 왔다는 건 custom_name이 된 것 → DM(2인) 포함 해당 방 표시명 갱신
    setDmRooms(prev => prev.map(r => (r.roomIdx === roomIdx ? { ...r, name: newName } : r)));
    // 팀 채널 이름 갱신
    teams.forEach(t => {
      if (t.channels.some(ch => ch.roomIdx === roomIdx)) {
        updateTeamInStore({ ...t, channels: t.channels.map(ch => ch.roomIdx === roomIdx ? { ...ch, roomName: newName } : ch) });
      }
    });
  }, [teams, updateTeamInStore]);

  const handleRenameRoom = async (roomIdx: number, newName: string) => {
    await chatService.updateRoomInfo(roomIdx, newName); // OWNER 아니면 백엔드 403
    applyRoomRename(roomIdx, newName); // 즉시 반영(실시간 이벤트도 옴)
  };

  // 다른 사용자의 이름변경 실시간 반영(I-13)
  useEffect(() => {
    const onRenamed = (e: Event) => {
      const d = (e as CustomEvent).detail as { roomIdx: number; roomName: string } | undefined;
      if (d) applyRoomRename(d.roomIdx, d.roomName);
    };
    window.addEventListener('collab:room-renamed', onRenamed);
    return () => window.removeEventListener('collab:room-renamed', onRenamed);
  }, [applyRoomRename]);

  // 미읽음 배지(qa 항목15)
  const UnreadBadge = ({ n }: { n: number }) => (
    <span style={{
      marginLeft: 'auto', background: 'var(--danger, #e5484d)', color: '#fff',
      fontSize: '0.625rem', fontWeight: 700, borderRadius: 9, padding: '0 5px',
      minWidth: 16, textAlign: 'center',
    }}>{n > 99 ? '99+' : n}</span>
  );

  // 아바타: 사진 있으면 이미지, 없으면 닉네임 첫 글자(qa 항목9)
  const Avatar = ({ url, name, className }: { url?: string | null; name?: string | null; className: string }) =>
    url ? (
      <img className={className} src={`${API_BASE}${url}`} alt={name ?? ''} style={{ objectFit: 'cover' }} />
    ) : (
      <div className={className}>{name?.[0] ?? '?'}</div>
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
                            // (버그 항목17) 자가참여 제거 — 미참가 채팅방은 클릭 시 차단. 권한자 초대로만 참가.
                            // 단, 팀 리더는 미참가 채팅방에도 점세개 메뉴(삭제)를 볼 수 있다(나가기는 제외).
                            return (
                              <div key={ch.roomIdx} className={styles.channelRow}>
                                <button
                                  className={[styles.channelItem, styles.channelItemLocked].join(' ')}
                                  onClick={() => alert('채팅방의 멤버가 아닙니다.')}
                                  title="채팅방의 멤버가 아닙니다"
                                >
                                  <span className={styles.channelHash}>#</span>
                                  <span>{ch.roomName}</span>
                                </button>
                                {team.myRole === 'LEADER' && (
                                  <button
                                    className={styles.dotBtn}
                                    onClick={e => openChannelMenu(id, ch.roomName, ch.roomIdx, true, ch.owner, false, e)}
                                    title="채팅방 메뉴"
                                  >
                                    <DotsIcon />
                                  </button>
                                )}
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
                                {unread[ch.roomIdx] > 0 && <UnreadBadge n={unread[ch.roomIdx]} />}
                              </button>
                              <button
                                className={styles.dotBtn}
                                onClick={e => openChannelMenu(id, ch.roomName, ch.roomIdx, team.myRole === 'LEADER', ch.owner, true, e)}
                                title="채팅방 메뉴"
                              >
                                <DotsIcon />
                              </button>
                            </div>
                          );
                        })}
                        {/* 채널 추가(qa 항목21) — 멤버 추가와 동일 스타일 */}
                        <button
                          className={styles.memberItem}
                          onClick={() => handleCreateChannel(team.teamIdx)}
                          title="채팅방 추가"
                          style={{ color: 'var(--text-muted)', opacity: 0.8 }}
                        >
                          <div className={styles.memberAvatarWrap} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </div>
                          <div className={styles.memberInfo}>
                            <span className={styles.memberName}>채팅방 추가</span>
                          </div>
                        </button>
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
                            onClick={() => {
                              setViewingUser({ userId: m.userId, nickname: m.nickname, email: m.userId });
                              setMemberCtx({ teamIdx: team.teamIdx, myRole: team.myRole, memberRole: m.role, userId: m.userId, nickname: m.nickname });
                            }}
                            title={`${m.nickname} 프로필 보기`}
                          >
                            <div className={styles.memberAvatarWrap}>
                              <Avatar url={m.avatarUrl} name={m.nickname} className={styles.memberAvatar} />
                              <div className={`${styles.memberDot} ${onlineUsers.has(m.userId) ? styles.online : styles.offline}`} />
                            </div>
                            <div className={styles.memberInfo}>
                              <span className={styles.memberName}>{m.nickname}</span>
                              {m.role && <span className={styles.memberRole}>{m.role}</span>}
                            </div>
                          </button>
                        ))}
                        {/* 멤버 추가(qa 항목13) — 리더/매니저만, 멤버 목록 최하단 */}
                        {(team.myRole === 'LEADER' || team.myRole === 'MANAGER') && (
                          <button
                            className={styles.memberItem}
                            onClick={() => { setViewingTeam(team); setViewingTeamInvite(true); }}
                            title="멤버 추가"
                            style={{ color: 'var(--text-muted)', opacity: 0.8 }}
                          >
                            <div className={styles.memberAvatarWrap} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </div>
                            <div className={styles.memberInfo}>
                              <span className={styles.memberName}>멤버 추가</span>
                            </div>
                          </button>
                        )}
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
          {!collapsedSections.has('channels') && (() => {
            // I-15: 채팅방 패널의 모든 방(참가한 팀 채널 + DM/그룹)을 인원수로 카테고리 분류.
            // 색점은 폐기하고 DM(2인)/단톡방(3인↑)/휴면(1인 이하) 접기형 소제목으로 세분화한다.
            type ChatRow = { roomIdx: number; memberCount: number; node: ReactNode };
            const rows: ChatRow[] = [];

            teams.forEach(team =>
              team.channels.filter(ch => ch.joined).forEach(ch => {
                const id = `channel-${team.teamIdx}-${ch.roomIdx}`;
                const isOpen    = openChatIds.includes(id);
                const isShaking = shakingChatId === id;
                rows.push({ roomIdx: ch.roomIdx, memberCount: ch.memberCount, node: (
                  <div key={id} className={styles.channelRow}>
                    <button
                      className={[styles.channelItem, isOpen ? styles.channelItemOpen : '', isShaking ? styles.shaking : ''].join(' ')}
                      onClick={() => handleChatOpen({ id, name: ch.roomName, type: 'channel' })}
                    >
                      <span className={styles.channelHash}>#</span>
                      <span>{ch.roomName}</span>
                      {unread[ch.roomIdx] > 0 && <UnreadBadge n={unread[ch.roomIdx]} />}
                    </button>
                    <button
                      className={styles.dotBtn}
                      onClick={e => openChannelMenu(id, ch.roomName, ch.roomIdx, team.myRole === 'LEADER', ch.owner, true, e)}
                      title="채팅방 메뉴"
                    >
                      <DotsIcon />
                    </button>
                  </div>
                ) });
              })
            );

            // 채팅방(DM/그룹) 목록(qa 항목15)
            dmRooms.forEach(r => {
              const id = r.dm ? `dm-u-${r.targetUserId}` : `room-${r.roomIdx}`;
              const isOpen = openChatIds.includes(id);
              rows.push({ roomIdx: r.roomIdx, memberCount: r.memberCount, node: (
                <div key={`dm-${r.roomIdx}`} className={styles.channelRow}>
                  <button
                    className={[styles.channelItem, isOpen ? styles.channelItemOpen : ''].join(' ')}
                    onClick={() => handleChatOpen(
                      r.dm && r.targetUserId
                        ? { id, name: r.name, type: 'dm', targetUserId: r.targetUserId }
                        : { id, name: r.name, type: 'channel' }
                    )}
                  >
                    {r.dm
                      ? <Avatar url={r.avatarUrl} name={r.name} className={styles.friendAvatar} />
                      : <span className={styles.channelHash}>#</span>}
                    <span>{r.name}</span>
                    {unread[r.roomIdx] > 0 && <UnreadBadge n={unread[r.roomIdx]} />}
                  </button>
                  {/* 일반 채팅방 점세개 메뉴(버그 항목18) */}
                  <button
                    className={styles.dotBtn}
                    onClick={e => openChannelMenu(id, r.name, r.roomIdx, false, r.owner, true, e)}
                    title="채팅방 메뉴"
                  >
                    <DotsIcon />
                  </button>
                </div>
              ) });
            });

            const categories: { key: string; label: string }[] = [
              { key: 'cat-dm',    label: 'DM' },
              { key: 'cat-group', label: '단톡방' },
              { key: 'cat-idle',  label: '휴면' },
            ];

            return (
              <div className={styles.itemList}>
                {categories.map(cat => {
                  const catRows = rows.filter(r => `cat-${chatCategoryKey(r.memberCount)}` === cat.key);
                  if (catRows.length === 0) return null; // 빈 카테고리는 숨김
                  const collapsed = collapsedSections.has(cat.key);
                  return (
                    <div key={cat.key}>
                      <button className={styles.subSectionHeader} onClick={() => toggleSection(cat.key)}>
                        <svg className={`${styles.subSectionChevron} ${collapsed ? '' : styles.subSectionChevronOpen}`}
                          width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                        <span className={styles.subSectionLabel}>{cat.label}</span>
                        <span className={styles.subSectionCount}>{catRows.length}</span>
                      </button>
                      {!collapsed && catRows.map(r => r.node)}
                    </div>
                  );
                })}
              </div>
            );
          })()}
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

        {/* ─── 일정(qa 항목22) ─── */}
        <div>
          <button className={styles.sectionHeader} onClick={() => toggleSection('schedules')}>
            <span className={styles.sectionLabel}>일정</span>
            <svg className={`${styles.sectionChevron} ${collapsedSections.has('schedules') ? '' : styles.sectionChevronOpen}`}
              width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {!collapsedSections.has('schedules') && (
            <div className={styles.itemList}>
              {schedules.length === 0 && <div className={styles.loadingText}>일정이 없습니다.</div>}
              {schedules.map(s => {
                const past = new Date(s.date).getTime() < Date.now();
                return (
                  <div
                    key={s.scheduleIdx}
                    className={styles.channelRow}
                    style={past ? { opacity: 0.4 } : undefined}
                    title={`${s.title}${past ? ' (지난 일정)' : ''}`}
                  >
                    <button className={styles.channelItem} onClick={() => setDetailEvent(s)}>
                      <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '0.625rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                        {fmtSchedule(s.date)}
                      </span>
                    </button>
                  </div>
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
      {(menuFriend || menuTeam || menuChannel || inviteFriendMenu) && (
        <div className={styles.menuBackdrop} onClick={closeAllMenus} />
      )}

      {/* 친구 → 팀으로 초대: 팀 선택 팝업(버그 항목 '추가') */}
      {inviteFriendMenu && (
        <div className={styles.contextMenu} style={{ top: inviteFriendMenu.y, left: inviteFriendMenu.x }}>
          <div className={styles.menuTitle}>팀으로 초대</div>
          <div className={styles.menuDivider} />
          {invitableTeams.length === 0 ? (
            <div className={styles.menuItem} style={{ color: 'var(--text-muted)', cursor: 'default' }}>
              초대할 수 있는 팀이 없습니다
            </div>
          ) : (
            invitableTeams.map(t => (
              <button
                key={t.teamIdx}
                className={styles.menuItem}
                onClick={() => handleInviteFriendToTeam(t.teamIdx, inviteFriendMenu.friend.userId)}
              >
                <span className={styles.teamAvatar} style={{ width: 18, height: 18, fontSize: '0.7rem' }}>
                  {t.teamName[0]}
                </span>
                {t.teamName}
              </button>
            ))
          )}
        </div>
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
            채팅 열기
          </button>
          <button
            className={styles.menuItem}
            onClick={() => {
              const f = menuFriend.friend;
              const pos = { x: menuFriend.x, y: menuFriend.y };
              closeAllMenus();
              setInviteFriendMenu({ friend: f, ...pos });
            }}
          >
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

      {/* 채팅방 컨텍스트 메뉴 (버그 항목18) */}
      {menuChannel && (
        <div className={styles.contextMenu} style={{ top: menuChannel.y, left: menuChannel.x }}>
          <div className={styles.menuTitle}># {menuChannel.ch}</div>
          <div className={styles.menuDivider} />
          {/* 채팅방 이름변경 — 방 OWNER만(I-13) */}
          {menuChannel.canRename && (
            <button
              className={styles.menuItem}
              onClick={() => {
                const rm = { roomIdx: menuChannel.roomIdx, current: menuChannel.ch };
                closeAllMenus();
                setRenameModal(rm);
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              채팅방 이름변경
            </button>
          )}
          {/* 참여 중일 때만 나가기 노출(미참여 방엔 나갈 게 없음) */}
          {menuChannel.joined && (
            <button
              className={`${styles.menuItem} ${styles.menuItemDanger}`}
              onClick={() => handleLeaveRoom(menuChannel.roomIdx, menuChannel.id)}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              채팅방 나가기
            </button>
          )}
          {/* 팀 채팅방 삭제: 팀 LEADER에게만 노출 */}
          {menuChannel.canDelete && (
            <button
              className={`${styles.menuItem} ${styles.menuItemDanger}`}
              onClick={() => handleDeleteRoom(menuChannel.roomIdx, menuChannel.id)}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              채팅방 삭제
            </button>
          )}
        </div>
      )}
    </aside>

    {detailEvent && (
      <ScheduleDetailModal event={detailEvent} onClose={() => setDetailEvent(null)} />
    )}

    {viewingUser && (
      <UserProfileModal
        user={viewingUser}
        onClose={closeMemberProfile}
        onDm={'friendIdx' in viewingUser
          ? () => { openFriendDm(viewingUser as FriendItem); closeMemberProfile(); }
          : undefined
        }
        actions={memberCtx && memberCtx.userId === viewingUser.userId
          ? buildMemberActions(memberCtx)
          : undefined
        }
      />
    )}

    {viewingTeam && (
      <TeamInfoModal
        team={viewingTeam}
        initialInviteOpen={viewingTeamInvite}
        onClose={() => { setViewingTeam(null); setViewingTeamInvite(false); }}
        onEdit={() => {
          setTeamModal({ mode: 'edit', team: viewingTeam });
          setViewingTeam(null);
          setViewingTeamInvite(false);
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

    {channelModalTeam != null && (
      <ChannelModal
        onConfirm={submitCreateChannel}
        onClose={() => setChannelModalTeam(null)}
      />
    )}

    {/* 채팅방 이름변경 모달(I-13) */}
    {renameModal && (
      <ChannelModal
        title="채팅방 이름변경"
        initialValue={renameModal.current}
        submitLabel="변경"
        onConfirm={async (name) => { await handleRenameRoom(renameModal.roomIdx, name); }}
        onClose={() => setRenameModal(null)}
      />
    )}
    </>
  );
}
