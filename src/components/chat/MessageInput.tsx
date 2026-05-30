'use client';

import { useState } from 'react';
import styles from './MessageInput.module.css';

export default function MessageInput({ channelName, isDm = false }: { channelName: string; isDm?: boolean }) {
  const [value, setValue] = useState('');

  return (
    <div className={styles.wrap}>
      <div className={styles.box}>
        <button className={styles.iconBtn}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
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
        />
        <div className={styles.rightActions}>
          <button className={styles.iconBtn}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button className={`${styles.sendBtn} ${value ? styles.sendBtnActive : styles.sendBtnInactive}`}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
