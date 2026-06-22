'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useTeamStore } from '@/store/teamStore';
import { chatService } from '@/services/chat';
import { KakaoLocationPicker, openAddressSearch } from './KakaoMap';
import styles from './ScheduleForm.module.css';

export interface ScheduleFormValue {
  title: string;
  date: string; // "yyyy-MM-ddTHH:mm"
  participants: string[];
  content: string;
  location: string;
  lat: number | null;
  lng: number | null;
}

interface MemberOption { userId: string; nickname: string; }

interface ScheduleFormProps {
  roomIdx: number;
  initial?: Partial<ScheduleFormValue>;
  saving: boolean;
  submitLabel: string;
  onSubmit: (v: ScheduleFormValue) => void;
  onCancel: () => void;
}

/* "yyyy-MM-ddTHH:mm" ↔ Date (로컬 기준) */
const toDate = (s?: string | null): Date | null => (s ? new Date(s) : null);
const pad = (n: number) => String(n).padStart(2, '0');
const toStr = (d: Date | null): string =>
  d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` : '';

export default function ScheduleForm({ roomIdx, initial, saving, submitLabel, onSubmit, onCancel }: ScheduleFormProps) {
  const teams = useTeamStore((s) => s.teams);

  const [title, setTitle]               = useState(initial?.title ?? '');
  const [date, setDate]                 = useState<Date | null>(toDate(initial?.date));
  const [participants, setParticipants] = useState<string[]>(initial?.participants ?? []);
  const [content, setContent]           = useState(initial?.content ?? '');
  const [location, setLocation]         = useState(initial?.location ?? '');
  const [lat, setLat]                   = useState<number | null>(initial?.lat ?? null);
  const [lng, setLng]                   = useState<number | null>(initial?.lng ?? null);

  const [members, setMembers]   = useState<MemberOption[]>([]);
  const [memberQuery, setMemberQuery] = useState('');

  const dpRef = useRef<DatePicker>(null);

  /* 참여인원 후보: 팀 채팅방이면 팀 멤버, 아니면 채팅방 멤버로 폴백 */
  useEffect(() => {
    const team = teams.find((t) => t.channels.some((c) => c.roomIdx === roomIdx));
    if (team) {
      setMembers(team.members.map((m) => ({ userId: m.userId, nickname: m.nickname })));
      return;
    }
    let cancelled = false;
    chatService.getMembers(roomIdx)
      .then((ms) => { if (!cancelled) setMembers(ms.map((m) => ({ userId: m.userId, nickname: m.nickname }))); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [roomIdx, teams]);

  /* 과거 차단: minDate=오늘, 당일이면 minTime=현재시각 */
  const now = useMemo(() => new Date(), []);
  const isToday = date != null && date.toDateString() === now.toDateString();
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(); dayEnd.setHours(23, 59, 0, 0);

  const addParticipant = (nick: string) => {
    setParticipants((prev) => (prev.includes(nick) ? prev : [...prev, nick]));
    setMemberQuery('');
  };
  const removeParticipant = (nick: string) =>
    setParticipants((prev) => prev.filter((p) => p !== nick));

  const filteredMembers = members.filter(
    (m) => !participants.includes(m.nickname) &&
      (memberQuery.trim() === '' || m.nickname.toLowerCase().includes(memberQuery.toLowerCase())),
  );

  const handleSubmit = () => {
    if (!title.trim()) { alert('일정 제목을 입력하세요.'); return; }
    if (!date)         { alert('일정 날짜와 시간을 선택하세요.'); return; }
    if (date.getTime() < Date.now()) { alert('이전 날짜·시간은 선택할 수 없습니다.'); return; }
    onSubmit({
      title: title.trim(),
      date: toStr(date),
      participants,
      content: content.trim(),
      location: location.trim(),
      lat,
      lng,
    });
  };

  return (
    <div className={styles.form}>
      {/* 제목 */}
      <div className={styles.field}>
        <span className={styles.label}>제목 *</span>
        <input
          className={styles.input}
          placeholder="일정 제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
      </div>

      {/* 날짜/시간 */}
      <div className={styles.field}>
        <span className={styles.label}>날짜/시간 *</span>
        <DatePicker
          ref={dpRef}
          selected={date}
          onChange={(d: Date | null) => setDate(d)}
          showTimeSelect
          timeFormat="HH:mm"
          timeIntervals={30}
          timeCaption="시간"
          dateFormat="yyyy-MM-dd HH:mm"
          minDate={now}
          minTime={isToday ? now : dayStart}
          maxTime={dayEnd}
          shouldCloseOnSelect={false}
          placeholderText="날짜와 시간 선택"
          className={styles.input}
          popperClassName={styles.dpPopper}
        >
          <div className={styles.dpDone}>
            <button type="button" className={styles.dpDoneBtn} onClick={() => dpRef.current?.setOpen(false)}>
              완료
            </button>
          </div>
        </DatePicker>
      </div>

      {/* 참여인원 */}
      <div className={styles.field}>
        <span className={styles.label}>참여인원</span>
        {participants.length > 0 && (
          <div className={styles.chips}>
            {participants.map((p) => (
              <span key={p} className={styles.chip}>
                {p}
                <button type="button" className={styles.chipRemove} onClick={() => removeParticipant(p)} title="제거">×</button>
              </span>
            ))}
          </div>
        )}
        <input
          className={styles.input}
          placeholder="이름 검색 후 클릭해서 추가"
          value={memberQuery}
          onChange={(e) => setMemberQuery(e.target.value)}
        />
        {filteredMembers.length > 0 ? (
          <div className={styles.memberList}>
            {filteredMembers.map((m) => (
              <button key={m.userId} type="button" className={styles.memberItem} onClick={() => addParticipant(m.nickname)}>
                {m.nickname}
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.memberEmpty}>
            {members.length === 0 ? '멤버 목록을 불러올 수 없습니다.' : '추가할 멤버가 없습니다.'}
          </div>
        )}
      </div>

      {/* 내용 */}
      <div className={styles.field}>
        <span className={styles.label}>내용</span>
        <textarea
          className={styles.textarea}
          placeholder="일정 내용"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
        />
      </div>

      {/* 위치 */}
      <div className={styles.field}>
        <span className={styles.label}>위치</span>
        <div className={styles.locationRow}>
          <button
            type="button"
            className={styles.locationSearchBtn}
            onClick={() => openAddressSearch((address, la, ln) => { setLocation(address); setLat(la); setLng(ln); })}
          >
            주소 검색
          </button>
          {location ? (
            <>
              <span className={styles.locationText}>{location}</span>
              <button
                type="button"
                className={styles.locationClear}
                onClick={() => { setLocation(''); setLat(null); setLng(null); }}
                title="위치 삭제"
              >×</button>
            </>
          ) : (
            <span className={styles.locationEmpty}>주소 검색 또는 지도 클릭</span>
          )}
        </div>
        <div className={styles.mapBox}>
          <KakaoLocationPicker
            lat={lat}
            lng={lng}
            onPick={(address, la, ln) => { setLocation(address); setLat(la); setLng(ln); }}
          />
        </div>
      </div>

      {/* 버튼 */}
      <div className={styles.actions}>
        <button type="button" className={styles.saveBtn} onClick={handleSubmit} disabled={saving}>
          {saving ? '저장 중...' : submitLabel}
        </button>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>취소</button>
      </div>
    </div>
  );
}
