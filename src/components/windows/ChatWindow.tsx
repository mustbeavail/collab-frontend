'use client';

import { useCallback, useState } from 'react';
import MessageList from '@/components/chat/MessageList';
import MessageInput from '@/components/chat/MessageInput';
import styles from './ChatWindow.module.css';
import { getMembersForChat } from '@/data/mockData';
import type { ChatWindowState } from '@/app/page';

const MIN_WIDTH  = 420;
const MIN_HEIGHT = 400;

interface Props {
  win: ChatWindowState;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onMinimize: () => void;
  onUpdate: (updates: Partial<ChatWindowState>) => void;
  onBringToFront: () => void;
}

export default function ChatWindow({ win, containerRef, onClose, onMinimize, onUpdate, onBringToFront }: Props) {
  const [membersOpen, setMembersOpen] = useState(false);
  const members = getMembersForChat(win.chat.id);

  const handleDragStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
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
        width:  Math.max(MIN_WIDTH,  Math.min(startW + e.clientX - startMouseX, rect.width  - winX)),
        height: Math.max(MIN_HEIGHT, Math.min(startH + e.clientY - startMouseY, rect.height - winY)),
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

  return (
    <div
      className={styles.window}
      style={{ left: win.x, top: win.y, width: win.width, height: win.height, zIndex: win.zIndex }}
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
            className={`${styles.membersBtn} ${membersOpen ? styles.membersBtnActive : ''}`}
            onClick={() => setMembersOpen(v => !v)}
            title="멤버 목록"
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className={styles.memberCountText}>{members.length}명</span>
          </button>
          <div className={styles.divider} />

          {/* 도구 버튼 */}
          <button className={styles.actionBtn} title="검색">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <button className={styles.actionBtn} title="일정">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <button className={styles.actionBtn} title="파일">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </button>
          <button className={styles.actionBtn} title="회의록">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button className={styles.actionBtn} title="그림판">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <div className={styles.divider} />
          <button className={`${styles.actionBtn} ${styles.actionBtnGreen}`} title="음성채팅">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          <button className={`${styles.actionBtn} ${styles.actionBtnGreen}`} title="화상채팅">
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
          <button className={styles.closeBtn} onClick={onClose} title="닫기">
            <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 콘텐츠 + 멤버 패널 */}
      <div className={styles.contentRow}>
        <div className={styles.chatSection}>
          <MessageList />
          <MessageInput channelName={win.chat.name} isDm={win.chat.type === 'dm'} />
        </div>

        <div className={`${styles.memberPanel} ${membersOpen ? styles.memberPanelOpen : ''}`}>
          <div className={styles.memberPanelInner}>
            <div className={styles.memberPanelHeader}>
              <span>멤버</span>
              <span className={styles.memberPanelCount}>{members.length}</span>
            </div>
            <div className={styles.memberPanelList}>
              {members.map(m => (
                <div key={`${m.id}-${m.name}`} className={styles.memberPanelItem}>
                  <div className={styles.memberPanelAvatarWrap}>
                    <div className={styles.memberPanelAvatar}>{m.name[0]}</div>
                    <div className={`${styles.memberPanelDot} ${m.online ? styles.memberOnline : styles.memberOffline}`} />
                  </div>
                  <div className={styles.memberPanelInfo}>
                    <span className={styles.memberPanelName}>{m.name}</span>
                    {m.role && <span className={styles.memberPanelRole}>{m.role}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.resizeHandle} onMouseDown={handleResizeStart} />
    </div>
  );
}
