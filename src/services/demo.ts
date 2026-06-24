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
};
