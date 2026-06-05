'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './MessageInput.module.css';

interface Props {
  channelName: string;
  isDm?: boolean;
  showMicToggle?: boolean;
  micMuted?: boolean;
  onMicToggle?: () => void;
  onSend?: (content: string) => void;
}

export default function MessageInput({ channelName, isDm = false, showMicToggle = false, micMuted = false, onMicToggle, onSend }: Props) {
  const [value, setValue] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
    setValue('');
  };
  const attachWrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);

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
                onClick={() => { fileInputRef.current?.click(); setAttachOpen(false); }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span className={styles.attachOptionText}>일반 파일 첨부</span>
              </button>
              <div className={styles.attachDivider} />
              <button
                className={styles.attachOption}
                onClick={() => { fileInputRef.current?.click(); setAttachOpen(false); }}
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

          <input ref={fileInputRef} type="file" style={{ display: 'none' }} />
        </div>

        <textarea
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
          <button className={styles.iconBtn}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
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
