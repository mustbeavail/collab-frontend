'use client';

import { useState } from 'react';
import styles from './SchedulePanel.module.css';

interface ScheduleEvent {
  id: string;
  title: string;
  date: string;         // YYYY-MM-DD
  participants: string[];
  content: string;
  location: string;
}

interface EditData {
  title: string;
  date: string;
  participants: string; // 콤마 구분 입력
  content: string;
  location: string;
}

const DAYS_KO   = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

const INITIAL_EVENTS: ScheduleEvent[] = [
  {
    id: '1', title: '팀 스프린트 회의', date: '2026-06-05',
    participants: ['홍길동', '김영희', '박민준', '정다은'],
    content: '이번 스프린트 목표 및 태스크 분배를 논의합니다.',
    location: '서울시 강남구 테헤란로 123',
  },
  {
    id: '2', title: '프로젝트 마감', date: '2026-06-15',
    participants: ['홍길동', '이철수'],
    content: 'Collab 서비스 1차 배포 마감일입니다.',
    location: '',
  },
  {
    id: '3', title: '코드 리뷰', date: '2026-06-20',
    participants: ['박민준', '정다은', '오승현'],
    content: 'PR #42 백엔드 API 코드 리뷰 세션입니다.',
    location: '',
  },
  {
    id: '4', title: '배포 준비', date: '2026-06-28',
    participants: ['홍길동', '김영희', '이철수', '박민준', '최수연'],
    content: '운영 서버 배포 전 최종 점검 및 배포 계획 확인.',
    location: '서울시 강남구 테헤란로 123',
  },
];

export default function SchedulePanel({ onClose }: { onClose: () => void }) {
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [events, setEvents]       = useState<ScheduleEvent[]>(INITIAL_EVENTS);

  const [hoveredDate, setHoveredDate]       = useState<string | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const [addMode, setAddMode]   = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate]   = useState('');

  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<EditData | null>(null);

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

  const eventsOnDate = (d: string) => events.filter(e => e.date === d);

  const hoveredEventDate = hoveredEventId
    ? (events.find(e => e.id === hoveredEventId)?.date ?? null)
    : null;

  const isCalDateHighlighted = (day: number) => {
    const d = toDateStr(day);
    return d === hoveredDate || d === hoveredEventDate;
  };
  const isEventHighlighted = (e: ScheduleEvent) =>
    e.id === hoveredEventId || e.date === hoveredDate;

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
  const selectEvent = (id: string) => {
    setSelectedEventId(prev => (prev === id ? null : id));
    setEditMode(false);
    setEditData(null);
  };

  const handleCalDayClick = (dateStr: string) => {
    const ev = eventsOnDate(dateStr)[0];
    if (ev) selectEvent(ev.id);
  };

  /* ── 일정 추가 ── */
  const addEvent = () => {
    if (!newTitle.trim() || !newDate) return;
    setEvents(prev => [
      ...prev,
      { id: Date.now().toString(), title: newTitle.trim(), date: newDate, participants: [], content: '', location: '' },
    ]);
    setNewTitle(''); setNewDate(''); setAddMode(false);
  };

  /* ── 일정 삭제 ── */
  const deleteEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    if (selectedEventId === id) { setSelectedEventId(null); setEditMode(false); }
  };

  /* ── 일정 수정 ── */
  const startEdit = (e: ScheduleEvent) => {
    setEditData({ title: e.title, date: e.date, participants: e.participants.join(', '), content: e.content, location: e.location });
    setEditMode(true);
  };
  const cancelEdit = () => { setEditMode(false); setEditData(null); };
  const saveEdit = () => {
    if (!editData || !selectedEventId) return;
    setEvents(prev => prev.map(e =>
      e.id === selectedEventId
        ? { ...e, title: editData.title, date: editData.date, participants: editData.participants.split(',').map(p => p.trim()).filter(Boolean), content: editData.content, location: editData.location }
        : e
    ));
    setEditMode(false); setEditData(null);
  };

  /* ── 포맷 ── */
  const formatDate = (dateStr: string) => {
    const [, m, d] = dateStr.split('-');
    return `${parseInt(m)}월 ${parseInt(d)}일`;
  };

  const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const selectedEvent = selectedEventId ? events.find(e => e.id === selectedEventId) ?? null : null;

  return (
    <div className={styles.panel}>
      {/* ── 헤더 ── */}
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>일정 <span style={{fontSize:'10px',background:'#f59e0b',color:'#fff',borderRadius:'4px',padding:'1px 5px',verticalAlign:'middle'}}>준비 중</span></span>
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
            const isSelected = hasEvent && eventsOnDate(dateStr).some(e => e.id === selectedEventId);
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
          <button className={styles.addBtn} onClick={() => setAddMode(v => !v)} title="일정 추가">
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
            <input className={styles.addInput} type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
            <div className={styles.addFormBtns}>
              <button className={styles.addFormSave} onClick={addEvent}>추가</button>
              <button className={styles.addFormCancel} onClick={() => { setAddMode(false); setNewTitle(''); setNewDate(''); }}>취소</button>
            </div>
          </div>
        )}

        <div className={styles.eventList}>
          {sortedEvents.length === 0 ? (
            <div className={styles.emptyMsg}>일정이 없습니다</div>
          ) : (
            sortedEvents.map(e => (
              <div
                key={e.id}
                className={[
                  styles.eventItem,
                  isEventHighlighted(e)      ? styles.eventItemHighlighted : '',
                  e.id === selectedEventId   ? styles.eventItemSelected    : '',
                ].filter(Boolean).join(' ')}
                onMouseEnter={() => setHoveredEventId(e.id)}
                onMouseLeave={() => setHoveredEventId(null)}
                onClick={() => selectEvent(e.id)}
              >
                <div className={styles.eventDotSmall} />
                <div className={styles.eventContent}>
                  <span className={styles.eventTitle}>{e.title}</span>
                  <span className={styles.eventDate}>{formatDate(e.date)}</span>
                </div>
                <button
                  className={styles.deleteBtn}
                  onClick={ev => { ev.stopPropagation(); deleteEvent(e.id); }}
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
            {/* 세부정보 헤더 */}
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
                    <button className={styles.detailSaveBtn} onClick={saveEdit}>저장</button>
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
            <div className={styles.mapPlaceholder}>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" className={styles.mapIcon}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className={styles.mapLabel}>지도</span>
              {(editMode ? editData?.location : selectedEvent.location) ? (
                <span className={styles.mapAddress}>
                  {editMode ? editData?.location : selectedEvent.location}
                </span>
              ) : (
                <span className={styles.mapEmpty}>위치 미설정</span>
              )}
            </div>

            {/* 세부 필드 */}
            <div className={styles.detailFields}>
              <div className={styles.detailField}>
                <span className={styles.fieldLabel}>날짜</span>
                {editMode && editData ? (
                  <input
                    className={styles.fieldInput}
                    type="date"
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
                  <input
                    className={styles.fieldInput}
                    placeholder="주소 입력"
                    value={editData.location}
                    onChange={e => setEditData(d => d && ({ ...d, location: e.target.value }))}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
