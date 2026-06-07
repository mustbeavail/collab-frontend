'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import styles from './MessageList.module.css';
import type { ChatMessage, FileMessageContent } from '@/types/chat';
import { fileService } from '@/services/file';

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

export default function MessageList({ messages, loading, loadingMore, hasMore, onLoadMore, currentUserId, initialLoad }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);
  const prevMessagesLengthRef = useRef(0);

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
      && messages.length - prevMessagesLengthRef.current === 1; // STOMP 메시지는 1개씩 추가
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

  // 스크롤 상단 감지 → 과거 메시지 로드
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || !onLoadMore || !hasMore || loadingMore) return;
    if (el.scrollTop < 80) onLoadMore();
  }, [onLoadMore, hasMore, loadingMore]);

  if (loading) {
    return <div className={styles.list}><p className={styles.empty}>메시지 로딩 중...</p></div>;
  }

  if (messages.length === 0) {
    return <div className={styles.list}><p className={styles.empty}>아직 메시지가 없습니다.</p></div>;
  }

  return (
    <div className={styles.list} ref={listRef} onScroll={handleScroll}>
      {loadingMore && <p className={styles.loadingMore}>이전 메시지 로딩 중...</p>}
      {hasMore && !loadingMore && <p className={styles.scrollHint}>위로 스크롤하면 이전 메시지를 불러옵니다</p>}

      {messages.map((msg) => (
        <div
          key={msg.msgIdx}
          className={`${styles.message} ${msg.userId === currentUserId ? styles.mine : ''}`}
        >
          {msg.userId !== currentUserId && (
            msg.avatarUrl
              ? <img src={msg.avatarUrl} alt={msg.nickname} className={styles.avatarImg} />
              : <div className={styles.avatar}>{avatarText(msg.nickname)}</div>
          )}
          <div className={styles.body}>
            {msg.userId !== currentUserId && (
              <div className={styles.meta}>
                <span className={styles.sender}>{msg.nickname}</span>
                <span className={styles.time}>{formatTime(msg.sentAt)}</span>
              </div>
            )}
            {msg.msgType === 'FILE'
              ? <FileMessageBubble content={msg.content} />
              : <p className={styles.content}>{msg.content}</p>
            }
            {msg.userId === currentUserId && (
              <span className={`${styles.time} ${styles.mineTime}`}>{formatTime(msg.sentAt)}</span>
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
