export interface TeamChannel {
  roomIdx: number;
  roomName: string;
  joined: boolean;
}

export interface TeamMemberItem {
  userId: string;
  nickname: string;
  role: string;
}

export interface TeamItem {
  teamIdx: number;
  teamName: string;
  about?: string;
  myRole: string;
  channels: TeamChannel[];
  members: TeamMemberItem[];
}

export interface CreateTeamRequest {
  teamName: string;
  about?: string;
}

export interface UpdateTeamRequest {
  teamName: string;
  about?: string;
}

export interface TeamInvitationItem {
  tmIdx: number;
  teamIdx: number;
  teamName: string;
}
