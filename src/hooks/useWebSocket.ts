'use client';

import { useEffect } from 'react';
import { useStompClient } from '@/providers/StompProvider';
import { useNotificationStore } from '@/store/notificationStore';
import type { FriendItem } from '@/types/friend';

interface NotificationPayload extends FriendItem {
  type: string;
}

export function useWebSocket() {
  const client = useStompClient();
  const addRequest = useNotificationStore((s) => s.addRequest);

  useEffect(() => {
    if (!client) return;

    const sub = client.subscribe('/user/queue/notifications', (frame) => {
      try {
        const payload: NotificationPayload = JSON.parse(frame.body);
        if (payload.type === 'FRIEND_REQUEST') {
          addRequest({
            friendIdx: payload.friendIdx,
            userId: payload.userId,
            nickname: payload.nickname,
            email: payload.email,
            status: payload.status,
          });
        }
      } catch { /* 파싱 실패 무시 */ }
    });

    return () => sub.unsubscribe();
  }, [client, addRequest]);
}
