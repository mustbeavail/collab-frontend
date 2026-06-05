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
}
