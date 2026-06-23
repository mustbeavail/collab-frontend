import api from '@/lib/axios';

export interface FileItem {
  fileIdx: number;
  oriFilename: string;
  fileExtension: string;
  fileSize: number;
  createdAt: string;
  uploaderNickname: string;
  uploaderId: string;
  expiresAt?: string | null; // [I] 녹음 파일 만료일시(일반 파일은 null)
}

// 파일 업로드 용량 한도(H-18) — 실효 백엔드 한도(FileService.MAX_FILE_SIZE = 50MB)와 일치.
// ※multipart 설정은 100MB지만 FileService가 서비스 레이어에서 50MB로 막으므로 50MB가 실제 한도.
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_FILE_SIZE_LABEL = '50MB';

// 용량 초과 시 업로드 단일 지점(upload)에서 던지는 에러. 호출처가 이 메시지를 alert로 표시한다.
export class FileTooLargeError extends Error {
  constructor() {
    super(`파일 용량은 ${MAX_FILE_SIZE_LABEL}를 넘을 수 없습니다.`);
    this.name = 'FileTooLargeError';
  }
}

export const fileService = {
  upload: async (roomIdx: number, file: File): Promise<FileItem> => {
    // 기준치 초과면 네트워크 요청 전 조기종료(H-18). 호출처 catch가 메시지 표시.
    if (file.size > MAX_FILE_SIZE) {
      throw new FileTooLargeError();
    }
    const form = new FormData();
    form.append('file', file);
    const res = await api.post(`/api/files?roomIdx=${roomIdx}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  getFiles: async (roomIdx: number): Promise<FileItem[]> => {
    const res = await api.get('/api/files', { params: { roomIdx } });
    return res.data.data;
  },

  // [I] 음성 녹음 업로드(서버 30일 보관, 채팅 메시지 미생성)
  uploadRecording: async (roomIdx: number, file: File): Promise<FileItem> => {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post(`/api/files/recordings?roomIdx=${roomIdx}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  // [I] 녹음 목록(만료 전만)
  getRecordings: async (roomIdx: number): Promise<FileItem[]> => {
    const res = await api.get('/api/files/recordings', { params: { roomIdx } });
    return res.data.data;
  },

  deleteFile: async (fileIdx: number): Promise<void> => {
    await api.delete(`/api/files/${fileIdx}`);
  },

  // 인증 헤더(Bearer)가 필요하므로 <a href> 직접 링크 대신 axios로 blob 다운로드(항목8: 401 수정)
  download: async (fileIdx: number, filename: string): Promise<void> => {
    const res = await api.get(`/api/files/${fileIdx}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
