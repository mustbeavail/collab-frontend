export interface UserSearchResult {
  userId: string;
  nickname: string;
  email: string;
  avatarUrl?: string | null;
}

export interface UserPublicProfile {
  userId: string;
  nickname: string;
  email: string;
  about?: string;
  avatarUrl?: string;
  joinAt?: string;
  withdrawn?: boolean;
  // NONE | SELF | FRIEND | SENT | RECEIVED (I-1)
  friendStatus?: string;
}
