import { useTeamStore } from '@/store/teamStore';
import { useFriendStore } from '@/store/friendStore';

export type TeamMember = {
  id: number;
  name: string;
  role: string;
  online: boolean;
};

export function getMembersForChat(chatId: string): TeamMember[] {
  if (chatId.startsWith('channel-')) {
    const parts = chatId.split('-');
    const teamIdx = parseInt(parts[1]);
    const team = useTeamStore.getState().teams.find(t => t.teamIdx === teamIdx);
    if (!team) return [];
    return team.members.map((m, i) => ({
      id: i,
      name: m.nickname,
      role: m.role,
      online: false,
    }));
  }
  if (chatId.startsWith('dm-')) {
    const friendIdx = parseInt(chatId.split('-')[1]);
    const friend = useFriendStore.getState().friends.find(f => f.friendIdx === friendIdx);
    if (friend) return [
      { id: 0, name: '나',          role: '', online: true  },
      { id: 1, name: friend.nickname, role: '', online: false },
    ];
  }
  return [];
}
