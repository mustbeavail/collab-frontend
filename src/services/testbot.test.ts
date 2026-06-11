import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import apiClient from '@/lib/axios';
import { testbotService } from './testbot';

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
});

describe('testbotService', () => {
  it('invite 는 /api/testbot/invite 로 POST 하고 응답 본문을 반환한다', async () => {
    let calledUrl: string | undefined;
    mock.onPost('/api/testbot/invite').reply((config) => {
      calledUrl = config.url;
      return [200, { success: true, message: '테스트봇이 친구 요청을 보냈습니다.', errorCode: null, data: null }];
    });

    const res = await testbotService.invite();

    expect(calledUrl).toBe('/api/testbot/invite');
    expect(res.success).toBe(true);
    expect(res.message).toBe('테스트봇이 친구 요청을 보냈습니다.');
  });

  it('invite 실패 시 에러를 던진다', async () => {
    mock.onPost('/api/testbot/invite').reply(500);
    await expect(testbotService.invite()).rejects.toBeDefined();
  });
});
