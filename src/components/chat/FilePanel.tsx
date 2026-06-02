'use client';

import { useState } from 'react';
import styles from './FilePanel.module.css';

interface SharedFile {
  id: string;
  name: string;
  sharedBy: string;
  date: string;
  size: string;
}

const INITIAL_FILES: SharedFile[] = [
  { id: '1', name: '프로젝트_기획서.pdf',       sharedBy: '홍길동', date: '2026-06-01', size: '2.4 MB' },
  { id: '2', name: '디자인_시안_v2.fig',         sharedBy: '김영희', date: '2026-06-03', size: '8.1 MB' },
  { id: '3', name: 'API_문서.docx',              sharedBy: '박민준', date: '2026-06-04', size: '0.9 MB' },
  { id: '4', name: '회의_녹화본.mp4',             sharedBy: '이철수', date: '2026-06-05', size: '124 MB' },
  { id: '5', name: '데이터_분석_결과.xlsx',       sharedBy: '정다은', date: '2026-06-02', size: '1.7 MB' },
  { id: '6', name: '스크린샷_0601.png',           sharedBy: '홍길동', date: '2026-06-01', size: '0.4 MB' },
];

const EXT_COLORS: Record<string, string> = {
  pdf: '#f87171', docx: '#60a5fa', xlsx: '#4ade80',
  mp4: '#a78bfa', fig: '#fb923c', png: '#34d399',
  jpg: '#34d399', jpeg: '#34d399', zip: '#fbbf24',
};

const getExt   = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
const getColor = (name: string) => EXT_COLORS[getExt(name)] ?? '#94a3b8';

export default function FilePanel({ onClose }: { onClose: () => void }) {
  const [files, setFiles] = useState<SharedFile[]>(INITIAL_FILES);

  const deleteFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  return (
    <div className={styles.panel}>
      {/* 헤더 */}
      <div className={styles.header}>
        <span className={styles.title}>파일</span>
        <button className={styles.closeBtn} onClick={onClose}>
          <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 업로드 버튼 */}
      <div className={styles.uploadArea}>
        <button className={styles.uploadBtn}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          파일 업로드
        </button>
      </div>

      {/* 파일 목록 */}
      <div className={styles.fileList}>
        {files.length === 0 ? (
          <div className={styles.emptyMsg}>공유된 파일이 없습니다</div>
        ) : (
          files.map(f => (
            <div key={f.id} className={styles.fileItem}>
              <div
                className={styles.extBadge}
                style={{ background: getColor(f.name) + '22', color: getColor(f.name) }}
              >
                {getExt(f.name).toUpperCase()}
              </div>
              <div className={styles.fileInfo}>
                <span className={styles.fileName}>{f.name}</span>
                <span className={styles.fileMeta}>{f.sharedBy} · {f.date} · {f.size}</span>
              </div>
              <div className={styles.fileActions}>
                <button className={styles.actionBtn} title="다운로드">
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                <button className={`${styles.actionBtn} ${styles.deleteBtn}`} title="삭제" onClick={() => deleteFile(f.id)}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
