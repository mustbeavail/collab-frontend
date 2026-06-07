'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStompClient } from '@/providers/StompProvider';
import { chatService } from '@/services/chat';
import type { ChatMessage } from '@/types/chat';

export function useChatRoom(roomIdx: number | null, active: boolean = true) {
  const client = useStompClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const initialLoad = useRef(true);
  const activeRef = useRef(active);
  const seenIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    activeRef.current = active;
    if (active) setUnreadCount(0);
  }, [active]);

  // 브라우저 알림 권한 요청 — 방 진입 시 1회
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [roomIdx]);

  // 초기 로드
  useEffect(() => {
    if (!roomIdx) return;
    initialLoad.current = true;
    setLoading(true);
    setMessages([]);
    setHasMore(false);
    seenIds.current = new Set();
    chatService.getMessages(roomIdx)
      .then(({ messages: msgs, hasMore: more }) => {
        msgs.forEach(m => seenIds.current.add(m.msgIdx));
        setMessages(msgs);
        setHasMore(more);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [roomIdx]);

  // STOMP 실시간 구독
  useEffect(() => {
    if (!client || !roomIdx) return;

    const sub = client.subscribe(`/topic/room/${roomIdx}`, (frame) => {
      try {
        const msg: ChatMessage = JSON.parse(frame.body);

        // 중복 메시지 dedup
        if (seenIds.current.has(msg.msgIdx)) return;
        seenIds.current.add(msg.msgIdx);

        setMessages((prev) => [...prev, msg]);

        if (!activeRef.current) {
          setUnreadCount((prev) => prev + 1);
        }
        if (document.hidden && Notification.permission === 'granted') {
          new Notification(`새 메시지 — ${msg.nickname}`, {
            body: msg.content,
            icon: msg.avatarUrl ?? undefined,
            tag: `chat-${roomIdx}`,
          });
        }
      } catch { /* 파싱 실패 무시 */ }
    });

    return () => sub.unsubscribe();
  }, [client, roomIdx]);

  // 과거 메시지 추가 로드
  const loadMore = useCallback(async () => {
    if (!roomIdx || loadingMore || !hasMore) return;
    const oldestMsgIdx = messages[0]?.msgIdx;
    if (oldestMsgIdx === undefined) return;

    setLoadingMore(true);
    try {
      const { messages: older, hasMore: more } = await chatService.getMessages(roomIdx, oldestMsgIdx);
      const newOlder = older.filter(m => !seenIds.current.has(m.msgIdx));
      newOlder.forEach(m => seenIds.current.add(m.msgIdx));
      setMessages((prev) => [...newOlder, ...prev]);
      setHasMore(more);
    } catch { /* 요청 실패 무시 */ }
    finally { setLoadingMore(false); }
  }, [roomIdx, loadingMore, hasMore, messages]);

  const sendMessage = useCallback((content: string) => {
    if (!client || !roomIdx || !content.trim()) return;
    client.publish({
      destination: `/app/chat.send/${roomIdx}`,
      body: JSON.stringify({ content, msgType: 'TEXT' }),
    });
  }, [client, roomIdx]);

  const sendFileMessage = useCallback((fileIdx: number, oriFilename: string, fileSize: number, fileExtension: string) => {
    if (!client || !roomIdx) return;
    const content = JSON.stringify({ fileIdx, oriFilename, fileSize, fileExtension });
    client.publish({
      destination: `/app/chat.send/${roomIdx}`,
      body: JSON.stringify({ content, msgType: 'FILE' }),
    });
  }, [client, roomIdx]);

  return { messages, loading, loadingMore, hasMore, loadMore, sendMessage, sendFileMessage, initialLoad, unreadCount };
}
