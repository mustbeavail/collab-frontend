'use client';

import { useEffect, useRef, useState } from 'react';
import { useNotificationStore } from '@/store/notificationStore';
import { useFriendStore } from '@/store/friendStore';
import { friendService } from '@/services/friend';
import styles from './NotificationBell.module.css';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { pendingRequests, removeRequest } = useNotificationStore();
  const addFriend = useFriendStore((s) => s.addFriend);

  const count = pendingRequests.length;

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleAccept = async (friendIdx: number) => {
    const req = pendingRequests.find((r) => r.friendIdx === friendIdx);
    try {
      await friendService.acceptRequest(friendIdx);
      removeRequest(friendIdx);
      if (req) addFriend(req);
    } catch {
      // 서버 오류 시 무시
    }
  };

  const handleReject = async (friendIdx: number) => {
    try {
      await friendService.rejectRequest(friendIdx);
      removeRequest(friendIdx);
    } catch {
      // 서버 오류 시 무시
    }
  };

  return (
    <div ref={containerRef} className={styles.container}>
      <button
        className={`${styles.bell} ${open ? styles.bellActive : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="알림"
      >
        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className={styles.badge}>{count > 99 ? '99+' : count}</span>
        )}
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <span className={styles.dropdownTitle}>알림</span>
          </div>

          {count === 0 ? (
            <div className={styles.empty}>새 알림이 없습니다.</div>
          ) : (
            <div className={styles.list}>
              {pendingRequests.map((req) => (
                <div key={req.friendIdx} className={styles.item}>
                  <div className={styles.avatar}>{req.nickname[0]}</div>
                  <div className={styles.info}>
                    <span className={styles.name}>{req.nickname}</span>
                    <span className={styles.desc}>친구 요청을 보냈습니다.</span>
                  </div>
                  <div className={styles.actions}>
                    <button
                      className={styles.acceptBtn}
                      onClick={() => handleAccept(req.friendIdx)}
                    >
                      수락
                    </button>
                    <button
                      className={styles.rejectBtn}
                      onClick={() => handleReject(req.friendIdx)}
                    >
                      거절
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
