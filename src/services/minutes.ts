import api from '@/lib/axios';

export interface MeetingNote {
  noteIdx: number;
  title: string;
  content: string | null;
  createdAt: string;
  authorId: string;
  authorNick: string;
}

export interface CreateMeetingNotePayload {
  title: string;
  content?: string;
}

export interface UpdateMeetingNotePayload {
  title: string;
  content?: string;
}

export interface AiGeneratePayload {
  startTime: string; // "yyyy-MM-ddTHH:mm"
  endTime: string;
}

// 항목2(일정이후): AI 회의록 시간범위 디폴트(방의 가장 오래된~최신 메시지 시각)
export interface MinutesTimeRange {
  start: string | null; // "yyyy-MM-ddTHH:mm"
  end: string | null;
}

export const minutesService = {
  getNotes: async (roomIdx: number): Promise<MeetingNote[]> => {
    const res = await api.get(`/api/minutes/rooms/${roomIdx}`);
    return res.data.data;
  },

  createNote: async (roomIdx: number, payload: CreateMeetingNotePayload): Promise<MeetingNote> => {
    const res = await api.post(`/api/minutes/rooms/${roomIdx}`, payload);
    return res.data.data;
  },

  updateNote: async (noteIdx: number, payload: UpdateMeetingNotePayload): Promise<MeetingNote> => {
    const res = await api.put(`/api/minutes/${noteIdx}`, payload);
    return res.data.data;
  },

  deleteNote: async (noteIdx: number): Promise<void> => {
    await api.delete(`/api/minutes/${noteIdx}`);
  },

  getTimeRange: async (roomIdx: number): Promise<MinutesTimeRange> => {
    const res = await api.get(`/api/minutes/rooms/${roomIdx}/time-range`);
    return res.data.data;
  },

  generateAiMinutes: async (roomIdx: number, payload: AiGeneratePayload): Promise<MeetingNote> => {
    const res = await api.post(`/api/minutes/rooms/${roomIdx}/ai-generate`, payload);
    return res.data.data;
  },

  generateVoiceMinutes: async (roomIdx: number, audioBlobs: Blob[], mimeType: string): Promise<MeetingNote> => {
    const formData = new FormData();
    const ext = mimeType.includes('video') ? 'webm' : 'webm';
    audioBlobs.forEach((blob, i) => {
      formData.append('audio', blob, `segment-${i + 1}.${ext}`);
    });
    const res = await api.post(`/api/minutes/rooms/${roomIdx}/voice-generate`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },
};
