'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStompClient } from '@/providers/StompProvider';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import type { FriendItem } from '@/types/friend';

interface NotificationPayload extends FriendItem {
  type: string;
}

export function useWebSocket() {
  const client = useStompClient();
  const addRequest = useNotificationStore((s) => s.addRequest);
  const clear = useAuthStore((s) => s.clear);
  const setUserOnline = useFriendStore((s) => s.setUserOnline);
  const setUserOffline = useFriendStore((s) => s.setUserOffline);
  const router = useRouter();

  useEffect(() => {
    if (!client) return;

    const notifSub = client.subscribe('/user/queue/notifications', (frame) => {
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
        } else if (payload.type === 'USER_STATUS') {
          if (payload.status === 'ONLINE') setUserOnline(payload.userId);
          else setUserOffline(payload.userId);
        }
      } catch { /* 파싱 실패 무시 */ }
    });

    const sessionSub = client.subscribe('/user/queue/session', (frame) => {
      try {
        const payload: { type: string } = JSON.parse(frame.body);
        if (payload.type === 'FORCE_LOGOUT') {
          clear();
          router.replace('/login');
        }
      } catch { /* 파싱 실패 무시 */ }
    });

    return () => {
      notifSub.unsubscribe();
      sessionSub.unsubscribe();
    };
  }, [client, addRequest, clear, setUserOnline, setUserOffline, router]);
}
