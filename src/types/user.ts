export interface UserSearchResult {
  userId: string;
  nickname: string;
  email: string;
}

export interface UserPublicProfile {
  userId: string;
  nickname: string;
  email: string;
  about?: string;
  avatarUrl?: string;
  joinAt?: string;
}
