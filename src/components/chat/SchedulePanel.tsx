'use client';

import { useCallback, useEffect, useState } from 'react';
import { scheduleService, ScheduleEvent } from '@/services/schedule';
import KakaoMap from './KakaoMap';
import ScheduleForm, { ScheduleFormValue } from './ScheduleForm';
import styles from './SchedulePanel.module.css';

const DAYS_KO   = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

export default function SchedulePanel({
  onClose,
  roomIdx,
}: {
  onClose: () => void;
  roomIdx?: number | null;
}) {
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [events, setEvents]       = useState<ScheduleEvent[]>([]);
  const [loading, setLoading]     = useState(false);

  const [hoveredDate, setHoveredDate]         = useState<string | null>(null);
  const [hoveredEventId, setHoveredEventId]   = useState<number | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  const [addMode, setAddMode]   = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving]     = useState(false);

  /* ── API 로드 ── */
  const loadSchedules = useCallback(async () => {
    if (!roomIdx) return;
    setLoading(true);
    try {
      const data = await scheduleService.getSchedules(roomIdx);
      setEvents(data);
    } catch {
      /* 에러는 조용히 무시 */
    } finally {
      setLoading(false);
    }
  }, [roomIdx]);

  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  /* ── 캘린더 계산 ── */
  const toDateStr = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const firstDay  = new Date(viewYear, viewMonth, 1).getDay();
  const daysCount = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysCount }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsOnDate = (d: string) => events.filter(e => e.date.split('T')[0] === d);

  const hoveredEventDate = hoveredEventId
    ? (events.find(e => e.scheduleIdx === hoveredEventId)?.date.split('T')[0] ?? null)
    : null;

  const isCalDateHighlighted = (day: number) => {
    const d = toDateStr(day);
    return d === hoveredDate || d === hoveredEventDate;
  };
  const isEventHighlighted = (e: ScheduleEvent) =>
    e.scheduleIdx === hoveredEventId || e.date.split('T')[0] === hoveredDate;

  /* ── 월 탐색 ── */
  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  /* ── 일정 선택 ── */
  const selectEvent = (id: number) => {
    setSelectedEventId(prev => (prev === id ? null : id));
    setEditMode(false);
  };

  const handleCalDayClick = (dateStr: string) => {
    const ev = eventsOnDate(dateStr)[0];
    if (ev) selectEvent(ev.scheduleIdx);
  };

  /* ── 일정 추가 ── */
  const handleCreate = async (v: ScheduleFormValue) => {
    if (!roomIdx) return;
    setSaving(true);
    try {
      const created = await scheduleService.createSchedule(roomIdx, v);
      setEvents(prev => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)));
      setAddMode(false);
    } catch {
      alert('일정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  /* ── 일정 삭제 (컨펌, 항목6) ── */
  const deleteEvent = async (scheduleIdx: number) => {
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    try {
      await scheduleService.deleteSchedule(scheduleIdx);
      setEvents(prev => prev.filter(e => e.scheduleIdx !== scheduleIdx));
      if (selectedEventId === scheduleIdx) { setSelectedEventId(null); setEditMode(false); }
    } catch {
      alert('일정 삭제에 실패했습니다.');
    }
  };

  /* ── 일정 수정 (컨펌, 항목6) ── */
  const handleUpdate = async (v: ScheduleFormValue) => {
    if (selectedEventId == null) return;
    if (!confirm('이 일정을 수정하시겠습니까?')) return;
    setSaving(true);
    try {
      const updated = await scheduleService.updateSchedule(selectedEventId, v);
      setEvents(prev =>
        prev.map(e => e.scheduleIdx === selectedEventId ? updated : e)
            .sort((a, b) => a.date.localeCompare(b.date))
      );
      setEditMode(false);
    } catch {
      alert('일정 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  /* ── 포맷 ── */
  const formatDate = (dateStr: string) => {
    const [datePart, timePart] = dateStr.split('T');
    const [, m, d] = datePart.split('-');
    return timePart ? `${parseInt(m)}월 ${parseInt(d)}일 ${timePart}` : `${parseInt(m)}월 ${parseInt(d)}일`;
  };

  const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const selectedEvent = selectedEventId != null
    ? events.find(e => e.scheduleIdx === selectedEventId) ?? null
    : null;

  return (
    <div className={styles.panel}>
      {/* ── 헤더 ── */}
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>일정</span>
        <button className={styles.panelCloseBtn} onClick={onClose}>
          <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── 캘린더 ── */}
      <div className={styles.calendar}>
        <div className={styles.calNav}>
          <button className={styles.navBtn} onClick={prevMonth}>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className={styles.calTitle}>{viewYear}년 {MONTHS_KO[viewMonth]}</span>
          <button className={styles.navBtn} onClick={nextMonth}>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className={styles.calGrid}>
          {DAYS_KO.map((d, i) => (
            <div key={d} className={`${styles.calDayLabel} ${i === 0 ? styles.sun : i === 6 ? styles.sat : ''}`}>{d}</div>
          ))}
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />;
            const dateStr  = toDateStr(day);
            const hasEvent = eventsOnDate(dateStr).length > 0;
            const isToday  = dateStr === todayStr;
            const isSelected = hasEvent && eventsOnDate(dateStr).some(e => e.scheduleIdx === selectedEventId);
            const col = i % 7;
            return (
              <div
                key={`d-${day}`}
                className={[
                  styles.calDay,
                  isToday         ? styles.calDayToday       : '',
                  hasEvent        ? styles.calDayHasEvent     : '',
                  isCalDateHighlighted(day) ? styles.calDayHighlighted : '',
                  isSelected      ? styles.calDaySelected     : '',
                  col === 0       ? styles.sun                : col === 6 ? styles.sat : '',
                ].filter(Boolean).join(' ')}
                onMouseEnter={() => hasEvent && setHoveredDate(dateStr)}
                onMouseLeave={() => setHoveredDate(null)}
                onClick={() => hasEvent && handleCalDayClick(dateStr)}
              >
                {day}
                {hasEvent && <span className={styles.eventDot} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 일정 목록 ── */}
      <div className={styles.listSection}>
        <div className={styles.listHeader}>
          <span className={styles.listTitle}>일정 목록</span>
          <button
            className={styles.addBtn}
            onClick={() => { setAddMode(v => !v); setSelectedEventId(null); }}
            title="일정 추가"
            disabled={!roomIdx}
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {addMode && roomIdx && (
          <ScheduleForm
            roomIdx={roomIdx}
            saving={saving}
            submitLabel="추가"
            onSubmit={handleCreate}
            onCancel={() => setAddMode(false)}
          />
        )}

        <div className={styles.eventList}>
          {loading ? (
            <div className={styles.emptyMsg}>불러오는 중...</div>
          ) : sortedEvents.length === 0 ? (
            <div className={styles.emptyMsg}>일정이 없습니다</div>
          ) : (
            sortedEvents.map(e => (
              <div
                key={e.scheduleIdx}
                className={[
                  styles.eventItem,
                  isEventHighlighted(e)            ? styles.eventItemHighlighted : '',
                  e.scheduleIdx === selectedEventId ? styles.eventItemSelected    : '',
                ].filter(Boolean).join(' ')}
                onMouseEnter={() => setHoveredEventId(e.scheduleIdx)}
                onMouseLeave={() => setHoveredEventId(null)}
                onClick={() => selectEvent(e.scheduleIdx)}
              >
                <div className={styles.eventDotSmall} />
                <div className={styles.eventContent}>
                  <span className={styles.eventTitle}>{e.title}</span>
                  <span className={styles.eventDate}>{formatDate(e.date)}</span>
                </div>
                <button
                  className={styles.deleteBtn}
                  onClick={ev => { ev.stopPropagation(); deleteEvent(e.scheduleIdx); }}
                  title="삭제"
                >
                  <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* ── 일정 세부정보 ── */}
        {selectedEvent && (
          <div className={styles.detailSection}>
            <div className={styles.detailHeader}>
              <span className={styles.detailTitleText}>{selectedEvent.title}</span>
              <div className={styles.detailHeaderBtns}>
                {!editMode && (
                  <button className={styles.detailEditBtn} onClick={() => setEditMode(true)}>수정</button>
                )}
                <button className={styles.detailCloseBtn} onClick={() => { setSelectedEventId(null); setEditMode(false); }}>
                  <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {editMode ? (
              <ScheduleForm
                roomIdx={roomIdx ?? 0}
                saving={saving}
                submitLabel="저장"
                initial={{
                  title: selectedEvent.title,
                  date: selectedEvent.date,
                  participants: selectedEvent.participants,
                  content: selectedEvent.content ?? '',
                  location: selectedEvent.location ?? '',
                  lat: selectedEvent.lat ?? null,
                  lng: selectedEvent.lng ?? null,
                }}
                onSubmit={handleUpdate}
                onCancel={() => setEditMode(false)}
              />
            ) : (
              <>
                {/* 지도 영역 (주소는 지도 밑에 표기, 항목5) */}
                {selectedEvent.lat && selectedEvent.lng ? (
                  <>
                    <div className={styles.mapContainer}>
                      <KakaoMap lat={selectedEvent.lat} lng={selectedEvent.lng} />
                    </div>
                    {selectedEvent.location && (
                      <div className={styles.mapAddressBelow}>📍 {selectedEvent.location}</div>
                    )}
                  </>
                ) : (
                  <div className={styles.mapPlaceholder}>
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" className={styles.mapIcon}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className={styles.mapLabel}>지도</span>
                    <span className={styles.mapEmpty}>위치 미설정</span>
                  </div>
                )}

                {/* 세부 필드 */}
                <div className={styles.detailFields}>
                  <div className={styles.detailField}>
                    <span className={styles.fieldLabel}>날짜</span>
                    <span className={styles.fieldValue}>{formatDate(selectedEvent.date)}</span>
                  </div>

                  <div className={styles.detailField}>
                    <span className={styles.fieldLabel}>참여인원</span>
                    <div className={styles.participantChips}>
                      {selectedEvent.participants.length > 0
                        ? selectedEvent.participants.map(p => (
                            <span key={p} className={styles.chip}>{p}</span>
                          ))
                        : <span className={styles.fieldEmpty}>없음</span>
                      }
                    </div>
                  </div>

                  <div className={styles.detailField}>
                    <span className={styles.fieldLabel}>내용</span>
                    <span className={styles.fieldValue}>
                      {selectedEvent.content || <span className={styles.fieldEmpty}>없음</span>}
                    </span>
                  </div>
                </div>

                {/* 작성자 */}
                <div className={styles.detailField} style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                  <span className={styles.fieldLabel}>작성자</span>
                  <span className={styles.fieldValue}>{selectedEvent.creatorNick}</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
