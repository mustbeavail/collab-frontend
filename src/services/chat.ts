import api from '@/lib/axios';
import type { ChatRoomDetail, ChatRoomInfo, MessagePage, RoomMember } from '@/types/chat';

export const chatService = {
  getMessages: async (roomIdx: number, before?: number, size = 50): Promise<MessagePage> => {
    const params: Record<string, unknown> = { size };
    if (before !== undefined) params.before = before;
    const res = await api.get(`/api/chat/rooms/${roomIdx}/messages`, { params });
    return res.data.data;
  },

  getMembers: async (roomIdx: number): Promise<RoomMember[]> => {
    const res = await api.get(`/api/chat/rooms/${roomIdx}/members`);
    return res.data.data;
  },

  inviteMember: async (roomIdx: number, userId: string): Promise<void> => {
    await api.post(`/api/chat/rooms/${roomIdx}/members/invite`, { userId });
  },

  leaveRoom: async (roomIdx: number): Promise<void> => {
    await api.post(`/api/chat/rooms/${roomIdx}/leave`);
  },

  kickMember: async (roomIdx: number, userId: string): Promise<void> => {
    await api.delete(`/api/chat/rooms/${roomIdx}/members/${encodeURIComponent(userId)}`);
  },

  getOrCreateDmRoom: async (targetUserId: string): Promise<ChatRoomInfo> => {
    const res = await api.post(`/api/chat/rooms/dm/${encodeURIComponent(targetUserId)}`);
    return res.data.data;
  },

  getRoomInfo: async (roomIdx: number): Promise<ChatRoomDetail> => {
    const res = await api.get(`/api/chat/rooms/${roomIdx}`);
    return res.data.data;
  },

  updateRoomInfo: async (roomIdx: number, roomName: string, description?: string | null): Promise<ChatRoomDetail> => {
    const res = await api.put(`/api/chat/rooms/${roomIdx}`, { roomName, description });
    return res.data.data;
  },
};
