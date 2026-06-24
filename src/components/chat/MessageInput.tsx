'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './MessageInput.module.css';
import { fileService, FileTooLargeError } from '@/services/file';

interface Props {
  channelName: string;
  isDm?: boolean;
  showMicToggle?: boolean;
  micMuted?: boolean;
  onMicToggle?: () => void;
  onSend?: (content: string) => void;
  onFileUpload?: (fileIdx: number, oriFilename: string, fileSize: number, fileExtension: string) => void;
  onAnalyzeFile?: (file: File) => void;
  roomIdx?: number | null;
}

export default function MessageInput({ channelName, isDm = false, showMicToggle = false, micMuted = false, onMicToggle, onSend, onFileUpload, onAnalyzeFile, roomIdx }: Props) {
  const [value, setValue] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const attachWrapRef  = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const analyzeInputRef = useRef<HTMLInputElement>(null);

  // 여러 줄로 늘어난 입력란을 기본 높이(36px)로 복원(*추가1)
  const resetTextareaHeight = () => {
    if (textareaRef.current) textareaRef.current.style.height = '36px';
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
    setValue('');
    resetTextareaHeight(); // 전송 후 입력란 높이 원복
  };

  // 외부 클릭 시 팝업 닫기
  useEffect(() => {
    if (!attachOpen) return;
    const handler = (e: MouseEvent) => {
      if (!attachWrapRef.current?.contains(e.target as Node)) setAttachOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [attachOpen]);

  return (
    <div className={styles.wrap}>
      <div className={styles.box}>

        {/* 파일 첨부 버튼 + 팝업 */}
        <div className={styles.attachWrap} ref={attachWrapRef}>
          <button
            className={`${styles.iconBtn} ${attachOpen ? styles.iconBtnActive : ''}`}
            onClick={() => setAttachOpen(v => !v)}
            title="파일 첨부"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          {attachOpen && (
            <div className={styles.attachMenu}>
              <button
                className={styles.attachOption}
                disabled={uploading}
                onClick={() => { fileInputRef.current?.click(); setAttachOpen(false); }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span className={styles.attachOptionText}>{uploading ? '업로드 중...' : '일반 파일 첨부'}</span>
              </button>
              <div className={styles.attachDivider} />
              <button
                className={styles.attachOption}
                onClick={() => { analyzeInputRef.current?.click(); setAttachOpen(false); }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span>
                  AI 데이터 분석
                  <span className={styles.attachOptionDesc}>엑셀 파일 등을 첨부하면 AI가 그래프로 시각화합니다.</span>
                </span>
              </button>
            </div>
          )}

          {/* 항목4(일정이후): 'AI 데이터 분석' 전용 입력 — 일반 첨부와 달리 시각화 패널을 연다 */}
          <input
            ref={analyzeInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) onAnalyzeFile?.(file);
            }}
          />

          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !roomIdx || !onFileUpload) return;
              e.target.value = '';
              setUploading(true);
              try {
                const uploaded = await fileService.upload(roomIdx, file);
                onFileUpload(uploaded.fileIdx, uploaded.oriFilename, uploaded.fileSize, uploaded.fileExtension);
              } catch (err) {
                alert(err instanceof FileTooLargeError ? err.message : '파일 업로드에 실패했습니다.');
              } finally {
                setUploading(false);
              }
            }}
          />
        </div>

        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={`${isDm ? '@' : '#'}${channelName}에 메시지 보내기`}
          rows={1}
          onInput={e => {
            const el = e.currentTarget;
            el.style.height = '36px';
            el.style.height = Math.min(el.scrollHeight, 120) + 'px';
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            } else if (e.key === 'Escape' && value) {
              // 입력 취소: 내용 비우고 높이 원복(*추가1)
              e.preventDefault();
              setValue('');
              resetTextareaHeight();
            }
          }}
        />

        <div className={styles.rightActions}>
          {showMicToggle && (
            <button
              className={`${styles.micToggleBtn} ${micMuted ? styles.micToggleMuted : styles.micToggleActive}`}
              onClick={onMicToggle}
              title={micMuted ? '마이크 켜기' : '마이크 끄기'}
            >
              {micMuted ? (
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v3" />
                  <path strokeLinecap="round" strokeWidth={2} d="M3 3l18 18" />
                </svg>
              ) : (
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
          )}
          {/* 항목19(일정이후): 미구현 이모티콘 아이콘 삭제 */}
          <button
            className={`${styles.sendBtn} ${value.trim() ? styles.sendBtnActive : styles.sendBtnInactive}`}
            onClick={handleSend}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
