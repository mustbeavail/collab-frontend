'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './MessageList.module.css';
import type { ChatMessage, FileMessageContent } from '@/types/chat';
import { fileService } from '@/services/file';
import { translateService } from '@/services/translate';
import UserProfileModal from '@/components/user/UserProfileModal';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

function resolveAvatar(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

interface Props {
  messages: ChatMessage[];
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  currentUserId?: string;
  initialLoad?: React.MutableRefObject<boolean>;
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${m}`;
}

function avatarText(nickname: string): string {
  return nickname?.charAt(0) ?? '?';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileMessageBubble({ content }: { content: string }) {
  let parsed: FileMessageContent | null = null;
  try { parsed = JSON.parse(content); } catch { return <p style={{ color: '#ef4444' }}>파일 정보를 불러올 수 없습니다.</p>; }
  if (!parsed) return null;
  const { fileIdx, oriFilename, fileSize } = parsed;
  return (
    <a
      href={fileService.getDownloadUrl(fileIdx)}
      download={oriFilename}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: '8px 12px', borderRadius: '8px',
        background: 'var(--bg-secondary, #f1f5f9)', textDecoration: 'none', color: 'inherit',
        border: '1px solid var(--border, #e2e8f0)',
      }}
    >
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      <span style={{ fontSize: '13px', fontWeight: 500 }}>{oriFilename}</span>
      <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>{formatFileSize(fileSize)}</span>
    </a>
  );
}

function TranslateIcon() {
  return (
    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
    </svg>
  );
}

export default function MessageList({ messages, loading, loadingMore, hasMore, onLoadMore, currentUserId, initialLoad }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);
  const prevMessagesLengthRef = useRef(0);

  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [translating, setTranslating] = useState<Record<number, boolean>>({});

  // F(23): 맨밑으로 버튼
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // F(10): 닉네임 클릭 → 회원정보 팝업
  const [profileTarget, setProfileTarget] = useState<{ userId: string; nickname: string; email: string } | null>(null);

  const handleTranslate = useCallback(async (msgIdx: number, text: string) => {
    if (translations[msgIdx] !== undefined) {
      setTranslations(prev => { const next = { ...prev }; delete next[msgIdx]; return next; });
      return;
    }
    setTranslating(prev => ({ ...prev, [msgIdx]: true }));
    try {
      const result = await translateService.translate(text, 'ko');
      setTranslations(prev => ({ ...prev, [msgIdx]: result }));
    } finally {
      setTranslating(prev => { const next = { ...prev }; delete next[msgIdx]; return next; });
    }
  }, [translations]);

  // 초기 로드 완료 시 맨 아래로 스크롤
  useEffect(() => {
    if (!loading && initialLoad?.current && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
      if (initialLoad) initialLoad.current = false;
    }
  }, [loading, messages.length, initialLoad]);

  // 새 메시지(STOMP) 수신 시 맨 아래 근처이면 자동 스크롤
  useEffect(() => {
    const el = listRef.current;
    if (!el || loadingMore) return;
    const addedAtBottom = messages.length > prevMessagesLengthRef.current
      && messages.length - prevMessagesLengthRef.current === 1;
    if (addedAtBottom) {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, loadingMore]);

  // 과거 메시지 prepend 후 스크롤 위치 복원
  useLayoutEffect(() => {
    if (loadingMore) {
      prevScrollHeightRef.current = listRef.current?.scrollHeight ?? 0;
    }
  }, [loadingMore]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || prevScrollHeightRef.current === 0) return;
    if (!loadingMore && prevScrollHeightRef.current > 0) {
      el.scrollTop += el.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
    }
  });

  // 스크롤 상단 감지 → 과거 메시지 로드 + F(23) 맨밑으로 버튼 표시
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    if (onLoadMore && hasMore && !loadingMore && el.scrollTop < 80) onLoadMore();
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setShowScrollBtn(!nearBottom);
  }, [onLoadMore, hasMore, loadingMore]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading) {
    return <div className={styles.list}><p className={styles.empty}>메시지 로딩 중...</p></div>;
  }

  if (messages.length === 0) {
    return <div className={styles.list}><p className={styles.empty}>아직 메시지가 없습니다.</p></div>;
  }

  return (
    <div className={styles.listWrap}>
      <div className={styles.list} ref={listRef} onScroll={handleScroll}>
        {loadingMore && <p className={styles.loadingMore}>이전 메시지 로딩 중...</p>}
        {hasMore && !loadingMore && <p className={styles.scrollHint}>위로 스크롤하면 이전 메시지를 불러옵니다</p>}

        {messages.map((msg) => {
          // G(11): SYSTEM 메시지 별도 표시
          if (msg.msgType === 'SYSTEM') {
            return (
              <div key={msg.msgIdx} className={styles.systemMessage}>
                {msg.content}
              </div>
            );
          }

          return (
            <div
              key={msg.msgIdx}
              className={`${styles.message} ${msg.userId === currentUserId ? styles.mine : ''}`}
            >
              {msg.userId !== currentUserId && (
                (() => {
                  const avatarSrc = resolveAvatar(msg.avatarUrl);
                  const openProfile = () => setProfileTarget({ userId: msg.userId, nickname: msg.nickname, email: msg.userId });
                  return avatarSrc
                    ? <img src={avatarSrc} alt={msg.nickname} className={`${styles.avatarImg} ${styles.avatarClickable}`} onClick={openProfile} title="프로필 보기" />
                    : <div className={`${styles.avatar} ${styles.avatarClickable}`} onClick={openProfile} title="프로필 보기">{avatarText(msg.nickname)}</div>;
                })()
              )}
              <div className={styles.body}>
                {msg.userId !== currentUserId && (
                  <div className={styles.meta}>
                    <span
                      className={`${styles.sender} ${styles.senderClickable}`}
                      onClick={() => setProfileTarget({ userId: msg.userId, nickname: msg.nickname, email: msg.userId })}
                      title="프로필 보기"
                    >
                      {msg.nickname}
                    </span>
                    <span className={styles.time}>{formatTime(msg.sentAt)}</span>
                  </div>
                )}
                {msg.msgType === 'FILE' ? (
                  <FileMessageBubble content={msg.content} />
                ) : (
                  <div className={styles.bubbleWrap}>
                    <p className={styles.content}>{msg.content}</p>
                    <button
                      className={`${styles.translateBtn} ${translations[msg.msgIdx] !== undefined ? styles.translateBtnActive : ''}`}
                      onClick={() => handleTranslate(msg.msgIdx, msg.content)}
                      title={translations[msg.msgIdx] !== undefined ? '번역 숨기기' : '한국어로 번역'}
                      disabled={translating[msg.msgIdx]}
                    >
                      {translating[msg.msgIdx] ? (
                        <span className={styles.translateSpinner} />
                      ) : (
                        <TranslateIcon />
                      )}
                    </button>
                    {translations[msg.msgIdx] !== undefined && (
                      <p className={styles.translatedText}>{translations[msg.msgIdx]}</p>
                    )}
                  </div>
                )}
                {msg.userId === currentUserId && (
                  <span className={`${styles.time} ${styles.mineTime}`}>{formatTime(msg.sentAt)}</span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* F(23): 맨밑으로 버튼 */}
      {showScrollBtn && (
        <button className={styles.scrollToBottomBtn} onClick={scrollToBottom} title="맨 아래로">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {/* F(10): 회원정보 팝업 */}
      {profileTarget && (
        <UserProfileModal
          user={profileTarget}
          onClose={() => setProfileTarget(null)}
        />
      )}
    </div>
  );
}
