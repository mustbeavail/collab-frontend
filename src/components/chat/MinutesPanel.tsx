'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { minutesService, MeetingNote } from '@/services/minutes';

const pad = (n: number) => String(n).padStart(2, '0');
// Date → "yyyy-MM-ddTHH:mm" (백엔드 LocalDateTime 호환, 로컬 기준)
function toLocalDatetimeValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// "yyyy-MM-ddTHH:mm" → Date
const parseDt = (s?: string | null): Date | null => (s ? new Date(s) : null);
import styles from './MinutesPanel.module.css';

type View = 'list' | 'detail' | 'create' | 'edit' | 'ai-form' | 'voice-ai-form';

const renderContent = (content: string, s: Record<string, string>) =>
  content.split('\n').map((line, i) => {
    if (line.startsWith('## ')) return <p key={i} className={s.h2}>{line.slice(3)}</p>;
    if (line.startsWith('- '))  return <p key={i} className={s.li}>• {line.slice(2)}</p>;
    if (line === '')             return <div key={i} className={s.spacer} />;
    return <p key={i} className={s.p}>{line}</p>;
  });

const formatBytes = (bytes: number) =>
  bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

export default function MinutesPanel({
  onClose,
  roomIdx,
  currentUserId,
  canManageDelete,
  lastRecordingSegments,
  lastRecordingMimeType,
}: {
  onClose: () => void;
  roomIdx?: number | null;
  currentUserId?: string;
  canManageDelete?: boolean; // 항목6: 방장/팀 리더·매니저 — 작성자 아닌 회의록도 삭제 가능
  lastRecordingSegments?: Blob[];
  lastRecordingMimeType?: string;
}) {
  const [view, setView]           = useState<View>('list');
  const [notes, setNotes]         = useState<MeetingNote[]>([]);
  const [selected, setSelected]   = useState<MeetingNote | null>(null);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [aiStartTime, setAiStartTime]   = useState<Date | null>(null);
  const [aiEndTime, setAiEndTime]       = useState<Date | null>(null);
  const [generating, setGenerating]     = useState(false);
  const [voiceBlobs, setVoiceBlobs]     = useState<Blob[] | null>(null);
  const [voiceFileNames, setVoiceFileNames] = useState<string[]>([]); // 항목22: 선택한 파일명 표시
  const [voiceMime, setVoiceMime]       = useState<string>('audio/webm');
  const [voiceGenerating, setVoiceGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const startDpRef = useRef<DatePicker>(null);
  const endDpRef   = useRef<DatePicker>(null);

  const loadNotes = useCallback(async () => {
    if (!roomIdx) return;
    setLoading(true);
    try {
      setNotes(await minutesService.getNotes(roomIdx));
    } finally {
      setLoading(false);
    }
  }, [roomIdx]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const openAiForm = () => {
    // 디폴트: 방의 가장 오래된~최신 메시지 시각(항목2). 조회 전/실패 시 최근 1시간으로 폴백.
    const now = new Date();
    setAiStartTime(new Date(now.getTime() - 60 * 60 * 1000));
    setAiEndTime(now);
    setView('ai-form');
    if (!roomIdx) return;
    minutesService.getTimeRange(roomIdx)
      .then(range => {
        if (range.start) setAiStartTime(parseDt(range.start));
        if (range.end)   setAiEndTime(parseDt(range.end));
      })
      .catch(() => { /* 폴백 유지 */ });
  };

  const openVoiceAiForm = () => {
    if (lastRecordingSegments?.length) {
      setVoiceBlobs(lastRecordingSegments);
      setVoiceMime(lastRecordingMimeType ?? 'audio/webm');
      setVoiceFileNames([`방금 녹음된 파일 (${lastRecordingSegments.length}개 세그먼트)`]);
    } else {
      setVoiceBlobs(null);
      setVoiceMime('audio/webm');
      setVoiceFileNames([]);
    }
    setView('voice-ai-form');
  };

  const handleVoiceFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setVoiceBlobs(files);
    setVoiceFileNames(files.map(f => f.name)); // 항목22: 선택한 파일명 표시
    setVoiceMime(files[0].type || 'audio/webm');
  };

  const handleVoiceAiGenerate = async () => {
    if (!roomIdx || !voiceBlobs?.length) return;
    setVoiceGenerating(true);
    try {
      const created = await minutesService.generateVoiceMinutes(roomIdx, voiceBlobs, voiceMime);
      setNotes(prev => [created, ...prev]);
      setSelected(created);
      setView('detail');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? '음성 AI 회의록 생성에 실패했습니다.';
      alert(msg);
    } finally {
      setVoiceGenerating(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!roomIdx || !aiStartTime || !aiEndTime) return;
    if (aiEndTime.getTime() < aiStartTime.getTime()) { alert('종료 시간은 시작 시간보다 빠를 수 없습니다.'); return; }
    setGenerating(true);
    try {
      const created = await minutesService.generateAiMinutes(roomIdx, {
        startTime: toLocalDatetimeValue(aiStartTime),
        endTime: toLocalDatetimeValue(aiEndTime),
      });
      setNotes(prev => [created, ...prev]);
      setSelected(created);
      setView('detail');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'AI 회의록 생성에 실패했습니다.';
      alert(msg);
    } finally {
      setGenerating(false);
    }
  };

  const openCreate = () => {
    setFormTitle('');
    setFormContent('');
    setView('create');
  };

  const openEdit = (note: MeetingNote) => {
    setFormTitle(note.title);
    setFormContent(note.content ?? '');
    setView('edit');
  };

  const handleCreate = async () => {
    if (!roomIdx || !formTitle.trim()) return;
    setSaving(true);
    try {
      const created = await minutesService.createNote(roomIdx, {
        title: formTitle.trim(),
        content: formContent.trim() || undefined,
      });
      setNotes(prev => [created, ...prev]);
      setSelected(created);
      setView('detail');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selected || !formTitle.trim()) return;
    setSaving(true);
    try {
      const updated = await minutesService.updateNote(selected.noteIdx, {
        title: formTitle.trim(),
        content: formContent.trim() || undefined,
      });
      setNotes(prev => prev.map(n => n.noteIdx === updated.noteIdx ? updated : n));
      setSelected(updated);
      setView('detail');
    } finally {
      setSaving(false);
    }
  };

  // 항목10: 회의록 내보내기(Markdown .md 다운로드)
  const handleExport = (note: MeetingNote) => {
    const md = `# ${note.title}\n\n_${note.createdAt} · ${note.authorNick}_\n\n${note.content ?? '(내용 없음)'}\n`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = note.title.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80);
    a.download = `${safeTitle || '회의록'}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // 항목6: 해당 회의록을 삭제할 수 있는가 — 작성자 본인 OR 방장/팀 리더·매니저
  const canDeleteNote = (note: MeetingNote) =>
    note.authorId === currentUserId || !!canManageDelete;

  const handleDelete = async (note: MeetingNote) => {
    if (!confirm(`"${note.title}" 회의록을 삭제하시겠습니까?`)) return;
    try {
      await minutesService.deleteNote(note.noteIdx);
      setNotes(prev => prev.filter(n => n.noteIdx !== note.noteIdx));
      if (selected?.noteIdx === note.noteIdx) {
        setSelected(null);
        setView('list');
      }
    } catch { /* ignore */ }
  };

  /* ── 음성 AI 생성 폼 뷰 ── */
  if (view === 'voice-ai-form') {
    const hasLastRecording = !!lastRecordingSegments?.length;
    const usingLastRecording = hasLastRecording && voiceBlobs === lastRecordingSegments;
    const totalSize = voiceBlobs ? voiceBlobs.reduce((s, b) => s + b.size, 0) : 0;

    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => setView('list')}>
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            취소
          </button>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={styles.formBody}>
          <div className={styles.voiceFormHeader}>
            <svg width="16" height="16" fill="none" stroke="#10b981" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
            </svg>
            <span>음성/영상 파일로 회의록 자동 작성</span>
          </div>

          {hasLastRecording && (
            <div className={`${styles.lastRecordingBox} ${usingLastRecording ? styles.lastRecordingBoxActive : ''}`}>
              <div className={styles.lastRecordingInfo}>
                <span className={styles.lastRecordingLabel}>방금 녹음된 파일</span>
                <span className={styles.lastRecordingMeta}>
                  {lastRecordingSegments!.length}개 세그먼트 · {formatBytes(lastRecordingSegments!.reduce((s, b) => s + b.size, 0))}
                </span>
              </div>
              {!usingLastRecording ? (
                <button
                  className={styles.useLastBtn}
                  onClick={() => { setVoiceBlobs(lastRecordingSegments!); setVoiceMime(lastRecordingMimeType ?? 'audio/webm'); }}
                >
                  사용
                </button>
              ) : (
                <span className={styles.selectedBadge}>선택됨</span>
              )}
            </div>
          )}

          <div className={styles.formRow}>
            <label className={styles.formLabel}>오디오/영상 파일 선택</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*,.webm,.mp3,.mp4,.ogg,.wav"
              multiple
              className={styles.fileInput}
              onChange={handleVoiceFileSelect}
            />
            <button
              className={styles.fileSelectBtn}
              onClick={() => fileInputRef.current?.click()}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              파일 선택
            </button>
            {voiceBlobs && !usingLastRecording && voiceFileNames.length > 0 && (
              <div className={styles.fileSelectedInfo}>
                {voiceFileNames.map((name, i) => (
                  <span key={i} className={styles.fileSelectedName} title={name}>📄 {name}</span>
                ))}
                <span className={styles.fileSelectedMeta}>{voiceBlobs.length}개 파일 · {formatBytes(totalSize)}</span>
              </div>
            )}
          </div>

          <button
            className={styles.voiceSubmitBtn}
            onClick={handleVoiceAiGenerate}
            disabled={voiceGenerating || !voiceBlobs?.length}
          >
            {voiceGenerating ? (
              <>
                <span className={styles.spinnerGreen} />
                AI 분석 중...
              </>
            ) : (
              <>
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                회의록 생성
              </>
            )}
          </button>
          <p className={styles.aiHint}>
            음성/영상 파일을 Gemini AI가 분석해 회의록을 자동 작성합니다. 파일 당 최대 15MB.
            {lastRecordingSegments && lastRecordingSegments.length > 1
              ? ` (${lastRecordingSegments.length}개 세그먼트가 자동 통합됩니다)`
              : ''}
          </p>
        </div>
      </div>
    );
  }

  /* ── AI 생성 폼 뷰 ── */
  if (view === 'ai-form') {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => setView('list')}>
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            취소
          </button>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={styles.formBody}>
          <div className={styles.aiFormHeader}>
            <svg width="16" height="16" fill="none" stroke="#a78bfa" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span>분석할 채팅 시간 범위를 선택하세요</span>
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>시작 시간</label>
            <DatePicker
              ref={startDpRef}
              selected={aiStartTime}
              onChange={(d: Date | null) => setAiStartTime(d)}
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={30}
              timeCaption="시간"
              dateFormat="yyyy-MM-dd HH:mm"
              maxDate={aiEndTime ?? undefined}
              shouldCloseOnSelect={false}
              placeholderText="시작 날짜와 시간 선택"
              className={styles.formInput}
            >
              <div className={styles.dpDone}>
                <button type="button" className={styles.dpDoneBtn} onClick={() => startDpRef.current?.setOpen(false)}>완료</button>
              </div>
            </DatePicker>
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>종료 시간</label>
            <DatePicker
              ref={endDpRef}
              selected={aiEndTime}
              onChange={(d: Date | null) => setAiEndTime(d)}
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={30}
              timeCaption="시간"
              dateFormat="yyyy-MM-dd HH:mm"
              minDate={aiStartTime ?? undefined}
              shouldCloseOnSelect={false}
              placeholderText="종료 날짜와 시간 선택"
              className={styles.formInput}
            >
              <div className={styles.dpDone}>
                <button type="button" className={styles.dpDoneBtn} onClick={() => endDpRef.current?.setOpen(false)}>완료</button>
              </div>
            </DatePicker>
          </div>
          <button
            className={styles.aiSubmitBtn}
            onClick={handleAiGenerate}
            disabled={generating || !aiStartTime || !aiEndTime}
          >
            {generating ? (
              <>
                <span className={styles.spinner} />
                AI 분석 중...
              </>
            ) : (
              <>
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                회의록 생성
              </>
            )}
          </button>
          <p className={styles.aiHint}>선택한 시간 범위의 채팅 내용을 Gemini AI가 분석하여 회의록을 자동 작성합니다.</p>
        </div>
      </div>
    );
  }

  /* ── 폼 뷰 (create / edit) ── */
  if (view === 'create' || view === 'edit') {
    const isEdit = view === 'edit';
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => setView(isEdit ? 'detail' : 'list')}>
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            취소
          </button>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={styles.formBody}>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>제목 *</label>
            <input
              className={styles.formInput}
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder="회의록 제목"
              maxLength={100}
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>내용</label>
            <textarea
              className={styles.formTextarea}
              value={formContent}
              onChange={e => setFormContent(e.target.value)}
              placeholder={"## 참석자\n\n## 안건\n\n## 결정사항"}
              rows={14}
            />
          </div>
          <button
            className={styles.submitBtn}
            onClick={isEdit ? handleUpdate : handleCreate}
            disabled={saving || !formTitle.trim()}
          >
            {saving ? '저장 중...' : isEdit ? '수정 완료' : '회의록 등록'}
          </button>
        </div>
      </div>
    );
  }

  /* ── 상세 뷰 ── */
  if (view === 'detail' && selected) {
    const isAuthor = selected.authorId === currentUserId;
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => setView('list')}>
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            목록
          </button>
          <div className={styles.headerActions}>
            <button className={styles.editBtn} onClick={() => handleExport(selected)} title="내보내기 (Markdown)">
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            {isAuthor && (
              <button className={styles.editBtn} onClick={() => openEdit(selected)} title="수정">
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            <button className={styles.closeBtn} onClick={onClose}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className={styles.detailBody}>
          <div className={styles.detailMeta}>
            <span className={styles.detailTitle}>{selected.title}</span>
            <span className={styles.detailSub}>{selected.createdAt} · {selected.authorNick}</span>
          </div>
          <div className={styles.contentArea}>
            {selected.content
              ? renderContent(selected.content, { h2: styles.h2, li: styles.li, p: styles.p, spacer: styles.spacer })
              : <p className={styles.emptyMsg}>내용 없음</p>
            }
          </div>
        </div>
      </div>
    );
  }

  /* ── 목록 뷰 ── */
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>회의록</span>
        <button className={styles.closeBtn} onClick={onClose}>
          <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className={styles.toolbar}>
        <button className={styles.addBtn} onClick={openCreate} disabled={!roomIdx}>
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          회의록 작성
        </button>
        <button className={styles.aiBtn} onClick={openAiForm} disabled={!roomIdx}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          채팅 AI 회의록
        </button>
        <button
          className={`${styles.voiceBtn} ${lastRecordingSegments?.length ? styles.voiceBtnHasRecording : ''}`}
          onClick={openVoiceAiForm}
          disabled={!roomIdx}
          title={lastRecordingSegments?.length ? '방금 녹음된 파일이 있습니다' : '음성/영상 AI 회의록'}
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
          </svg>
          음성 AI 회의록
        </button>
      </div>

      <div className={styles.list}>
        {loading ? (
          <div className={styles.emptyMsg}>불러오는 중...</div>
        ) : notes.length === 0 ? (
          <div className={styles.emptyMsg}>회의록이 없습니다</div>
        ) : (
          notes.map(n => (
            <div
              key={n.noteIdx}
              className={styles.item}
              onClick={() => { setSelected(n); setView('detail'); }}
            >
              <div className={styles.itemInfo}>
                <span className={styles.itemTitle}>{n.title}</span>
                <span className={styles.itemMeta}>{n.createdAt} · {n.authorNick}</span>
              </div>
              {canDeleteNote(n) && (
                <button
                  className={styles.deleteBtn}
                  onClick={e => { e.stopPropagation(); handleDelete(n); }}
                  title="삭제"
                >
                  <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
