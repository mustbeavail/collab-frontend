'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import MessageList from '@/components/chat/MessageList';
import MessageInput from '@/components/chat/MessageInput';
import SchedulePanel from '@/components/chat/SchedulePanel';
import FilePanel from '@/components/chat/FilePanel';
import MinutesPanel from '@/components/chat/MinutesPanel';
import DrawPanel from '@/components/chat/DrawPanel';
import ChartPanel from '@/components/chat/ChartPanel';
import styles from './ChatWindow.module.css';
import type { ChatWindowState } from '@/app/page';
import { useChatRoom } from '@/hooks/useChatRoom';
import { useChatNotifStore } from '@/store/chatNotifStore';
import { useWebRTC } from '@/hooks/useWebRTC';
import { chatService } from '@/services/chat';
import { fileService, FileTooLargeError } from '@/services/file';
import { useAuthStore } from '@/store/authStore';
import { useTeamStore } from '@/store/teamStore';
import { userService } from '@/services/user';
import { searchService, type RoomSearchResult } from '@/services/search';
import UserProfileModal, { type ProfileTarget } from '@/components/user/UserProfileModal';
import type { ChatRoomDetail, RoomMember } from '@/types/chat';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
const MIN_WIDTH  = 760;
const MIN_HEIGHT = 400;

// ── 원격 오디오 트랙 컴포넌트 ────────────────────────────────────────────
function AudioTrack({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay />;
}

// ── 원격 비디오 타일 컴포넌트 ────────────────────────────────────────────
function RemoteVideoTile({ stream, nickname, speaking, micOn }: {
  stream: MediaStream | undefined;
  nickname: string;
  speaking: boolean;
  micOn: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream ?? null;
  }, [stream]);

  return (
    <div className={styles.videoCell}>
      <div className={`${styles.videoCam} ${speaking ? styles.videoSpeaking : ''}`}>
        {stream
          ? <video ref={ref} autoPlay playsInline className={styles.videoCamVideo} />
          : <div className={styles.videoCamInitial}>{nickname?.[0]?.toUpperCase() ?? '?'}</div>
        }
      </div>
      <span className={styles.videoName}>{nickname}</span>
      <MicIcon on={micOn} size={11} />
    </div>
  );
}

// ── 마이크 아이콘 헬퍼 ──────────────────────────────────────────────────
function MicIcon({ on, size = 11 }: { on: boolean; size?: number }) {
  return on ? (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24"
      className={styles.micOnColor}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  ) : (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24"
      className={styles.micOffColor}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v3" />
      <path strokeLinecap="round" strokeWidth={2} d="M3 3l18 18" />
    </svg>
  );
}

interface Props {
  win: ChatWindowState;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onMinimize: () => void;
  onUpdate: (updates: Partial<ChatWindowState>) => void;
  onBringToFront: () => void;
  onUnreadChange: (count: number) => void;
  isActive: boolean;
  onResolveRoomIdx: (roomIdx: number) => void;
}

