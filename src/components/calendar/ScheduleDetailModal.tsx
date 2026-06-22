'use client';

import { useEffect } from 'react';
import type { ScheduleEvent } from '@/services/schedule';
import KakaoMap from '@/components/chat/KakaoMap';
import styles from './ScheduleDetailModal.module.css';

interface Props {
  event: ScheduleEvent;
  onClose: () => void;
}

function formatDateTime(iso: string) {
  const [datePart, timePart] = iso.split('T');
  const [y, m, d] = datePart.split('-');
  return timePart
    ? `${y}년 ${parseInt(m)}월 ${parseInt(d)}일 ${timePart.slice(0, 5)}`
    : `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
}

export default function ScheduleDetailModal({ event, onClose }: Props) {
  // ESC 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{event.title}</span>
          <button className={styles.closeBtn} onClick={onClose} title="닫기">
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 지도 + 주소(지도 밑) */}
        {event.lat != null && event.lng != null && (
          <div className={styles.locationBlock}>
            <div className={styles.mapBox}>
              <KakaoMap lat={event.lat} lng={event.lng} />
            </div>
            {event.location && <div className={styles.address}>📍 {event.location}</div>}
          </div>
        )}

        <div className={styles.fields}>
          <div className={styles.field}>
            <span className={styles.label}>날짜</span>
            <span className={styles.value}>{formatDateTime(event.date)}</span>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>참여인원</span>
            <div className={styles.chips}>
              {event.participants.length > 0
                ? event.participants.map((p) => <span key={p} className={styles.chip}>{p}</span>)
                : <span className={styles.empty}>없음</span>}
            </div>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>내용</span>
            <span className={styles.value}>{event.content || <span className={styles.empty}>없음</span>}</span>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>작성자</span>
            <span className={styles.value}>{event.creatorNick}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
