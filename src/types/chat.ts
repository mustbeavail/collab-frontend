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
}
