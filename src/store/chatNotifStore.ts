import { create } from 'zustand';

// 방(roomIdx)별 미읽음 메시지 추적(qa 항목15 — 미개방 방 알림)
interface ChatNotifState {
  unread: Record<number, number>;   // roomIdx → 미읽음 수
  openRooms: Set<number>;           // 현재 열려있는(보고있는) 방
  bump: (roomIdx: number) => void;
  clearRoom: (roomIdx: number) => void;
  setOpen: (roomIdx: number) => void;
  unsetOpen: (roomIdx: number) => void;
}

export const useChatNotifStore = create<ChatNotifState>((set, get) => ({
  unread: {},
  openRooms: new Set<number>(),
  bump: (roomIdx) => {
    // 열려있는 방이면 미읽음 증가 안 함
    if (get().openRooms.has(roomIdx)) return;
    set((s) => ({ unread: { ...s.unread, [roomIdx]: (s.unread[roomIdx] ?? 0) + 1 } }));
  },
  clearRoom: (roomIdx) =>
    set((s) => {
      if (!s.unread[roomIdx]) return s;
      const next = { ...s.unread };
      delete next[roomIdx];
      return { unread: next };
    }),
  setOpen: (roomIdx) =>
    set((s) => {
      const next = { ...s.unread };
      delete next[roomIdx];
      return { openRooms: new Set([...s.openRooms, roomIdx]), unread: next };
    }),
  unsetOpen: (roomIdx) =>
    set((s) => {
      const next = new Set(s.openRooms);
      next.delete(roomIdx);
      return { openRooms: next };
    }),
}));
