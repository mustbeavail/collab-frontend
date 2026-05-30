export type TeamMember = {
  id: number;
  name: string;
  role: string;
  online: boolean;
};

export type ScheduleItem = {
  id: number;
  title: string;
  date: string;
};

export type Team = {
  id: number;
  name: string;
  initial: string;
  channels: string[];
  members: TeamMember[];
  schedule: ScheduleItem[];
};

export type Friend = {
  id: number;
  name: string;
  online: boolean;
};

export const teams: Team[] = [
  {
    id: 1, name: 'Team Alpha', initial: 'A',
    channels: ['general', 'random', 'announcements', 'design', 'dev'],
    members: [
      { id: 1, name: '홍길동', role: '팀장', online: true  },
      { id: 2, name: '김영희', role: '멤버', online: false },
      { id: 4, name: '박민준', role: '멤버', online: true  },
      { id: 6, name: '정다은', role: '멤버', online: true  },
    ],
    schedule: [
      { id: 1, title: '주간 회의',    date: '매주 월요일 10:00' },
      { id: 2, title: '스프린트 리뷰', date: '6/10 14:00'       },
    ],
  },
  {
    id: 2, name: 'Team Beta', initial: 'B',
    channels: ['general', 'backend', 'frontend', 'ops', 'qa'],
    members: [
      { id: 3, name: '이철수', role: '팀장', online: true  },
      { id: 5, name: '최수연', role: '멤버', online: false },
      { id: 7, name: '오승현', role: '멤버', online: false },
      { id: 1, name: '홍길동', role: '멤버', online: true  },
    ],
    schedule: [
      { id: 1, title: '기술 미팅', date: '매주 수요일 14:00' },
      { id: 2, title: 'QA 리뷰',   date: '6/15 10:00'       },
    ],
  },
  {
    id: 3, name: 'Team Gamma', initial: 'G',
    channels: ['general', 'random', 'planning', 'marketing', 'docs'],
    members: [
      { id: 7, name: '오승현', role: '팀장', online: false },
      { id: 1, name: '홍길동', role: '멤버', online: true  },
      { id: 3, name: '이철수', role: '멤버', online: true  },
      { id: 2, name: '김영희', role: '멤버', online: false },
      { id: 5, name: '최수연', role: '멤버', online: false },
    ],
    schedule: [
      { id: 1, title: '전략 회의', date: '매주 금요일 11:00' },
    ],
  },
];

export const friends: Friend[] = [
  { id: 1, name: '홍길동', online: true  },
  { id: 2, name: '김영희', online: false },
  { id: 3, name: '이철수', online: true  },
  { id: 4, name: '박민준', online: true  },
  { id: 5, name: '최수연', online: false },
  { id: 6, name: '정다은', online: true  },
  { id: 7, name: '오승현', online: false },
];

export function getMembersForChat(chatId: string): TeamMember[] {
  if (chatId.startsWith('channel-')) {
    const teamId = parseInt(chatId.split('-')[1]);
    return teams.find(t => t.id === teamId)?.members ?? [];
  }
  if (chatId.startsWith('dm-')) {
    const friendId = parseInt(chatId.split('-')[1]);
    const friend = friends.find(f => f.id === friendId);
    if (friend) return [
      { id: 0,         name: '나',          role: '',    online: true          },
      { id: friend.id, name: friend.name,   role: '',    online: friend.online },
    ];
  }
  return [];
}
