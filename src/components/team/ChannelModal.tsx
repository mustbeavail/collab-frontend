'use client';

import { useState } from 'react';
import styles from './TeamModal.module.css';

interface Props {
  onConfirm: (roomName: string) => Promise<void>;
  onClose: () => void;
}

/** 팀 채팅방(채널) 추가 모달. 기존 prompt() 대체. */
export default function ChannelModal({ onConfirm, onClose }: Props) {
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) { setError('채팅방 이름을 입력해주세요.'); return; }
    setLoading(true);
    setError('');
    try {
      await onConfirm(roomName.trim());
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? '채팅방 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>채팅방 추가</h2>
          <button className={styles.closeBtn} onClick={onClose} disabled={loading}>
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>채팅방 이름 <span className={styles.required}>*</span></label>
            <input
              className={`${styles.input} ${error && !roomName.trim() ? styles.inputError : ''}`}
              value={roomName}
              onChange={(e) => { setRoomName(e.target.value); setError(''); }}
              placeholder="채팅방 이름을 입력하세요"
              maxLength={255}
              autoFocus
              disabled={loading}
            />
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={loading}>
              취소
            </button>
            <button type="submit" className={styles.submitBtn} disabled={loading || !roomName.trim()}>
              {loading ? '처리 중...' : '만들기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
