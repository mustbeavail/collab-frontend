export interface TeamChannel {
  roomIdx: number;
  roomName: string;
}

export interface TeamMemberItem {
  userId: string;
  nickname: string;
  role: string;
}

export interface TeamItem {
  teamIdx: number;
  teamName: string;
  myRole: string;
  channels: TeamChannel[];
  members: TeamMemberItem[];
}
