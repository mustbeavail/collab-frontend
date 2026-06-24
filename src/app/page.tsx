'use client';

import { useState, useCallback, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import ChatArea from '@/components/layout/ChatArea';
import AuthGuard from '@/components/auth/AuthGuard';
import DemoTour from '@/components/demo/DemoTour';
import { StompProvider } from '@/providers/StompProvider';
import styles from './page.module.css';
import { friendService } from '@/services/friend';
import { useNotificationStore } from '@/store/notificationStore';
import { useWebSocket } from '@/hooks/useWebSocket';

export type ChatInfo = {
  id: string;
  name: string;
  type: 'channel' | 'dm';
  targetUserId?: string;
};

export type ChatWindowState = {
  windowId: string;
  chat: ChatInfo;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
  roomIdx?: number; // 해결된 채팅방 idx(I-10 중복창 방지·I-13 실시간 이름반영)
};

const MAX_WINDOWS = 20;

// chat.id에서 roomIdx 추출(가능한 경우). 'channel-{team}-{room}'·'room-{room}'은 마지막 숫자, dm-은 불가(null).
function extractRoomIdx(id: string): number | null {
  if (id.startsWith('dm-')) return null;
  const last = id.split('-').pop();
  const n = last ? Number(last) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * /user/queue 실시간 구독은 StompProvider 컨텍스트 안에서만 client를 얻을 수 있다.
 * Home 본문에서 useWebSocket()을 호출하면 Provider 바깥이라 client가 항상 null이 되어
 * 친구요청/팀초대/FORCE_LOGOUT/NEW_MESSAGE 구독이 전혀 일어나지 않았다(실시간 미수신 버그).
 * Provider 하위 컴포넌트에서 호출하도록 분리한다.
 */
function WebSocketBridge() {
  useWebSocket();
  return null;
}

export default function Home() {
  const [windows, setWindows] = useState<ChatWindowState[]>([]);
  const [shakingId, setShakingId] = useState<string | null>(null);

  const { setPendingRequests, setLoading } = useNotificationStore();
  useEffect(() => {
    setLoading(true);
    friendService.getPendingRequests()
      .then(setPendingRequests)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [setPendingRequests, setLoading]);

  const openChat = useCallback((chat: ChatInfo) => {
    const existing = windows.find(w => w.chat.id === chat.id);

    if (existing) {
      if (existing.minimized) {
        // 최소화 상태 → 복원
        const maxZ = Math.max(0, ...windows.map(w => w.zIndex));
        setWindows(prev =>
          prev.map(w => w.windowId === existing.windowId
            ? { ...w, zIndex: maxZ + 1, minimized: false }
            : w
          )
        );
      } else {
        // 열린 상태 → 토글 닫기
        setWindows(prev => prev.filter(w => w.windowId !== existing.windowId));
      }
      return;
    }

    // I-10: 다른 id라도 같은 채팅방(roomIdx)이 이미 열려 있으면 새 창 안 띄우고 기존 창 포커스/복원.
    // (예: 사이드바 'channel-…'로 연 방을 헤더 알림 'room-…'로 다시 열 때 중복 방지)
    const targetRoomIdx = extractRoomIdx(chat.id);
    if (targetRoomIdx != null) {
      const dupe = windows.find(w => w.roomIdx === targetRoomIdx);
      if (dupe) {
        const maxZ = Math.max(0, ...windows.map(w => w.zIndex));
        setWindows(prev => prev.map(w => w.windowId === dupe.windowId
          ? { ...w, zIndex: maxZ + 1, minimized: false }
          : w));
        return;
      }
    }

    if (windows.length >= MAX_WINDOWS) {
      setShakingId(chat.id);
      setTimeout(() => setShakingId(null), 700);
      return;
    }

    const offset = (windows.length % 10) * 30;
    const maxZ = Math.max(0, ...windows.map(w => w.zIndex));
    setWindows(prev => [...prev, {
      windowId: `win-${Date.now()}-${Math.random()}`,
      chat,
      x: 32 + offset,
      y: 72 + offset,
      width: 560,
      height: 600,
      zIndex: maxZ + 1,
      minimized: false,
      roomIdx: targetRoomIdx ?? undefined, // dm-은 ChatWindow가 해결 후 보고
    }]);
  }, [windows]);

  // ChatWindow가 roomIdx를 해결하면 보고받아 저장(I-10 중복판정·I-13 이름반영)
  const setWindowRoomIdx = useCallback((windowId: string, roomIdx: number) => {
    setWindows(prev => prev.map(w => w.windowId === windowId ? { ...w, roomIdx } : w));
  }, []);

  const closeWindow = useCallback((windowId: string) => {
    setWindows(prev => prev.filter(w => w.windowId !== windowId));
  }, []);

  // 헤더 알림벨 메시지 알림 클릭 → 채팅방 열기(I-3)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as ChatInfo | undefined;
      if (detail) openChat(detail);
    };
    window.addEventListener('collab:open-chat', handler);
    return () => window.removeEventListener('collab:open-chat', handler);
  }, [openChat]);

  // 채팅방 이름 변경 실시간 반영(I-13) → 열린 창 헤더 타이틀 갱신
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail as { roomIdx: number; roomName: string } | undefined;
      if (!d) return;
      setWindows(prev => prev.map(w =>
        w.roomIdx === d.roomIdx ? { ...w, chat: { ...w.chat, name: d.roomName } } : w
      ));
    };
    window.addEventListener('collab:room-renamed', handler);
    return () => window.removeEventListener('collab:room-renamed', handler);
  }, []);

  const updateWindow = useCallback((windowId: string, updates: Partial<ChatWindowState>) => {
    setWindows(prev => prev.map(w => w.windowId === windowId ? { ...w, ...updates } : w));
  }, []);

  const bringToFront = useCallback((windowId: string) => {
    setWindows(prev => {
      const maxZ = Math.max(0, ...prev.map(w => w.zIndex));
      return prev.map(w => w.windowId === windowId ? { ...w, zIndex: maxZ + 1 } : w);
    });
  }, []);

  const toggleMinimize = useCallback((windowId: string) => {
    setWindows(prev => {
      const maxZ = Math.max(0, ...prev.map(w => w.zIndex));
      return prev.map(w => w.windowId === windowId
        ? { ...w, minimized: !w.minimized, zIndex: w.minimized ? maxZ + 1 : w.zIndex }
        : w
      );
    });
  }, []);

  const closeAll = useCallback(() => setWindows([]), []);

  return (
    <AuthGuard>
      <StompProvider>
      <WebSocketBridge />
      <DemoTour />
      <div className={styles.layout}>
        <Sidebar
          openChatIds={windows.map(w => w.chat.id)}
          shakingChatId={shakingId}
          onChatOpen={openChat}
        />
        <ChatArea
          windows={windows}
          onClose={closeWindow}
          onCloseAll={closeAll}
          onToggleMinimize={toggleMinimize}
          onUpdate={updateWindow}
          onBringToFront={bringToFront}
          onResolveRoomIdx={setWindowRoomIdx}
        />
      </div>
      </StompProvider>
    </AuthGuard>
  );
}
