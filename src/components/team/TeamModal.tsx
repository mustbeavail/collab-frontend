'use client';

import { useState, useEffect } from 'react';
import styles from './TeamModal.module.css';
import type { TeamItem } from '@/types/team';

interface Props {
  mode: 'create' | 'edit';
  team?: TeamItem;
  onConfirm: (teamName: string, about: string) => Promise<void>;
  onClose: () => void;
}

export default function TeamModal({ mode, team, onConfirm, onClose }: Props) {
  const [teamName, setTeamName] = useState(team?.teamName ?? '');
  const [about,    setAbout]    = useState(team?.about ?? '');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    setTeamName(team?.teamName ?? '');
    setAbout(team?.about ?? '');
    setError('');
  }, [team]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) { setError('팀 이름을 입력해주세요.'); return; }
    setLoading(true);
    setError('');
    try {
      await onConfirm(teamName.trim(), about.trim());
      onClose();
    } catch {
      setError('처리 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{mode === 'create' ? '팀 만들기' : '팀 수정'}</h2>
          <button className={styles.closeBtn} onClick={onClose} disabled={loading}>
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>팀 이름 <span className={styles.required}>*</span></label>
            <input
              className={`${styles.input} ${error && !teamName.trim() ? styles.inputError : ''}`}
              value={teamName}
              onChange={(e) => { setTeamName(e.target.value); setError(''); }}
              placeholder="팀 이름을 입력하세요"
              maxLength={255}
              autoFocus
              disabled={loading}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>소개 <span className={styles.optional}>(선택)</span></label>
            <textarea
              className={styles.textarea}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="팀을 소개해주세요"
              rows={3}
              maxLength={6000}
              disabled={loading}
            />
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={loading}>
              취소
            </button>
            <button type="submit" className={styles.submitBtn} disabled={loading || !teamName.trim()}>
              {loading ? '처리 중...' : mode === 'create' ? '만들기' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
