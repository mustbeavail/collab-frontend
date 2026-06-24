'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStompClient } from '@/providers/StompProvider';
import { chatService } from '@/services/chat';
import { useDemoStore } from '@/store/demoStore';
import { useAuthStore } from '@/store/authStore';
import { DEMO_BOT_ID, DEMO_BOT_NICK, demoBotReply } from '@/lib/demoFixtures';
import type { ChatMessage } from '@/types/chat';

export function useChatRoom(roomIdx: number | null, active: boolean = true) {
  const client = useStompClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [deletedFileIdx, setDeletedFileIdx] = useState<Set<number>>(new Set());
  // 테스트봇 '답변 생성 중' 인디케이터(BOT_TYPING 수신 시 표시, 실제 메시지 도착 시 해제)
  const [botTyping, setBotTyping] = useState<{ nickname: string; avatarUrl: string | null } | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoad = useRef(true);
  const activeRef = useRef(active);
  const seenIds = useRef<Set<number>>(new Set());

  const clearBotTyping = useCallback(() => {
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
    setBotTyping(null);
  }, []);

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

  // 시연 모드: 시연이 만든 친구관계(friendIdx 추적됨)의 DM방이 열리면 정리 대상으로 등록.
  // (이미 친구였던 계정의 기존 DM은 friendIdx가 없으므로 등록되지 않아 보존된다.)
  useEffect(() => {
    if (!roomIdx) return;
    const demo = useDemoStore.getState();
    if (demo.active && demo.artifacts.friendIdx != null && demo.artifacts.dmRoomIdx == null) {
      demo.setArtifact({ dmRoomIdx: roomIdx });
    }
  }, [roomIdx]);

  // 초기 로드
  useEffect(() => {
    if (!roomIdx) return;
    initialLoad.current = true;
    setLoading(true);
    setMessages([]);
    setHasMore(false);
    setDeletedFileIdx(new Set());
    clearBotTyping();
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

        // 파일 삭제 이벤트(항목1 추가): 메시지는 남기고 '삭제된 파일'로 표시 + 파일함 동기화
        if (msg.msgType === 'FILE_DELETED') {
          const fid = Number(msg.content);
          if (!Number.isNaN(fid)) {
            setDeletedFileIdx((prev) => { const next = new Set(prev); next.add(fid); return next; });
            window.dispatchEvent(new CustomEvent('collab:file-deleted', { detail: { roomIdx, fileIdx: fid } }));
          }
          return;
        }

        // 테스트봇 '답변 생성 중' 신호: 실제 메시지가 아니므로 인디케이터만 켠다(30초 안전 타임아웃)
        if (msg.msgType === 'BOT_TYPING') {
          setBotTyping({ nickname: msg.nickname, avatarUrl: msg.avatarUrl });
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => setBotTyping(null), 30000);
          return;
        }

        // 중복 메시지 dedup
        if (seenIds.current.has(msg.msgIdx)) return;
        seenIds.current.add(msg.msgIdx);

        // 실제 메시지가 도착하면 '답변 생성 중' 인디케이터를 해제(응답으로 대체)
        if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
        setBotTyping(null);

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

    return () => {
      sub.unsubscribe();
      if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
    };
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
    if (!content.trim()) return;

    // 시연 모드: 실제 WS 발행 없이 로컬로 대화를 연출(실 Gemini 미호출, 고정 봇 응답).
    if (useDemoStore.getState().active) {
      const me = useAuthStore.getState().user;
      const now = () => new Date().toISOString();
      const baseIdx = -Date.now();
      setMessages((prev) => [...prev, {
        msgIdx: baseIdx, userId: me?.userId ?? 'me', nickname: me?.nickname ?? '나',
        avatarUrl: null, content, msgType: 'TEXT', sentAt: now(),
      }]);
      const reply = demoBotReply(content);
      setTimeout(() => {
        setMessages((prev) => [...prev, {
          msgIdx: baseIdx - 1, userId: DEMO_BOT_ID, nickname: DEMO_BOT_NICK,
          avatarUrl: null, content: reply, msgType: 'TEXT', sentAt: now(),
        }]);
      }, 900);
      return;
    }

    if (!client || !roomIdx) return;
    client.publish({
      destination: `/app/chat.send/${roomIdx}`,
      body: JSON.stringify({ content, msgType: 'TEXT' }),
    });
  }, [client, roomIdx]);

  const sendFileMessage = useCallback((fileIdx: number, oriFilename: string, fileSize: number, fileExtension: string) => {
    const content = JSON.stringify({ fileIdx, oriFilename, fileSize, fileExtension });

    // 시연 모드: 파일은 실제 업로드되지만(정리 대상으로 추적), 메시지는 로컬로만 표시(WS 미발행 → 봇 응답 안 함).
    if (useDemoStore.getState().active) {
      useDemoStore.getState().addFileIdx(fileIdx);
      const me = useAuthStore.getState().user;
      setMessages((prev) => [...prev, {
        msgIdx: -Date.now(), userId: me?.userId ?? 'me', nickname: me?.nickname ?? '나',
        avatarUrl: null, content, msgType: 'FILE', sentAt: new Date().toISOString(),
      }]);
      return;
    }

    if (!client || !roomIdx) return;
    client.publish({
      destination: `/app/chat.send/${roomIdx}`,
      body: JSON.stringify({ content, msgType: 'FILE' }),
    });
  }, [client, roomIdx]);

  return { messages, loading, loadingMore, hasMore, loadMore, sendMessage, sendFileMessage, deletedFileIdx, botTyping, initialLoad, unreadCount };
}
