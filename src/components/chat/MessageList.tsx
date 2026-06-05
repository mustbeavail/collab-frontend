'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import styles from './MessageList.module.css';
import type { ChatMessage } from '@/types/chat';

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
            <p className={styles.content}>{msg.content}</p>
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
