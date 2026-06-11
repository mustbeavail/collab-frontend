import apiClient from '@/lib/axios';
import type { ApiResponse } from '@/types/auth';

export const testbotService = {
  /** 테스트봇이 현재 유저에게 친구 요청을 보내도록 트리거 */
  invite: () =>
    apiClient.post<ApiResponse<null>>('/api/testbot/invite').then((r) => r.data),
};
