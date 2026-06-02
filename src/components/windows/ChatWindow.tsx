'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import MessageList from '@/components/chat/MessageList';
import MessageInput from '@/components/chat/MessageInput';
import SchedulePanel from '@/components/chat/SchedulePanel';
import FilePanel from '@/components/chat/FilePanel';
import MinutesPanel from '@/components/chat/MinutesPanel';
import DrawPanel from '@/components/chat/DrawPanel';
import styles from './ChatWindow.module.css';
import { getMembersForChat } from '@/data/mockData';
import type { ChatWindowState } from '@/app/page';

const MIN_WIDTH  = 600;
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
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState('all');
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);
  const [voiceChatActive, setVoiceChatActive] = useState(false);
  const [videoChatActive, setVideoChatActive] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [confirmModal, setConfirmModal] = useState<'voice' | 'video' | 'to-voice' | 'to-video' | null>(null);
  const [prevWinState, setPrevWinState] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const members = getMembersForChat(win.chat.id);

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

  const [activePanel, setActivePanel] = useState<'schedule' | 'file' | 'minutes' | 'draw' | null>(null);
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

  // 확장을 유발한 기능이 모두 비활성화되면 최소 크기 잠금 해제
  useEffect(() => {
    const locked = activePanel === 'schedule' || activePanel === 'draw' || videoChatActive;
    if (!locked) {
      minSizeRef.current = { w: MIN_WIDTH, h: MIN_HEIGHT };
    }
  }, [activePanel, videoChatActive]);

  const openPanel = (panel: 'schedule' | 'file' | 'minutes' | 'draw') => {
    if (activePanel === panel) { setActivePanel(null); return; }
    if (panel === 'schedule') {
      expandToHalf();
    } else if (panel === 'draw') {
      expandToHalf();
    }
    setActivePanel(panel);
  };

  // 데모용 모의 마이크/발화 상태 (인덱스 기반으로 고정)
  const memberMicOn = (idx: number) => idx % 3 !== 1;
  const memberSpeaking = (idx: number) => idx === 0;

  const handleVoiceClick = () => {
    if (voiceChatActive) {
      setVoiceChatActive(false);
      setMicMuted(false);
    } else if (videoChatActive) {
      setConfirmModal('to-voice');
    } else {
      setConfirmModal('voice');
    }
  };

  const handleVideoClick = () => {
    if (videoChatActive) {
      setVideoChatActive(false);
      setMicMuted(false);
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
    setMicMuted(false);
    setConfirmModal(null);
  };

  const handleDragStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isMaximized) return;
    if ((e.target as HTMLElement).closest('button, input, select')) return;
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

  return (
    <div
      className={styles.window}
      style={{ left: win.x, top: win.y, width: win.width, height: win.height, zIndex: win.zIndex }}
      onMouseDown={onBringToFront}
    >
      {/* 헤더 */}
      <div className={styles.header} onMouseDown={handleDragStart}>
        {/* 채널명 */}
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

          {/* 인라인 검색 바 (참여인원 버튼 옆) */}
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

          {/* 도구 버튼 */}
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
          <div className={styles.divider} />

          {/* 음성채팅 버튼 */}
          <button
            className={`${styles.actionBtn} ${voiceChatActive ? styles.actionBtnVoiceActive : styles.actionBtnGreen}`}
            title={voiceChatActive ? '음성채팅 종료' : '음성채팅'}
            onClick={handleVoiceClick}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>

          {/* 화상채팅 버튼 */}
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

      {/* 콘텐츠 + 멤버 패널 */}
      <div className={styles.contentRow}>
        <div className={styles.chatSection}>
          <MessageList />

          {/* 음성 채팅 패널 */}
          {voiceChatActive && (
            <div className={styles.voicePanel}>
              <div className={styles.voicePanelHeader}>
                <div className={styles.voicePanelTitle}>
                  <span className={styles.liveDot} />
                  음성 채팅 중
                </div>
                <button
                  className={styles.endCallBtn}
                  onClick={() => { setVoiceChatActive(false); setMicMuted(false); }}
                >
                  종료
                </button>
              </div>
              <div className={styles.voiceParticipants}>
                {members.map((m, idx) => (
                  <div key={`voice-${m.id}-${m.name}`} className={styles.voiceParticipant}>
                    <div className={`${styles.voiceAvatar} ${memberSpeaking(idx) ? styles.voiceAvatarSpeaking : ''}`}>
                      {m.name[0]}
                    </div>
                    <span className={styles.voiceName}>{m.name}</span>
                    <div className={`${styles.voiceMicIcon} ${memberMicOn(idx) ? styles.micOnColor : styles.micOffColor}`}>
                      {memberMicOn(idx) ? (
                        <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      ) : (
                        <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v3" />
                          <path strokeLinecap="round" strokeWidth={2} d="M3 3l18 18" />
                        </svg>
                      )}
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
                <button
                  className={styles.endCallBtn}
                  onClick={() => { setVideoChatActive(false); setMicMuted(false); }}
                >
                  종료
                </button>
              </div>
              <div className={styles.videoGrid}>
                {members.map(m => (
                  <div key={`video-${m.id}-${m.name}`} className={styles.videoCell}>
                    <div className={styles.videoCam}>
                      <div className={styles.videoCamInitial}>{m.name[0]}</div>
                    </div>
                    <span className={styles.videoName}>{m.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <MessageInput
            channelName={win.chat.name}
            isDm={win.chat.type === 'dm'}
            showMicToggle={voiceChatActive || videoChatActive}
            micMuted={micMuted}
            onMicToggle={() => setMicMuted(v => !v)}
          />
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

        {/* 우측 패널 */}
        <div className={`${styles.rightPanel} ${
          activePanel === 'draw' ? styles.rightPanelOpenDraw :
          activePanel            ? styles.rightPanelOpen     : ''
        }`}>
          {activePanel === 'schedule' && <SchedulePanel onClose={() => setActivePanel(null)} />}
          {activePanel === 'file'     && <FilePanel     onClose={() => setActivePanel(null)} />}
          {activePanel === 'minutes'  && <MinutesPanel  onClose={() => setActivePanel(null)} />}
          {activePanel === 'draw'     && <DrawPanel     onClose={() => setActivePanel(null)} />}
        </div>
      </div>

      <div className={styles.resizeHandle} onMouseDown={handleResizeStart} />

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
