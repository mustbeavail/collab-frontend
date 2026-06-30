import api from '@/lib/axios';

export interface DemoAccount {
  accessToken: string;
  userId: string;
  nickname: string;
  email: string;
}

export const demoService = {
  // 미사용 테스트계정을 받아 자동 로그인용 토큰을 반환. 모두 사용중이면 409(DEMO_ACCOUNTS_BUSY).
  acquireAccount: async (): Promise<DemoAccount> => {
    const res = await api.post('/api/demo/account');
    return res.data.data;
  },

  // 시연 종료 시 계정 예약(demo-lock)·online 즉시 해제. 반드시 로그아웃 직전(토큰 유효할 때) 호출.
  release: async (): Promise<void> => {
    await api.post('/api/demo/release');
  },
};
