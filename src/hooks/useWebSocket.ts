'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStompClient } from '@/providers/StompProvider';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import { useChatNotifStore } from '@/store/chatNotifStore';

interface NotificationPayload {
  type: string;
  // 친구요청(FRIEND_REQUEST) / 상태(USER_STATUS)
  friendIdx?: number;
  userId?: string;
  nickname?: string;
  email?: string;
  status?: string;
  avatarUrl?: string | null;
  // 팀초대(TEAM_INVITE)
  tmIdx?: number;
  teamIdx?: number;
  teamName?: string;
  // 새 메시지(NEW_MESSAGE)
  roomIdx?: number;
  content?: string;
}

export function useWebSocket() {
  const client = useStompClient();
  const addRequest = useNotificationStore((s) => s.addRequest);
  const addTeamInvitation = useNotificationStore((s) => s.addTeamInvitation);
  const bumpUnread = useChatNotifStore((s) => s.bump);
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
            friendIdx: payload.friendIdx!,
            userId: payload.userId!,
            nickname: payload.nickname!,
            email: payload.email!,
            status: payload.status!,
            avatarUrl: payload.avatarUrl,
          });
        } else if (payload.type === 'TEAM_INVITE') {
          // 실시간 팀초대 알림(qa 항목12)
          addTeamInvitation({
            tmIdx: payload.tmIdx!,
            teamIdx: payload.teamIdx!,
            teamName: payload.teamName!,
          });
        } else if (payload.type === 'NEW_MESSAGE' && payload.roomIdx != null) {
          // 미개방 방 메시지 알림(qa 항목15): 미읽음 증가 + 브라우저 알림
          bumpUnread(payload.roomIdx);
          if (typeof window !== 'undefined' && 'Notification' in window
              && Notification.permission === 'granted' && document.hidden) {
            new Notification(`새 메시지 — ${payload.nickname ?? ''}`, {
              body: payload.content ?? '',
              tag: `chat-${payload.roomIdx}`,
            });
          }
        } else if (payload.type === 'USER_STATUS' && payload.userId) {
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
          alert('다른 기기에서 로그인되어 로그아웃되었습니다.');
          router.replace('/login');
        }
      } catch { /* 파싱 실패 무시 */ }
    });

    return () => {
      notifSub.unsubscribe();
      sessionSub.unsubscribe();
    };
  }, [client, addRequest, addTeamInvitation, bumpUnread, clear, setUserOnline, setUserOffline, router]);
}
