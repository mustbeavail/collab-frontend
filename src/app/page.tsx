'use client';

import { useState, useCallback, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import ChatArea from '@/components/layout/ChatArea';
import AuthGuard from '@/components/auth/AuthGuard';
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
};

const MAX_WINDOWS = 20;

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
    }]);
  }, [windows]);

  const closeWindow = useCallback((windowId: string) => {
    setWindows(prev => prev.filter(w => w.windowId !== windowId));
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
        />
      </div>
      </StompProvider>
    </AuthGuard>
  );
}
