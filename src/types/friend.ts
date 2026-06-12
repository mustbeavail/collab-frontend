export interface FriendItem {
  friendIdx: number;
  userId: string;
  nickname: string;
  email: string;
  status: string;
  avatarUrl?: string | null;
}
