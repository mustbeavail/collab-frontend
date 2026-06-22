export interface ChatMessage {
  msgIdx: number;
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  content: string;
  msgType: string;
  sentAt: string;
}

export interface FileMessageContent {
  fileIdx: number;
  oriFilename: string;
  fileSize: number;
  fileExtension: string;
  deleted?: boolean; // 항목1(일정이후): 파일 삭제 시 메시지는 남기고 '삭제된 파일' 표시
}

export interface MessagePage {
  messages: ChatMessage[];
  hasMore: boolean;
}

export interface RoomMember {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  role: string;
}

export interface ChatRoomInfo {
  roomIdx: number;
  roomName: string;
  teamIdx: number | null;
}

export interface ChatRoomDetail {
  roomIdx: number;
  roomName: string;
  createdAt: string;
  isDm: boolean;
  teamIdx: number | null;
  memberCount: number;
  myRole: string | null;
}
