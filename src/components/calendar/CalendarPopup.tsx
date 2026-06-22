'use client';

import { useEffect, useRef, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { scheduleService, type ScheduleEvent } from '@/services/schedule';
import ScheduleDetailModal from './ScheduleDetailModal';
import styles from './CalendarPopup.module.css';

interface Props {
  onClose: () => void;
}

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

export default function CalendarPopup({ onClose }: Props) {
  const [value, setValue] = useState<Value>(new Date());
  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailEvent, setDetailEvent] = useState<ScheduleEvent | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scheduleService.getMySchedules()
      .then(setSchedules)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (detailEvent) return; // 상세 모달이 열려 있으면 팝업 유지
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, detailEvent]);

  const selectedDate = value instanceof Date ? value : (Array.isArray(value) ? value[0] : null);

  const schedulesOnDate = selectedDate
    ? schedules.filter(s => s.date && isSameDay(new Date(s.date), selectedDate))
    : [];

  const datesWithSchedule = new Set(
    schedules
      .filter(s => s.date)
      .map(s => {
        const d = new Date(s.date!);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      })
  );

  const tileContent = ({ date }: { date: Date }) => {
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    if (datesWithSchedule.has(key)) {
      return <div className={styles.dot} />;
    }
    return null;
  };

  return (
    <div ref={containerRef} className={styles.popup}>
      <div className={styles.calendarWrap}>
        <Calendar
          onChange={setValue}
          value={value}
          locale="ko-KR"
          tileContent={tileContent}
          className={styles.calendar}
        />
      </div>

      <div className={styles.scheduleList}>
        {loading ? (
          <div className={styles.emptyMsg}>로딩 중...</div>
        ) : schedulesOnDate.length === 0 ? (
          <div className={styles.emptyMsg}>
            {selectedDate
              ? `${selectedDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}에 일정이 없습니다.`
              : '날짜를 선택하세요.'}
          </div>
        ) : (
          schedulesOnDate.map(s => (
            <button
              key={s.scheduleIdx}
              className={styles.scheduleItem}
              onClick={() => setDetailEvent(s)}
              title="상세 보기"
            >
              <div className={styles.scheduleTitle}>{s.title}</div>
              {s.date && <div className={styles.scheduleDate}>{formatDate(s.date)}</div>}
              {s.location && <div className={styles.scheduleLocation}>📍 {s.location}</div>}
            </button>
          ))
        )}
      </div>

      {detailEvent && (
        <ScheduleDetailModal event={detailEvent} onClose={() => setDetailEvent(null)} />
      )}
    </div>
  );
}
