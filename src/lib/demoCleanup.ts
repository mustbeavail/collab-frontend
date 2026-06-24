import api from '@/lib/axios';
import type { DemoArtifacts } from '@/store/demoStore';

/**
 * 시연 중 만든 부산물을 기존 DELETE 엔드포인트로 정리한다(실패 무시).
 * 시연 계정의 기존 데이터는 건드리지 않고, 추적된 ID만 삭제한다.
 */
export async function cleanupDemoArtifacts(a: DemoArtifacts): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  const del = (url: string) => tasks.push(api.delete(url).catch(() => {}));

  for (const fileIdx of a.fileIdxs) del(`/api/files/${fileIdx}`);
  if (a.scheduleIdx != null) del(`/api/schedule/${a.scheduleIdx}`);
  if (a.teamIdx != null) del(`/api/teams/${a.teamIdx}`); // 팀 삭제 시 팀 채널도 정리됨
  // 봇 DM은 팀채널이 아니라 DELETE 권한이 없으므로 '나가기'로 정리(다음 시연은 새 DM 생성)
  if (a.dmRoomIdx != null) tasks.push(api.post(`/api/chat/rooms/${a.dmRoomIdx}/leave`).catch(() => {}));
  if (a.friendIdx != null) del(`/api/friends/${a.friendIdx}`); // 봇 친구관계 해제(다음 시연서 재요청 가능)

  await Promise.all(tasks);
}
