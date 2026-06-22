import api from '@/lib/axios';

export interface ScheduleEvent {
  scheduleIdx: number;
  title: string;
  date: string;
  participants: string[];
  content: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  creatorId: string;
  creatorNick: string;
}

export interface CreateSchedulePayload {
  title: string;
  date: string;
  participants?: string[];
  content?: string;
  location?: string;
  lat?: number | null;
  lng?: number | null;
}

export interface UpdateSchedulePayload {
  title: string;
  date: string;
  participants?: string[];
  content?: string;
  location?: string;
  lat?: number | null;
  lng?: number | null;
}

export const scheduleService = {
  getMySchedules: async (): Promise<ScheduleEvent[]> => {
    const res = await api.get('/api/schedule/my');
    return res.data.data;
  },

  getSchedules: async (roomIdx: number): Promise<ScheduleEvent[]> => {
    const res = await api.get(`/api/schedule/rooms/${roomIdx}`);
    return res.data.data;
  },

  createSchedule: async (roomIdx: number, payload: CreateSchedulePayload): Promise<ScheduleEvent> => {
    const res = await api.post(`/api/schedule/rooms/${roomIdx}`, payload);
    return res.data.data;
  },

  updateSchedule: async (scheduleIdx: number, payload: UpdateSchedulePayload): Promise<ScheduleEvent> => {
    const res = await api.put(`/api/schedule/${scheduleIdx}`, payload);
    return res.data.data;
  },

  deleteSchedule: async (scheduleIdx: number): Promise<void> => {
    await api.delete(`/api/schedule/${scheduleIdx}`);
  },
};
