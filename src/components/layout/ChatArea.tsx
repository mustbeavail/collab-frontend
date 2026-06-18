'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import ChatWindow from '@/components/windows/ChatWindow';
import NotificationBell from '@/components/notifications/NotificationBell';
import CalendarPopup from '@/components/calendar/CalendarPopup';
import SearchModal from '@/components/search/SearchModal';
import { testbotService } from '@/services/testbot';
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

function Clock() {
  const [time, setTime] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  });

  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return <span className={styles.clock}>{time}</span>;
}

function TestBotButton() {
  const [showTip, setShowTip] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const onEnter = () => {
    hoverTimer.current = setTimeout(() => setShowTip(true), 500);
  };
  const onLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setShowTip(false);
  };

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const handleClick = async () => {
    if (busy) return;
    setShowTip(false);
    setBusy(true);
    try {
      const res = await testbotService.invite();
      showToast(true, res?.message ?? '테스트봇이 친구 요청을 보냈어요!');
    } catch {
      showToast(false, '요청 실패. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={styles.testbotContainer}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <button
        className={`${styles.headerBtn} ${styles.testbotBtn} ${busy ? styles.testbotBtnBusy : ''}`}
        onClick={handleClick}
        disabled={busy}
      >
        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="8" width="16" height="11" rx="2" strokeWidth={1.5} />
          <path strokeLinecap="round" strokeWidth={1.5} d="M12 8V4M9 3h6" />
          <circle cx="9" cy="13" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="13" r="1" fill="currentColor" stroke="none" />
        </svg>
        <span>기능 테스트</span>
      </button>

      {showTip && !toast && (
        <div className={styles.testbotTooltip}>
          <div className={styles.testbotTooltipTitle}>🤖 채팅 기능 테스트 봇</div>
          <p className={styles.testbotTooltipDesc}>
            클릭하면 AI 테스트봇이 친구 요청을 보내요. 수락하면 봇이 안내 메시지를 보내고,
            이후 봇과 자유롭게 채팅하며 메시지·번역 등 채팅 기능을 시험해 볼 수 있어요.
          </p>
        </div>
      )}

      {toast && (
        <div className={`${styles.testbotToast} ${toast.ok ? styles.testbotToastOk : styles.testbotToastErr}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

export default function ChatArea({ windows, onClose, onCloseAll, onToggleMinimize, onUpdate, onBringToFront }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const calendarRef = useRef<HTMLDivElement>(null);

  const handleUnreadChange = useCallback((windowId: string, count: number) => {
    setUnreadCounts(prev => ({ ...prev, [windowId]: count }));
  }, []);

  const minimized = windows.filter(w => w.minimized);

  return (
    <div className={styles.workspace}>
      {/* 글로벌 검색 모달 */}
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}

      {/* 배경 헤더 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerTitle}>워크스페이스</span>
          {windows.length > 0 && (
            <span className={styles.windowCount}>{windows.length}</span>
          )}
        </div>
        <div className={styles.headerActions}>
          <Clock />

          {/* 기능 테스트(테스트봇) 버튼 */}
          <TestBotButton />

          {/* 글로벌 검색 버튼 */}
          <button
            className={`${styles.headerBtn} ${searchOpen ? styles.headerBtnActive : ''}`}
            onClick={() => setSearchOpen(true)}
            title="검색 (친구·팀·채팅방)"
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* 캘린더 버튼 */}
          <div ref={calendarRef} className={styles.calendarContainer}>
            <button
              className={`${styles.headerBtn} ${calendarOpen ? styles.headerBtnActive : ''}`}
              onClick={() => setCalendarOpen(v => !v)}
              title="캘린더 (전체 일정)"
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            {calendarOpen && <CalendarPopup onClose={() => setCalendarOpen(false)} />}
          </div>

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
            <p className={styles.emptyDesc}>왼쪽 메뉴에서 채팅방이나 친구를 선택해 대화를 시작하세요.</p>
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
