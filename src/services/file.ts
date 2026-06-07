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

  getDownloadUrl: (fileIdx: number): string => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? '';
    return `${base}/api/files/${fileIdx}/download`;
  },
};
