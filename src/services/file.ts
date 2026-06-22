import api from '@/lib/axios';

export interface FileItem {
  fileIdx: number;
  oriFilename: string;
  fileExtension: string;
  fileSize: number;
  createdAt: string;
  uploaderNickname: string;
  uploaderId: string;
}

export const fileService = {
  upload: async (roomIdx: number, file: File): Promise<FileItem> => {
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
