import api from '@/lib/axios';

export interface GlobalSearchResult {
  friends: FriendResult[];
  teams: TeamResult[];
  rooms: RoomResult[];
}

export interface FriendResult {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
}

export interface TeamResult {
  teamIdx: number;
  teamName: string;
}

export interface RoomResult {
  roomIdx: number;
  roomName: string;
  isDm: boolean;
}

export interface RoomSearchResult {
  messages: MessageResult[];
  files: FileResult[];
  schedules: ScheduleResult[];
  notes: NoteResult[];
}

export interface MessageResult {
  msgIdx: number;
  content: string;
  senderNick: string;
  sentAt: string | null;
}

export interface FileResult {
  fileIdx: number;
  filename: string;
  fileSize: number;
  uploaderNick: string;
  uploadedAt: string | null;
}

export interface ScheduleResult {
  scheduleIdx: number;
  title: string;
  date: string | null;
}

export interface NoteResult {
  noteIdx: number;
  title: string;
  creatorNick: string;
  createdAt: string | null;
}

export const searchService = {
  globalSearch: async (q: string): Promise<GlobalSearchResult> => {
    const res = await api.get('/api/search/global', { params: { q } });
    return res.data.data;
  },

  roomSearch: async (roomIdx: number, q: string): Promise<RoomSearchResult> => {
    const res = await api.get(`/api/search/rooms/${roomIdx}`, { params: { q } });
    return res.data.data;
  },
};
