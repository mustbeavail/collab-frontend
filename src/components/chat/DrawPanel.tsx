'use client';

import dynamic from 'next/dynamic';
import styles from './DrawPanel.module.css';

const FabricCanvas = dynamic(() => import('./FabricCanvas'), {
  ssr: false,
  loading: () => <div className={styles.loading}>캔버스 로딩 중...</div>,
});

interface Props {
  onClose: () => void;
  roomIdx?: number | null;
}

export default function DrawPanel({ onClose, roomIdx }: Props) {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>그림판</span>
        <button className={styles.closeBtn} onClick={onClose}>
          <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className={styles.canvasArea}>
        <FabricCanvas roomIdx={roomIdx} />
      </div>
    </div>
  );
}
