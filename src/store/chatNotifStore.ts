import { create } from 'zustand';

// 헤더 알림벨에 표시할 새 메시지 알림(I-3). 메시지별 개별 항목(I-11), 읽어도 남김(I-12).
export interface MessageNotif {
  id: number;          // 고유 id
  roomIdx: number;
  roomName: string;
  senderNick: string;
  preview: string;
  ts: number;
  read: boolean;       // 읽음 표시(삭제하지 않고 남김, I-12)
}

const MAX_MESSAGE_NOTIFS = 50;
let notifSeq = 1;

// 방(roomIdx)별 미읽음 메시지 추적(qa 항목15 — 미개방 방 알림)
interface ChatNotifState {
  unread: Record<number, number>;   // roomIdx → 미읽음 수
  messageNotifs: MessageNotif[];    // 헤더 알림벨용 메시지 알림(메시지별, I-3/11/12)
  openRooms: Set<number>;           // 현재 열려있는(보고있는) 방
  justLeftRoomIdx: number | null;   // 방금 나간 방 roomIdx(Sidebar 즉시 제거 신호)
  roomListDirty: number;            // 채팅방 목록 재로드 신호(카운터, E(8))
  bump: (roomIdx: number) => void;
  pushMessageNotif: (n: Omit<MessageNotif, 'id' | 'ts' | 'read'>) => void;
  markRoomNotifsRead: (roomIdx: number) => void;
  clearRoom: (roomIdx: number) => void;
  setOpen: (roomIdx: number) => void;
  unsetOpen: (roomIdx: number) => void;
  markLeft: (roomIdx: number) => void;
  clearLeft: () => void;
  markRoomListDirty: () => void;
}

export const useChatNotifStore = create<ChatNotifState>((set, get) => ({
  unread: {},
  messageNotifs: [],
  openRooms: new Set<number>(),
  justLeftRoomIdx: null,
  roomListDirty: 0,
  markLeft: (roomIdx) => set({ justLeftRoomIdx: roomIdx }),
  clearLeft: () => set({ justLeftRoomIdx: null }),
  markRoomListDirty: () => set((s) => ({ roomListDirty: s.roomListDirty + 1 })),
  bump: (roomIdx) => {
    // 열려있는 방이면 미읽음 증가 안 함
    if (get().openRooms.has(roomIdx)) return;
    set((s) => ({ unread: { ...s.unread, [roomIdx]: (s.unread[roomIdx] ?? 0) + 1 } }));
  },
  // 헤더 알림벨용 메시지 알림 — 메시지마다 개별 항목 추가(I-11). 보고있는 방이면 추가 안 함.
  pushMessageNotif: (n) =>
    set((s) => {
      if (s.openRooms.has(n.roomIdx)) return s;
      const item: MessageNotif = { ...n, id: notifSeq++, ts: Date.now(), read: false };
      const next = [item, ...s.messageNotifs].slice(0, MAX_MESSAGE_NOTIFS);
      return { messageNotifs: next };
    }),
  // 읽음 표시(삭제하지 않고 남김, I-12). 해당 방의 모든 알림을 읽음 처리.
  markRoomNotifsRead: (roomIdx) =>
    set((s) => {
      if (!s.messageNotifs.some((m) => m.roomIdx === roomIdx && !m.read)) return s;
      return { messageNotifs: s.messageNotifs.map((m) => m.roomIdx === roomIdx ? { ...m, read: true } : m) };
    }),
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
      // 방을 보면 헤더 메시지 알림은 '읽음'으로(삭제하지 않음, I-12)
      const notifs = s.messageNotifs.some((m) => m.roomIdx === roomIdx && !m.read)
        ? s.messageNotifs.map((m) => m.roomIdx === roomIdx ? { ...m, read: true } : m)
        : s.messageNotifs;
      return { openRooms: new Set([...s.openRooms, roomIdx]), unread: next, messageNotifs: notifs };
    }),
  unsetOpen: (roomIdx) =>
    set((s) => {
      const next = new Set(s.openRooms);
      next.delete(roomIdx);
      return { openRooms: next };
    }),
}));