export default function ChatWindow({ win, containerRef, onClose, onMinimize, onUpdate, onBringToFront, onUnreadChange, isActive, onResolveRoomIdx }: Props) {
  // 패널 모드: null=닫힘, 'members'=멤버, 'info'=채팅방 정보
  const [panelMode, setPanelMode] = useState<'members' | 'info' | null>(null);
  const [searchOpen, setSearchOpen]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState('all');
  const [searchResults, setSearchResults] = useState<RoomSearchResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const [voiceChatActive, setVoiceChatActive] = useState(false);
  const [videoChatActive, setVideoChatActive] = useState(false);
  const [confirmModal, setConfirmModal] = useState<'voice' | 'video' | 'to-voice' | 'to-video' | null>(null);
  const [prevWinState, setPrevWinState] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // 멤버 관리 상태
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<{ userId: string; nickname: string; avatarUrl: string | null }[]>([]);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const inviteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 채팅방 정보 상태
  const [roomInfo, setRoomInfo] = useState<ChatRoomDetail | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  // 멤버 클릭 시 회원정보 모달(I-7)
  const [viewingMember, setViewingMember] = useState<ProfileTarget | null>(null);

  const currentUserId   = useAuthStore((s) => s.user?.userId);
  const currentNickname = useAuthStore((s) => s.user?.nickname ?? '');
  const teams           = useTeamStore((s) => s.teams);
  const [roomIdx, setRoomIdx] = useState<number | null>(null);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim() || !roomIdx) { setSearchResults(null); return; }
    searchTimerRef.current = setTimeout(() => {
      setSearchLoading(true);
      searchService.roomSearch(roomIdx, searchQuery.trim())
        .then(setSearchResults)
        .catch(() => setSearchResults(null))
        .finally(() => setSearchLoading(false));
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery, roomIdx]);

  // [I] 녹음 중지 시 서버 업로드(자동 다운로드 폐기). 세그먼트별로 '녹음 YYYY-MM-DD HH-mm (n).webm' 이름으로 보관.
  const handleRecordingComplete = useCallback(async (segments: Blob[], mimeType: string) => {
    if (!roomIdx || segments.length === 0) return;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const ext = mimeType.includes('webm') ? 'webm' : 'webm';
    let uploaded = 0;
    for (let i = 0; i < segments.length; i++) {
      const name = segments.length > 1 ? `녹음 ${stamp} (${i + 1}).${ext}` : `녹음 ${stamp}.${ext}`;
      const fileObj = new File([segments[i]], name, { type: mimeType });
      try {
        await fileService.uploadRecording(roomIdx, fileObj);
        uploaded++;
      } catch { /* 개별 세그먼트 실패는 건너뜀 */ }
    }
    if (uploaded > 0) {
      // 파일 패널(녹음 섹션) 실시간 갱신 + 사용자 안내
      window.dispatchEvent(new CustomEvent('collab:recording-uploaded', { detail: { roomIdx } }));
      alert(`녹음이 저장되었습니다. 파일 패널의 '녹음'에서 다운로드할 수 있어요. (30일간 보관)`);
    } else {
      alert('녹음 저장에 실패했습니다.');
    }
  }, [roomIdx]);

  const webrtcActive = voiceChatActive || videoChatActive;
  const webrtc = useWebRTC({
    roomIdx,
    currentUserId: currentUserId ?? '',
    currentNickname,
    sessionType: videoChatActive ? 'VIDEO' : 'VOICE',
    active: webrtcActive,
    onRecordingComplete: handleRecordingComplete,
  });

  useEffect(() => {
    const { id, type, targetUserId } = win.chat;
    if (type === 'channel') {
      const parts = id.split('-');
      const idx = Number(parts[parts.length - 1]);
      if (!isNaN(idx)) setRoomIdx(idx);
    } else if (type === 'dm' && targetUserId) {
      chatService.getOrCreateDmRoom(targetUserId)
        .then((room) => setRoomIdx(room.roomIdx))
        .catch(() => {});
    }
  }, [win.chat]);

  // 해결된 roomIdx를 부모에 보고(I-10 중복창 방지 · I-13 실시간 이름반영)
  const onResolveRoomIdxRef = useRef(onResolveRoomIdx);
  onResolveRoomIdxRef.current = onResolveRoomIdx;
  useEffect(() => {
    if (roomIdx != null) onResolveRoomIdxRef.current(roomIdx);
  }, [roomIdx]);

  const { messages, loading, loadingMore, hasMore, loadMore, sendMessage, sendFileMessage, deletedFileIdx, initialLoad, unreadCount } =
    useChatRoom(roomIdx, !win.minimized && isActive);

  // 항목9: 채팅 영역 드래그앤드롭 업로드 (항목2: 카운터로 오버레이 잔존 방지)
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);
  const uploadFiles = useCallback(async (files: File[]) => {
    if (!roomIdx || files.length === 0) return;
    for (const file of files) {
      try {
        const uploaded = await fileService.upload(roomIdx, file);
        sendFileMessage(uploaded.fileIdx, uploaded.oriFilename, uploaded.fileSize, uploaded.fileExtension);
      } catch (e) {
        alert(e instanceof FileTooLargeError ? e.message : `${file.name} 업로드에 실패했습니다.`);
      }
    }
  }, [roomIdx, sendFileMessage]);

  // 미읽음 카운트를 부모로 전달.
  // onUnreadChange는 부모(ChatArea)에서 인라인 화살표로 생성돼 매 렌더 식별자가 바뀐다.
  // deps에 넣으면 매 렌더 effect 재실행→부모 setUnreadCounts(매번 새 객체)→재렌더 무한루프
  // (Maximum update depth exceeded)가 발생한다. ref로 최신 함수만 들고 unreadCount 변화 시에만 호출한다.
  const onUnreadChangeRef = useRef(onUnreadChange);
  onUnreadChangeRef.current = onUnreadChange;
  useEffect(() => {
    onUnreadChangeRef.current(unreadCount);
  }, [unreadCount]);

  // 방을 보고 있는 동안 openRooms 등록 → 미개방 알림(미읽음) 해제(qa 항목15)
  // 포커스가 없으면(다른 앱 사용 중) open 해제 → 알림/미읽음 계속 표시(F(24))
  const setRoomOpen = useChatNotifStore((s) => s.setOpen);
  const unsetRoomOpen = useChatNotifStore((s) => s.unsetOpen);
  const markLeft = useChatNotifStore((s) => s.markLeft);
  useEffect(() => {
    if (roomIdx == null || win.minimized) return;

    // I-4: 이 창이 활성(최상위)이고 브라우저에도 포커스가 있을 때만 '열림'으로 등록 → 읽음 처리.
    // 비활성 창(뒤에 깔린 창)이나 브라우저 미포커스 시엔 미읽음/알림 유지.
    const sync = () => {
      if (isActive && document.hasFocus()) setRoomOpen(roomIdx);
      else unsetRoomOpen(roomIdx);
    };
    sync();
    window.addEventListener('focus', sync);
    window.addEventListener('blur', sync);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('blur', sync);
      unsetRoomOpen(roomIdx);
    };
  }, [roomIdx, win.minimized, isActive, setRoomOpen, unsetRoomOpen]);

  const isDmRoom = win.chat.type === 'dm';
  // 채팅방 일원화(버그 항목26/17): DM·그룹·팀채팅방 구분 없이 멤버 관리(초대/나가기) 노출.
  // 권한 검증은 백엔드가 수행(팀채팅방 초대는 권한자만, 대상은 팀멤버 등).
  const canManageMembers = true;
  const isOwner = roomInfo?.myRole === 'OWNER';
  // 항목6(일정이후): 회의록 삭제 권한 — 비팀방=방장(OWNER), 팀채팅방=팀 리더·매니저. (작성자 본인은 MinutesPanel에서 별도 허용)
  const canManageMinutesDelete = roomInfo?.teamIdx != null
    ? ['LEADER', 'MANAGER'].includes(teams.find(t => t.teamIdx === roomInfo.teamIdx)?.myRole ?? '')
    : roomInfo?.myRole === 'OWNER';

  // roomIdx 설정 시 초기 멤버 로드 (isOwner 계산 및 편집 버튼 표시에 필요)
  useEffect(() => {
    if (!roomIdx) return;
    chatService.getMembers(roomIdx).then(setRoomMembers).catch(() => {});
  }, [roomIdx]);

  // 멤버 패널 열릴 때 멤버 목록 재로드 (최신 상태 반영)
  useEffect(() => {
    if (panelMode !== 'members' || !roomIdx) return;
    setMembersLoading(true);
    chatService.getMembers(roomIdx)
      .then(setRoomMembers)
      .catch(() => {})
      .finally(() => setMembersLoading(false));
  }, [panelMode, roomIdx]);

  // 방 정보 로드 — 마운트(roomIdx) 시점에 로드해 teamIdx 등을 항상 확보(초대 검색 팀필터에 필요, 제대로안된것3).
  // 정보 패널 열릴 때도 재로드(편집모드 초기화).
  useEffect(() => {
    if (!roomIdx) return;
    setInfoLoading(true);
    setEditMode(false);
    chatService.getRoomInfo(roomIdx)
      .then(info => {
        setRoomInfo(info);
        setEditName(info.roomName);
      })
      .catch(() => {})
      .finally(() => setInfoLoading(false));
  }, [panelMode, roomIdx]);

  const handleSaveInfo = async () => {
    if (!roomIdx || !editName.trim()) return;
    setSaving(true);
    try {
      const updated = await chatService.updateRoomInfo(roomIdx, editName.trim());
      setRoomInfo(updated);
      setEditMode(false);
    } catch { /* 실패 무시 */ }
    finally { setSaving(false); }
  };

  // 초대 검색 디바운스
  // 팀 채팅방이면 해당 팀의 팀원만 검색(제대로안된것3). 일반 채팅방이면 전체 유저 검색.
  useEffect(() => {
    if (inviteTimerRef.current) clearTimeout(inviteTimerRef.current);
    const q = inviteQuery.trim();
    if (!q) { setInviteResults([]); return; }

    const teamIdx = roomInfo?.teamIdx ?? null;
    if (teamIdx != null) {
      // 팀 채팅방: teamStore의 팀원 중 검색(방 멤버 제외)
      const team = teams.find(t => t.teamIdx === teamIdx);
      const ql = q.toLowerCase();
      const filtered = (team?.members ?? [])
        .filter(m => m.nickname.toLowerCase().includes(ql) || m.userId.toLowerCase().includes(ql))
        .filter(m => !roomMembers.some(rm => rm.userId === m.userId))
        .map(m => ({ userId: m.userId, nickname: m.nickname, avatarUrl: m.avatarUrl ?? null }));
      setInviteResults(filtered);
      setInviteSearching(false);
      return;
    }

    inviteTimerRef.current = setTimeout(() => {
      setInviteSearching(true);
      userService.searchUsers(q)
        .then(results => setInviteResults(
          results
            .filter(u => !roomMembers.some(m => m.userId === u.userId))
            .map(u => ({ userId: u.userId, nickname: u.nickname, avatarUrl: u.avatarUrl ?? null }))
        ))
        .catch(() => setInviteResults([]))
        .finally(() => setInviteSearching(false));
    }, 300);
    return () => { if (inviteTimerRef.current) clearTimeout(inviteTimerRef.current); };
  }, [inviteQuery, roomMembers, roomInfo, teams]);

  const handleInvite = async (userId: string) => {
    if (!roomIdx) return;
    setInviting(userId);
    try {
      await chatService.inviteMember(roomIdx, userId);
      const updated = await chatService.getMembers(roomIdx);
      setRoomMembers(updated);
      setInviteResults(prev => prev.filter(u => u.userId !== userId));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? '초대에 실패했습니다.');
    }
    finally { setInviting(null); }
  };

  const handleLeave = async () => {
    if (!roomIdx || !confirm('채팅방에서 나가시겠습니까?')) return;
    try {
      await chatService.leaveRoom(roomIdx);
      markLeft(roomIdx);
      onClose();
    } catch { /* 실패 무시 */ }
  };

  const handleKick = async (userId: string, nickname: string) => {
    if (!roomIdx || !confirm(`${nickname}님을 채팅방에서 내보내시겠습니까?`)) return;
    try {
      await chatService.kickMember(roomIdx, userId);
      setRoomMembers(prev => prev.filter(m => m.userId !== userId));
    } catch { /* 실패 무시 */ }
  };

  const isMaximized = prevWinState !== null;

  const handleMaximize = () => {
    const container = containerRef.current;
    if (!container) return;
    if (isMaximized) {
      onUpdate(prevWinState);
      setPrevWinState(null);
    } else {
      setPrevWinState({ x: win.x, y: win.y, width: win.width, height: win.height });
      onUpdate({ x: 0, y: 0, width: container.clientWidth, height: container.clientHeight });
    }
  };

  const [activePanel, setActivePanel] = useState<'schedule' | 'file' | 'minutes' | 'draw' | 'chart' | null>(null);
  const minSizeRef = useRef({ w: MIN_WIDTH, h: MIN_HEIGHT });

  const expandToHalf = () => {
    const container = containerRef.current;
    if (!container) return;
    const targetW = Math.max(win.width, Math.floor(container.clientWidth * 0.5));
    const targetH = container.clientHeight;
    onUpdate({ width: targetW, height: targetH, y: 0 });
    minSizeRef.current.w = Math.max(minSizeRef.current.w, targetW);
    minSizeRef.current.h = targetH;
  };

  useEffect(() => {
    const locked = activePanel === 'schedule' || activePanel === 'draw' || videoChatActive;
    if (!locked) {
      minSizeRef.current = { w: MIN_WIDTH, h: MIN_HEIGHT };
    }
  }, [activePanel, videoChatActive]);

  const openPanel = (panel: 'schedule' | 'file' | 'minutes' | 'draw' | 'chart') => {
    if (activePanel === panel) { setActivePanel(null); return; }
    if (panel === 'schedule') {
      expandToHalf();
    } else if (panel === 'draw') {
      expandToHalf();
    }
    setActivePanel(panel);
  };

  const handleVoiceClick = () => {
    if (voiceChatActive) {
      setVoiceChatActive(false);
    } else if (videoChatActive) {
      setConfirmModal('to-voice');
    } else {
      setConfirmModal('voice');
    }
  };

  const handleVideoClick = () => {
    if (videoChatActive) {
      setVideoChatActive(false);
    } else if (voiceChatActive) {
      setConfirmModal('to-video');
    } else {
      setConfirmModal('video');
    }
  };

  const handleConfirm = (type: 'voice' | 'video' | 'to-voice' | 'to-video') => {
    if (type === 'voice' || type === 'to-voice') {
      setVoiceChatActive(true);
      setVideoChatActive(false);
    } else {
      setVideoChatActive(true);
      setVoiceChatActive(false);
      expandToHalf();
    }
    setConfirmModal(null);
  };

  const handleDragStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isMaximized) return;
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) return;
    e.preventDefault();
    const startMouseX = e.clientX, startMouseY = e.clientY;
    const startX = win.x, startY = win.y, winW = win.width, winH = win.height;
    onBringToFront();
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    const onMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      onUpdate({
        x: Math.max(0, Math.min(startX + e.clientX - startMouseX, rect.width  - winW)),
        y: Math.max(0, Math.min(startY + e.clientY - startMouseY, rect.height - winH)),
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [win, containerRef, onUpdate, onBringToFront]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const startMouseX = e.clientX, startMouseY = e.clientY;
    const startW = win.width, startH = win.height, winX = win.x, winY = win.y;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'se-resize';
    const onMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      onUpdate({
        width:  Math.max(minSizeRef.current.w, Math.min(startW + e.clientX - startMouseX, rect.width  - winX)),
        height: Math.max(minSizeRef.current.h, Math.min(startH + e.clientY - startMouseY, rect.height - winY)),
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [win, containerRef, onUpdate]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return iso; }
  };

  return (
    <div
      className={styles.window}
      style={{
        left: win.x, top: win.y, width: win.width, height: win.height,
        zIndex: win.zIndex,
        display: win.minimized ? 'none' : undefined,
      }}
      onMouseDown={onBringToFront}
    >
      {/* 헤더 */}
      <div className={styles.header} onMouseDown={handleDragStart}>
        <div className={styles.title}>
          <span className={styles.prefix}>{win.chat.type === 'channel' ? '#' : '@'}</span>
          <span className={styles.name}>{win.chat.name}</span>
        </div>

        <div className={styles.actions}>
          {/* 멤버 버튼 */}
          <button
            className={`${styles.membersBtn} ${panelMode === 'members' ? styles.membersBtnActive : ''}`}
            onClick={() => setPanelMode(v => v === 'members' ? null : 'members')}
            title="멤버 목록"
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className={styles.memberCountText}>
              {(panelMode === 'members' ? roomMembers.length : (roomInfo?.memberCount ?? 0)) || ''}명
            </span>
          </button>

          {/* 채팅방 정보 버튼 */}
          <button
            className={`${styles.actionBtn} ${panelMode === 'info' ? styles.actionBtnInfoActive : ''}`}
            onClick={() => setPanelMode(v => v === 'info' ? null : 'info')}
            title="채팅방 정보"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <div className={styles.divider} />

          {/* 인라인 검색 바 */}
          <div className={`${styles.searchBar} ${searchOpen ? styles.searchBarOpen : ''}`}>
            <select
              className={styles.scopeSelect}
              value={searchScope}
              onChange={e => setSearchScope(e.target.value)}
            >
              <option value="all">전체</option>
              <option value="chat">채팅</option>
              <option value="file">파일</option>
              <option value="minutes">회의록</option>
              <option value="schedule">일정</option>
            </select>
            <div className={styles.searchInputWrap}>
              <svg className={styles.searchIcon} width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                className={styles.searchInput}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                ref={searchInputRef}
                placeholder="검색..."
                onKeyDown={e => e.key === 'Escape' && setSearchOpen(false)}
              />
            </div>
            <button className={styles.searchCloseBtn} onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>
              <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <button
            className={`${styles.actionBtn} ${searchOpen ? styles.actionBtnSearchActive : ''}`}
            title="검색"
            onClick={() => { setSearchOpen(v => !v); if (searchOpen) setSearchQuery(''); }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <button
            className={`${styles.actionBtn} ${activePanel === 'schedule' ? styles.actionBtnScheduleActive : ''}`}
            title="일정"
            onClick={() => openPanel('schedule')}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            className={`${styles.actionBtn} ${activePanel === 'file' ? styles.actionBtnFileActive : ''}`}
            title="파일"
            onClick={() => openPanel('file')}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </button>
          <button
            className={`${styles.actionBtn} ${activePanel === 'minutes' ? styles.actionBtnMinutesActive : ''}`}
            title="회의록"
            onClick={() => openPanel('minutes')}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button
            className={`${styles.actionBtn} ${activePanel === 'draw' ? styles.actionBtnDrawActive : ''}`}
            title="그림판"
            onClick={() => openPanel('draw')}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            className={`${styles.actionBtn} ${activePanel === 'chart' ? styles.actionBtnChartActive : ''}`}
            title="엑셀 데이터 시각화"
            onClick={() => openPanel('chart')}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
          <div className={styles.divider} />

          <button
            className={`${styles.actionBtn} ${voiceChatActive ? styles.actionBtnVoiceActive : styles.actionBtnGreen}`}
            title={voiceChatActive ? '음성채팅 종료' : '음성채팅'}
            onClick={handleVoiceClick}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          <button
            className={`${styles.actionBtn} ${videoChatActive ? styles.actionBtnVideoActive : styles.actionBtnGreen}`}
            title={videoChatActive ? '화상채팅 종료' : '화상채팅'}
            onClick={handleVideoClick}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>

          <div className={styles.divider} />
          <button className={styles.minimizeBtn} onClick={onMinimize} title="최소화">
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
            </svg>
          </button>
          <button className={styles.maximizeBtn} onClick={handleMaximize} title={isMaximized ? '복원' : '최대화'}>
            {isMaximized ? (
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="7" y="7" width="13" height="13" rx="1.5" strokeWidth={2} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17H5a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v2" />
              </svg>
            ) : (
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2.5} />
              </svg>
            )}
          </button>
          <button className={styles.closeBtn} onClick={onClose} title="닫기">
            <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 채팅방 내부 검색 결과 패널 */}
      {searchOpen && searchQuery.trim() && (
        <div className={styles.searchResultPanel}>
          {searchLoading && <div className={styles.searchResultHint}>검색 중...</div>}
          {!searchLoading && searchResults && (() => {
            const filtered = {
              messages:  searchScope === 'all' || searchScope === 'chat'     ? searchResults.messages  : [],
              files:     searchScope === 'all' || searchScope === 'file'     ? searchResults.files     : [],
              schedules: searchScope === 'all' || searchScope === 'schedule' ? searchResults.schedules : [],
              notes:     searchScope === 'all' || searchScope === 'minutes'  ? searchResults.notes     : [],
            };
            const total = filtered.messages.length + filtered.files.length + filtered.schedules.length + filtered.notes.length;
            if (total === 0) return <div className={styles.searchResultHint}>검색 결과가 없습니다.</div>;
            return (
              <>
                {filtered.messages.length > 0 && (
                  <div className={styles.searchSection}>
                    <div className={styles.searchSectionTitle}>채팅</div>
                    {filtered.messages.map(m => (
                      <div key={m.msgIdx} className={styles.searchResultItem}>
                        <span className={styles.searchResultName}>{m.senderNick}</span>
                        <span className={styles.searchResultDesc}>{m.content}</span>
                        {m.sentAt && <span className={styles.searchResultTime}>{m.sentAt.replace('T', ' ')}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {filtered.files.length > 0 && (
                  <div className={styles.searchSection}>
                    <div className={styles.searchSectionTitle}>파일</div>
                    {filtered.files.map(f => (
                      <div key={f.fileIdx} className={styles.searchResultItem}>
                        <span className={styles.searchResultName}>{f.filename}</span>
                        <span className={styles.searchResultDesc}>{f.uploaderNick}</span>
                        {f.uploadedAt && <span className={styles.searchResultTime}>{f.uploadedAt.replace('T', ' ')}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {filtered.schedules.length > 0 && (
                  <div className={styles.searchSection}>
                    <div className={styles.searchSectionTitle}>일정</div>
                    {filtered.schedules.map(s => (
                      <div key={s.scheduleIdx} className={styles.searchResultItem}>
                        <span className={styles.searchResultName}>{s.title}</span>
                        {s.date && <span className={styles.searchResultTime}>{s.date.replace('T', ' ')}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {filtered.notes.length > 0 && (
                  <div className={styles.searchSection}>
                    <div className={styles.searchSectionTitle}>회의록</div>
                    {filtered.notes.map(n => (
                      <div key={n.noteIdx} className={styles.searchResultItem}>
                        <span className={styles.searchResultName}>{n.title}</span>
                        <span className={styles.searchResultDesc}>{n.creatorNick}</span>
                        {n.createdAt && <span className={styles.searchResultTime}>{n.createdAt.replace('T', ' ')}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* 콘텐츠 + 사이드 패널 */}
      <div className={styles.contentRow}>
        <div
          className={styles.chatSection}
          onDragEnter={(e) => {
            if (!roomIdx) return;
            if (Array.from(e.dataTransfer.types).includes('Files')) { dragCounter.current++; setDragOver(true); }
          }}
          onDragOver={(e) => { if (roomIdx) e.preventDefault(); }}
          onDragLeave={() => { dragCounter.current = Math.max(0, dragCounter.current - 1); if (dragCounter.current === 0) setDragOver(false); }}
          onDrop={(e) => { e.preventDefault(); dragCounter.current = 0; setDragOver(false); uploadFiles(Array.from(e.dataTransfer.files)); }}
        >
          {dragOver && (
            <div className={styles.dropOverlay}>
              <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" />
              </svg>
              <span>여기에 파일을 놓아 업로드</span>
            </div>
          )}
          <MessageList
            messages={messages}
            loading={loading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            onLoadMore={loadMore}
            currentUserId={currentUserId}
            initialLoad={initialLoad}
            deletedFileIdx={deletedFileIdx}
          />

          {/* 음성 채팅 패널 */}
          {voiceChatActive && (
            <div className={styles.voicePanel}>
              {/* 원격 오디오 요소 (숨김) */}
              {Array.from(webrtc.remoteStreams.entries()).map(([uid, stream]) => (
                <AudioTrack key={uid} stream={stream} />
              ))}
              <div className={styles.voicePanelHeader}>
                <div className={styles.voicePanelTitle}>
                  <span className={styles.liveDot} />
                  음성 채팅 중
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    className={`${styles.recordBtn} ${webrtc.isRecording ? styles.recordBtnActive : ''}`}
                    onClick={webrtc.isRecording ? webrtc.stopRecording : webrtc.startRecording}
                    title={webrtc.isRecording ? '녹음 중지' : '녹음 시작'}
                  >
                    {webrtc.isRecording ? '■ 중지' : '● 녹음'}
                  </button>
                  <button className={styles.endCallBtn} onClick={() => setVoiceChatActive(false)}>
                    종료
                  </button>
                </div>
              </div>
              {webrtc.error && <p className={styles.voiceError}>{webrtc.error}</p>}
              <div className={styles.voiceParticipants}>
                {/* 로컬 사용자 */}
                <div className={styles.voiceParticipant}>
                  <div className={`${styles.voiceAvatar} ${webrtc.localSpeaking ? styles.voiceAvatarSpeaking : ''}`}>
                    {(currentNickname || '?')[0]}
                  </div>
                  <span className={styles.voiceName}>{currentNickname} (나)</span>
                  <div className={styles.voiceMicIcon}>
                    <MicIcon on={webrtc.localMicOn} />
                  </div>
                </div>
                {/* 원격 참여자 */}
                {webrtc.participants.map(p => (
                  <div key={`voice-${p.userId}`} className={styles.voiceParticipant}>
                    <div className={`${styles.voiceAvatar} ${webrtc.speakingUsers.has(p.userId) ? styles.voiceAvatarSpeaking : ''}`}>
                      {p.nickname?.[0] ?? '?'}
                    </div>
                    <span className={styles.voiceName}>{p.nickname}</span>
                    <div className={styles.voiceMicIcon}>
                      <MicIcon on={webrtc.micOnUsers.has(p.userId)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 화상 채팅 패널 */}
          {videoChatActive && (
            <div className={styles.videoPanel}>
              <div className={styles.videoPanelHeader}>
                <div className={styles.videoPanelTitle}>
                  <span className={`${styles.liveDot} ${styles.liveDotBlue}`} />
                  화상 채팅 중
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    className={`${styles.recordBtn} ${webrtc.isRecording ? styles.recordBtnActive : ''}`}
                    onClick={webrtc.isRecording ? webrtc.stopRecording : webrtc.startRecording}
                    title={webrtc.isRecording ? '녹음 중지' : '녹음 시작'}
                  >
                    {webrtc.isRecording ? '■ 중지' : '● 녹음'}
                  </button>
                  <button className={styles.endCallBtn} onClick={() => setVideoChatActive(false)}>
                    종료
                  </button>
                </div>
              </div>
              {webrtc.error && <p className={styles.voiceError}>{webrtc.error}</p>}
              <div className={styles.videoGrid}>
                {/* 로컬 사용자 */}
                <div className={styles.videoCell}>
                  <div className={`${styles.videoCam} ${webrtc.localSpeaking ? styles.videoSpeaking : ''}`}>
                    {webrtc.localStream
                      ? <video ref={webrtc.localVideoRef} autoPlay muted playsInline
                          className={`${styles.videoCamVideo} ${styles.videoCamMirror}`} />
                      : <div className={styles.videoCamInitial}>{(currentNickname || '?')[0]}</div>
                    }
                  </div>
                  <span className={styles.videoName}>{currentNickname} (나)</span>
                </div>
                {/* 원격 참여자 */}
                {webrtc.participants.map(p => (
                  <RemoteVideoTile
                    key={`video-${p.userId}`}
                    stream={webrtc.remoteStreams.get(p.userId)}
                    nickname={p.nickname}
                    speaking={webrtc.speakingUsers.has(p.userId)}
                    micOn={webrtc.micOnUsers.has(p.userId)}
                  />
                ))}
              </div>
            </div>
          )}

          <MessageInput
            channelName={win.chat.name}
            isDm={win.chat.type === 'dm'}
            showMicToggle={webrtcActive}
            micMuted={!webrtc.localMicOn}
            onMicToggle={webrtc.toggleMic}
            onSend={sendMessage}
            onFileUpload={sendFileMessage}
            roomIdx={roomIdx}
          />
        </div>

        {/* 사이드 패널 (멤버 / 채팅방 정보) */}
        <div className={`${styles.memberPanel} ${panelMode ? styles.memberPanelOpen : ''}`}>
          <div className={styles.memberPanelInner}>

            {/* ── 멤버 패널 ── */}
            {panelMode === 'members' && (
              <>
                <div className={styles.memberPanelHeader}>
                  <span>멤버</span>
                  <span className={styles.memberPanelCount}>{roomMembers.length}</span>
                </div>

                {/* 초대 검색 (모든 채팅방 — 권한은 백엔드 검증) */}
                {canManageMembers && (
                  <div className={styles.inviteSection}>
                    <div className={styles.inviteInputWrap}>
                      <input
                        className={styles.inviteInput}
                        placeholder="사용자 검색 후 초대..."
                        value={inviteQuery}
                        onChange={e => setInviteQuery(e.target.value)}
                      />
                      {inviteQuery && (
                        <button
                          type="button"
                          className={styles.inviteClearBtn}
                          onClick={() => setInviteQuery('')}
                          title="검색어 지우기"
                          aria-label="검색어 지우기"
                        >
                          <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {inviteSearching && <p className={styles.inviteHint}>검색 중...</p>}
                    {inviteResults.map(u => (
                      <div key={u.userId} className={styles.inviteResult}>
                        <div className={styles.memberPanelAvatar}>{u.nickname?.[0] ?? '?'}</div>
                        <span className={styles.inviteResultName}>{u.nickname}</span>
                        <button
                          className={styles.inviteBtn}
                          disabled={inviting === u.userId}
                          onClick={() => handleInvite(u.userId)}
                        >
                          초대
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className={styles.memberPanelList}>
                  {membersLoading
                    ? <p className={styles.inviteHint}>로딩 중...</p>
                    : roomMembers.map(m => (
                      <div key={m.userId} className={styles.memberPanelItem}>
                        <button
                          type="button"
                          className={styles.memberPanelClickable}
                          onClick={() => setViewingMember({ userId: m.userId, nickname: m.nickname ?? '', email: m.userId })}
                          title={`${m.nickname ?? ''} 정보 보기`}
                        >
                          <div className={styles.memberPanelAvatarWrap}>
                            {m.avatarUrl
                              ? <img src={`${API_BASE}${m.avatarUrl}`} alt={m.nickname ?? ''} className={styles.memberPanelAvatarImg} />
                              : <div className={styles.memberPanelAvatar}>{m.nickname?.[0] ?? '?'}</div>
                            }
                          </div>
                          <div className={styles.memberPanelInfo}>
                            <span className={styles.memberPanelName}>{m.nickname}</span>
                            {(m.role === 'OWNER' || m.role === 'LEADER') && (
                              <span className={styles.memberPanelRole}>방장</span>
                            )}
                          </div>
                        </button>
                        {isOwner && m.userId !== currentUserId && (
                          <button
                            className={styles.kickBtn}
                            title="내보내기"
                            onClick={() => handleKick(m.userId, m.nickname)}
                          >
                            <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))
                  }
                </div>

                {canManageMembers && (
                  <button className={styles.leaveBtn} onClick={handleLeave}>
                    채팅방 나가기
                  </button>
                )}
              </>
            )}

            {/* ── 채팅방 정보 패널 ── */}
            {panelMode === 'info' && (
              <>
                <div className={styles.memberPanelHeader}>
                  <span>채팅방 정보</span>
                  {/* I-13: 팀/일반 구분 없이 OWNER면 '채팅방 이름변경' 노출 */}
                  {isOwner && !editMode && (
                    <button className={styles.infoEditToggleBtn} onClick={() => setEditMode(true)}>
                      채팅방 이름변경
                    </button>
                  )}
                </div>

                {infoLoading && <p className={styles.inviteHint}>로딩 중...</p>}

                {!infoLoading && roomInfo && !editMode && (
                  <div className={styles.infoSection}>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>이름</span>
                      <span className={styles.infoValue}>{roomInfo.roomName}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>생성일</span>
                      <span className={styles.infoValue}>{formatDate(roomInfo.createdAt)}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>유형</span>
                      <span className={styles.infoValue}>채팅방</span>
                    </div>
                  </div>
                )}

                {!infoLoading && editMode && (
                  <div className={styles.infoSection}>
                    <div className={styles.infoEditGroup}>
                      <label className={styles.infoLabel}>이름</label>
                      <input
                        className={styles.infoEditInput}
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        maxLength={100}
                      />
                    </div>
                    <div className={styles.infoEditActions}>
                      <button
                        className={styles.infoSaveBtn}
                        onClick={handleSaveInfo}
                        disabled={saving || !editName.trim()}
                      >
                        {saving ? '저장 중...' : '저장'}
                      </button>
                      <button
                        className={styles.infoCancelBtn}
                        onClick={() => {
                          setEditMode(false);
                          setEditName(roomInfo?.roomName ?? '');
                        }}
                        disabled={saving}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* 우측 패널 */}
        <div className={`${styles.rightPanel} ${
          activePanel === 'draw' ? styles.rightPanelOpenDraw :
          activePanel            ? styles.rightPanelOpen     : ''
        }`}>
          {activePanel === 'schedule' && <SchedulePanel onClose={() => setActivePanel(null)} roomIdx={roomIdx} />}
          {activePanel === 'file'     && <FilePanel     onClose={() => setActivePanel(null)} roomIdx={roomIdx} currentUserId={currentUserId} />}
          {activePanel === 'minutes'  && <MinutesPanel  onClose={() => setActivePanel(null)} roomIdx={roomIdx} currentUserId={currentUserId} canManageDelete={canManageMinutesDelete} lastRecordingSegments={webrtc.lastRecordingSegments} lastRecordingMimeType={webrtc.lastRecordingMimeType} />}
          {activePanel === 'draw'     && <DrawPanel     onClose={() => setActivePanel(null)} roomIdx={roomIdx} />}
          {activePanel === 'chart'    && <ChartPanel    onClose={() => setActivePanel(null)} roomIdx={roomIdx} currentUserId={currentUserId} />}
        </div>
      </div>

      <div className={styles.resizeHandle} onMouseDown={handleResizeStart} />

      {/* 멤버 회원정보 모달(I-7) */}
      {viewingMember && (
        <UserProfileModal
          user={viewingMember}
          onClose={() => setViewingMember(null)}
        />
      )}

      {/* 확인 모달 */}
      {confirmModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <p className={styles.modalText}>
              {confirmModal === 'voice' && '음성 채팅을 시작하시겠습니까?'}
              {confirmModal === 'video' && '화상 채팅을 시작하시겠습니까?'}
              {confirmModal === 'to-voice' && '음성채팅으로 전환하시겠습니까?'}
              {confirmModal === 'to-video' && '화상채팅으로 전환하시겠습니까?'}
            </p>
            <div className={styles.modalBtns}>
              <button className={styles.modalBtnYes} onClick={() => handleConfirm(confirmModal)}>예</button>
              <button className={styles.modalBtnNo} onClick={() => setConfirmModal(null)}>아니오</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
