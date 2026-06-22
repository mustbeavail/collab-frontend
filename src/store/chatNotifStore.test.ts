import { describe, it, expect, beforeEach } from 'vitest';
import { useChatNotifStore } from './chatNotifStore';

const reset = () =>
  useChatNotifStore.setState({
    unread: {},
    messageNotifs: [],
    openRooms: new Set<number>(),
    justLeftRoomIdx: null,
    roomListDirty: 0,
  });

beforeEach(reset);

const notif = (roomIdx: number, n = 1) => ({
  roomIdx,
  roomName: `room${roomIdx}`,
  senderNick: `sender${roomIdx}`,
  preview: `msg ${n}`,
});

describe('chatNotifStore 메시지 알림(I-3/11/12)', () => {
  it('pushMessageNotif: 메시지마다 개별 항목 추가(I-11)', () => {
    const { pushMessageNotif } = useChatNotifStore.getState();
    pushMessageNotif(notif(7, 1));
    pushMessageNotif(notif(7, 2));
    const list = useChatNotifStore.getState().messageNotifs;
    expect(list).toHaveLength(2); // 집계 1개가 아니라 메시지별 2개
    expect(list[0].preview).toBe('msg 2'); // 최신이 앞
    expect(list.every((m) => !m.read)).toBe(true);
  });

  it('열린(보고있는) 방은 알림 추가 안 함', () => {
    const { setOpen, pushMessageNotif } = useChatNotifStore.getState();
    setOpen(7);
    pushMessageNotif(notif(7));
    expect(useChatNotifStore.getState().messageNotifs).toHaveLength(0);
  });

  it('setOpen: 방 읽으면 알림을 삭제 안 하고 읽음표시(I-12)', () => {
    const { pushMessageNotif, setOpen } = useChatNotifStore.getState();
    pushMessageNotif(notif(9, 1));
    pushMessageNotif(notif(9, 2));
    setOpen(9);
    const list = useChatNotifStore.getState().messageNotifs;
    expect(list).toHaveLength(2); // 남아있음
    expect(list.every((m) => m.read)).toBe(true); // 읽음표시
  });

  it('markRoomNotifsRead: 특정 방 알림만 읽음(다른 방 영향 없음)', () => {
    const { pushMessageNotif, markRoomNotifsRead } = useChatNotifStore.getState();
    pushMessageNotif(notif(1));
    pushMessageNotif(notif(2));
    markRoomNotifsRead(1);
    const list = useChatNotifStore.getState().messageNotifs;
    expect(list.find((m) => m.roomIdx === 1)!.read).toBe(true);
    expect(list.find((m) => m.roomIdx === 2)!.read).toBe(false);
  });
});
