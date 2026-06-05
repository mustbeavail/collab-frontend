'use client';

import { useRef, useState, useCallback } from 'react';
import ChatWindow from '@/components/windows/ChatWindow';
import NotificationBell from '@/components/notifications/NotificationBell';
import styles from './ChatArea.module.css';
import type { ChatWindowState } from '@/app/page';

interface Props {
  windows: ChatWindowState[];
  onClose: (windowId: string) => void;
  onCloseAll: () => void;
  onToggleMinimize: (windowId: string) => void;
  onUpdate: (windowId: string, updates: Partial<ChatWindowState>) => void;
  onBringToFront: (windowId: string) => void;
}

export default function ChatArea({ windows, onClose, onCloseAll, onToggleMinimize, onUpdate, onBringToFront }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const handleUnreadChange = useCallback((windowId: string, count: number) => {
    setUnreadCounts(prev => ({ ...prev, [windowId]: count }));
  }, []);

  const toggleSearch = () => {
    setSearchOpen(prev => {
      if (!prev) setTimeout(() => inputRef.current?.focus(), 50);
      return !prev;
    });
  };

  const minimized = windows.filter(w => w.minimized);

  return (
    <div className={styles.workspace}>
      {/* 배경 헤더 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerTitle}>워크스페이스</span>
          {windows.length > 0 && (
            <span className={styles.windowCount}>{windows.length}</span>
          )}
        </div>
        <div className={styles.headerActions}>
          {/* 검색 인풋 */}
          <div className={`${styles.searchBox} ${searchOpen ? styles.searchBoxOpen : ''}`}>
            <input
              ref={inputRef}
              className={styles.searchInput}
              placeholder="채팅방 검색..."
              onKeyDown={e => e.key === 'Escape' && setSearchOpen(false)}
            />
          </div>
          <button
            className={`${styles.headerBtn} ${searchOpen ? styles.headerBtnActive : ''}`}
            onClick={toggleSearch}
            title="검색"
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <NotificationBell />
          <button
            className={`${styles.headerBtn} ${styles.closeAllBtn} ${windows.length === 0 ? styles.closeAllBtnDisabled : ''}`}
            onClick={windows.length > 0 ? onCloseAll : undefined}
            title="채팅방 모두 닫기"
            disabled={windows.length === 0}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>채팅방 모두 닫기</span>
          </button>
        </div>
      </div>

      {/* 윈도우 캔버스 */}
      <div ref={containerRef} className={styles.canvas}>
        {windows.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className={styles.emptyTitle}>채팅방을 선택하세요</p>
            <p className={styles.emptyDesc}>왼쪽 메뉴에서 채널이나 친구를 선택해 대화를 시작하세요.</p>
          </div>
        )}

        {/* 항상 렌더링 — 최소화 시 display:none으로 숨김 (STOMP 구독 유지) */}
        {windows.map(win => (
          <ChatWindow
            key={win.windowId}
            win={win}
            containerRef={containerRef}
            onClose={() => onClose(win.windowId)}
            onMinimize={() => onToggleMinimize(win.windowId)}
            onUpdate={updates => onUpdate(win.windowId, updates)}
            onBringToFront={() => onBringToFront(win.windowId)}
            onUnreadChange={count => handleUnreadChange(win.windowId, count)}
          />
        ))}

        {minimized.length > 0 && (
          <div className={styles.minimizedStrip}>
            {minimized.map(win => {
              const unread = unreadCounts[win.windowId] ?? 0;
              return (
                <div key={win.windowId} className={styles.minimizedBar}>
                  <button className={styles.minBarRestore} onClick={() => onToggleMinimize(win.windowId)} title="복원">
                    <span className={styles.minBarPrefix}>{win.chat.type === 'channel' ? '#' : '@'}</span>
                    <span className={styles.minBarName}>{win.chat.name}</span>
                    {unread > 0 && (
                      <span className={styles.unreadBadge}>{unread > 99 ? '99+' : unread}</span>
                    )}
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" className={styles.minBarIcon}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button className={styles.minBarClose} onClick={() => onClose(win.windowId)} title="닫기">
                    <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
