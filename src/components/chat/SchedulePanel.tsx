'use client';

import { useCallback, useEffect, useState } from 'react';
import { scheduleService, ScheduleEvent } from '@/services/schedule';
import KakaoMap, { openAddressSearch } from './KakaoMap';
import styles from './SchedulePanel.module.css';

interface EditData {
  title: string;
  date: string;
  participants: string;
  content: string;
  location: string;
  lat: number | null;
  lng: number | null;
}

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
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate]   = useState('');

  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<EditData | null>(null);
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
    setEditData(null);
  };

  const handleCalDayClick = (dateStr: string) => {
    const ev = eventsOnDate(dateStr)[0];
    if (ev) selectEvent(ev.scheduleIdx);
  };

  /* ── 일정 추가 ── */
  const addEvent = async () => {
    if (!newTitle.trim() || !newDate || !roomIdx) return;
    setSaving(true);
    try {
      const created = await scheduleService.createSchedule(roomIdx, {
        title: newTitle.trim(),
        date: newDate,
      });
      setEvents(prev => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)));
      setNewTitle(''); setNewDate(''); setAddMode(false);
    } catch {
      /* 실패 시 무시 */
    } finally {
      setSaving(false);
    }
  };

  /* ── 일정 삭제 ── */
  const deleteEvent = async (scheduleIdx: number) => {
    try {
      await scheduleService.deleteSchedule(scheduleIdx);
      setEvents(prev => prev.filter(e => e.scheduleIdx !== scheduleIdx));
      if (selectedEventId === scheduleIdx) { setSelectedEventId(null); setEditMode(false); }
    } catch {
      /* 실패 시 무시 */
    }
  };

  /* ── 일정 수정 ── */
  const startEdit = (e: ScheduleEvent) => {
    setEditData({
      title: e.title,
      date: e.date,
      participants: e.participants.join(', '),
      content: e.content ?? '',
      location: e.location ?? '',
      lat: e.lat ?? null,
      lng: e.lng ?? null,
    });
    setEditMode(true);
  };
  const cancelEdit = () => { setEditMode(false); setEditData(null); };

  const saveEdit = async () => {
    if (!editData || selectedEventId == null) return;
    setSaving(true);
    try {
      const updated = await scheduleService.updateSchedule(selectedEventId, {
        title: editData.title,
        date: editData.date,
        participants: editData.participants.split(',').map(p => p.trim()).filter(Boolean),
        content: editData.content,
        location: editData.location,
        lat: editData.lat ?? null,
        lng: editData.lng ?? null,
      });
      setEvents(prev =>
        prev.map(e => e.scheduleIdx === selectedEventId ? updated : e)
            .sort((a, b) => a.date.localeCompare(b.date))
      );
      setEditMode(false); setEditData(null);
    } catch {
      /* 실패 시 무시 */
    } finally {
      setSaving(false);
    }
  };

  /* ── 포맷 ── */
  const formatDate = (dateStr: string) => {
    // "yyyy-MM-ddTHH:mm" 형식
    const [datePart, timePart] = dateStr.split('T');
    const [, m, d] = datePart.split('-');
    return timePart ? `${parseInt(m)}월 ${parseInt(d)}일 ${timePart}` : `${parseInt(m)}월 ${parseInt(d)}일`;
  };

  const toDateOnly = (dateStr: string) => dateStr.split('T')[0];

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
            onClick={() => setAddMode(v => !v)}
            title="일정 추가"
            disabled={!roomIdx}
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {addMode && (
          <div className={styles.addForm}>
            <input
              className={styles.addInput}
              placeholder="일정 제목"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addEvent()}
              autoFocus
            />
            <input className={styles.addInput} type="datetime-local" value={newDate} onChange={e => setNewDate(e.target.value)} />
            <div className={styles.addFormBtns}>
              <button className={styles.addFormSave} onClick={addEvent} disabled={saving}>
                {saving ? '저장 중...' : '추가'}
              </button>
              <button className={styles.addFormCancel} onClick={() => { setAddMode(false); setNewTitle(''); setNewDate(''); }}>
                취소
              </button>
            </div>
          </div>
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
              {editMode && editData ? (
                <input
                  className={styles.detailTitleInput}
                  value={editData.title}
                  onChange={e => setEditData(d => d && ({ ...d, title: e.target.value }))}
                />
              ) : (
                <span className={styles.detailTitleText}>{selectedEvent.title}</span>
              )}
              <div className={styles.detailHeaderBtns}>
                {editMode ? (
                  <>
                    <button className={styles.detailSaveBtn} onClick={saveEdit} disabled={saving}>
                      {saving ? '저장 중...' : '저장'}
                    </button>
                    <button className={styles.detailCancelBtn} onClick={cancelEdit}>취소</button>
                  </>
                ) : (
                  <button className={styles.detailEditBtn} onClick={() => startEdit(selectedEvent)}>수정</button>
                )}
                <button className={styles.detailCloseBtn} onClick={() => { setSelectedEventId(null); setEditMode(false); }}>
                  <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 지도 영역 */}
            {!editMode && selectedEvent.lat && selectedEvent.lng ? (
              <div className={styles.mapContainer}>
                <KakaoMap lat={selectedEvent.lat} lng={selectedEvent.lng} />
                {selectedEvent.location && (
                  <div className={styles.mapAddressOverlay}>{selectedEvent.location}</div>
                )}
              </div>
            ) : !editMode ? (
              <div className={styles.mapPlaceholder}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" className={styles.mapIcon}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className={styles.mapLabel}>지도</span>
                <span className={styles.mapEmpty}>위치 미설정</span>
              </div>
            ) : null}

            {/* 세부 필드 */}
            <div className={styles.detailFields}>
              <div className={styles.detailField}>
                <span className={styles.fieldLabel}>날짜</span>
                {editMode && editData ? (
                  <input
                    className={styles.fieldInput}
                    type="datetime-local"
                    value={editData.date}
                    onChange={e => setEditData(d => d && ({ ...d, date: e.target.value }))}
                  />
                ) : (
                  <span className={styles.fieldValue}>{formatDate(selectedEvent.date)}</span>
                )}
              </div>

              <div className={styles.detailField}>
                <span className={styles.fieldLabel}>참여인원</span>
                {editMode && editData ? (
                  <input
                    className={styles.fieldInput}
                    placeholder="쉼표로 구분"
                    value={editData.participants}
                    onChange={e => setEditData(d => d && ({ ...d, participants: e.target.value }))}
                  />
                ) : (
                  <div className={styles.participantChips}>
                    {selectedEvent.participants.length > 0
                      ? selectedEvent.participants.map(p => (
                          <span key={p} className={styles.chip}>{p}</span>
                        ))
                      : <span className={styles.fieldEmpty}>없음</span>
                    }
                  </div>
                )}
              </div>

              <div className={styles.detailField}>
                <span className={styles.fieldLabel}>내용</span>
                {editMode && editData ? (
                  <textarea
                    className={styles.fieldTextarea}
                    value={editData.content}
                    onChange={e => setEditData(d => d && ({ ...d, content: e.target.value }))}
                    rows={3}
                  />
                ) : (
                  <span className={styles.fieldValue}>
                    {selectedEvent.content || <span className={styles.fieldEmpty}>없음</span>}
                  </span>
                )}
              </div>

              {editMode && editData && (
                <div className={styles.detailField}>
                  <span className={styles.fieldLabel}>위치</span>
                  <div className={styles.locationSearchRow}>
                    <button
                      className={styles.locationSearchBtn}
                      type="button"
                      onClick={() => openAddressSearch((address, lat, lng) => {
                        setEditData(d => d && ({ ...d, location: address, lat, lng }));
                      })}
                    >
                      주소 검색
                    </button>
                    {editData.location ? (
                      <>
                        <span className={styles.locationText}>{editData.location}</span>
                        <button
                          className={styles.locationClearBtn}
                          type="button"
                          onClick={() => setEditData(d => d && ({ ...d, location: '', lat: null, lng: null }))}
                          title="위치 삭제"
                        >
                          <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <span className={styles.locationEmpty}>미설정</span>
                    )}
                  </div>
                  {editData.lat && editData.lng && (
                    <div className={styles.mapContainerSmall}>
                      <KakaoMap lat={editData.lat} lng={editData.lng} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 작성자 */}
            <div className={styles.detailField} style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
              <span className={styles.fieldLabel}>작성자</span>
              <span className={styles.fieldValue}>{selectedEvent.creatorNick}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
