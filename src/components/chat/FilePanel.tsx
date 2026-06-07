'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './FilePanel.module.css';
import { fileService, type FileItem } from '@/services/file';

const EXT_COLORS: Record<string, string> = {
  pdf: '#f87171', docx: '#60a5fa', xlsx: '#4ade80',
  mp4: '#a78bfa', fig: '#fb923c', png: '#34d399',
  jpg: '#34d399', jpeg: '#34d399', zip: '#fbbf24',
};

const getColor = (ext: string) => EXT_COLORS[ext?.toLowerCase()] ?? '#94a3b8';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(isoStr: string): string {
  return isoStr?.slice(0, 10) ?? '';
}

interface Props {
  onClose: () => void;
  roomIdx: number | null;
  currentUserId?: string;
}

export default function FilePanel({ onClose, roomIdx, currentUserId }: Props) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!roomIdx) return;
    setLoading(true);
    fileService.getFiles(roomIdx)
      .then(setFiles)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [roomIdx]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !roomIdx) return;
    e.target.value = '';
    setUploading(true);
    try {
      const uploaded = await fileService.upload(roomIdx, file);
      setFiles(prev => [uploaded, ...prev]);
    } catch {
      alert('파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (item: FileItem) => {
    if (!confirm(`"${item.oriFilename}"을(를) 삭제하시겠습니까?`)) return;
    try {
      await fileService.deleteFile(item.fileIdx);
      setFiles(prev => prev.filter(f => f.fileIdx !== item.fileIdx));
    } catch {
      alert('파일 삭제에 실패했습니다.');
    }
  };

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
        <button
          className={styles.uploadBtn}
          disabled={uploading || !roomIdx}
          onClick={() => fileInputRef.current?.click()}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {uploading ? '업로드 중...' : '파일 업로드'}
        </button>
        <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
      </div>

      {/* 파일 목록 */}
      <div className={styles.fileList}>
        {loading ? (
          <div className={styles.emptyMsg}>불러오는 중...</div>
        ) : files.length === 0 ? (
          <div className={styles.emptyMsg}>공유된 파일이 없습니다</div>
        ) : (
          files.map(f => (
            <div key={f.fileIdx} className={styles.fileItem}>
              <div
                className={styles.extBadge}
                style={{ background: getColor(f.fileExtension) + '22', color: getColor(f.fileExtension) }}
              >
                {f.fileExtension?.toUpperCase() || 'FILE'}
              </div>
              <div className={styles.fileInfo}>
                <span className={styles.fileName}>{f.oriFilename}</span>
                <span className={styles.fileMeta}>
                  {f.uploaderNickname} · {formatDate(f.createdAt)} · {formatFileSize(f.fileSize ?? 0)}
                </span>
              </div>
              <div className={styles.fileActions}>
                <a
                  href={fileService.getDownloadUrl(f.fileIdx)}
                  download={f.oriFilename}
                  className={styles.actionBtn}
                  title="다운로드"
                >
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
                {f.uploaderId === currentUserId && (
                  <button
                    className={`${styles.actionBtn} ${styles.deleteBtn}`}
                    title="삭제"
                    onClick={() => handleDelete(f)}
                  >
                    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
