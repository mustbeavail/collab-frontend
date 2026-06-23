'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './FilePanel.module.css';
import { fileService, FileTooLargeError, type FileItem } from '@/services/file';

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

// [I] 녹음 보관 잔여기간 표시(만료일 기준)
function formatRetention(expiresAt?: string | null): string {
  if (!expiresAt) return '';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (isNaN(ms)) return '';
  if (ms <= 0) return '곧 만료';
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return `${days}일 후 만료`;
}

interface Props {
  onClose: () => void;
  roomIdx: number | null;
  currentUserId?: string;
}

export default function FilePanel({ onClose, roomIdx, currentUserId }: Props) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [recordings, setRecordings] = useState<FileItem[]>([]); // [I] 녹음 목록
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadRecordings = (rid: number) => {
    fileService.getRecordings(rid).then(setRecordings).catch(() => {});
  };

  useEffect(() => {
    if (!roomIdx) return;
    setLoading(true);
    fileService.getFiles(roomIdx)
      .then(setFiles)
      .catch(() => {})
      .finally(() => setLoading(false));
    loadRecordings(roomIdx);
  }, [roomIdx]);

  // 항목1(일정이후): 메시지 x버튼/타 사용자 삭제 → FILE_DELETED 이벤트로 파일함 실시간 동기화
  useEffect(() => {
    const onFileDeleted = (e: Event) => {
      const d = (e as CustomEvent).detail as { roomIdx: number; fileIdx: number } | undefined;
      if (d && d.roomIdx === roomIdx) {
        setFiles(prev => prev.filter(f => f.fileIdx !== d.fileIdx));
        setRecordings(prev => prev.filter(f => f.fileIdx !== d.fileIdx));
      }
    };
    window.addEventListener('collab:file-deleted', onFileDeleted);
    return () => window.removeEventListener('collab:file-deleted', onFileDeleted);
  }, [roomIdx]);

  // [I] 녹음 업로드 완료 시 녹음 목록 실시간 갱신
  useEffect(() => {
    const onRecUploaded = (e: Event) => {
      const d = (e as CustomEvent).detail as { roomIdx: number } | undefined;
      if (d && d.roomIdx === roomIdx) loadRecordings(roomIdx);
    };
    window.addEventListener('collab:recording-uploaded', onRecUploaded);
    return () => window.removeEventListener('collab:recording-uploaded', onRecUploaded);
  }, [roomIdx]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !roomIdx) return;
    e.target.value = '';
    setUploading(true);
    try {
      const uploaded = await fileService.upload(roomIdx, file);
      setFiles(prev => [uploaded, ...prev]);
    } catch (err) {
      alert(err instanceof FileTooLargeError ? err.message : '파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (item: FileItem) => {
    if (!confirm(`"${item.oriFilename}"을(를) 삭제하시겠습니까?`)) return;
    try {
      await fileService.deleteFile(item.fileIdx);
      setFiles(prev => prev.filter(f => f.fileIdx !== item.fileIdx));
      setRecordings(prev => prev.filter(f => f.fileIdx !== item.fileIdx));
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

      {/* [I] 녹음 목록 (있을 때만 표시) */}
      {recordings.length > 0 && (
        <div className={styles.recSection}>
          <div className={styles.sectionLabel}>🎙 녹음 ({recordings.length}) · 30일 보관</div>
          {recordings.map(r => (
            <div key={`rec-${r.fileIdx}`} className={styles.fileItem}>
              <div className={styles.extBadge} style={{ background: '#a78bfa22', color: '#a78bfa' }}>
                REC
              </div>
              <div className={styles.fileInfo}>
                <span className={styles.fileName}>{r.oriFilename}</span>
                <span className={styles.fileMeta}>
                  {r.uploaderNickname} · {formatDate(r.createdAt)} · {formatFileSize(r.fileSize ?? 0)} · {formatRetention(r.expiresAt)}
                </span>
              </div>
              <div className={styles.fileActions}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  title="다운로드"
                  onClick={() => fileService.download(r.fileIdx, r.oriFilename).catch(() => alert('다운로드에 실패했습니다.'))}
                >
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                {r.uploaderId === currentUserId && (
                  <button
                    className={`${styles.actionBtn} ${styles.deleteBtn}`}
                    title="삭제"
                    onClick={() => handleDelete(r)}
                  >
                    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 파일 목록 */}
      <div className={styles.fileList}>
        {recordings.length > 0 && <div className={styles.sectionLabel}>📎 파일</div>}
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
                <button
                  type="button"
                  className={styles.actionBtn}
                  title="다운로드"
                  onClick={() => fileService.download(f.fileIdx, f.oriFilename).catch(() => alert('다운로드에 실패했습니다.'))}
                >
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
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
