import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import apiClient from '@/lib/axios';
import { fileService, FileTooLargeError, MAX_FILE_SIZE } from './file';

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
});

// File.size는 읽기전용이라 생성자 대신 size를 직접 정의해 가짜 파일 생성
function fakeFile(name: string, size: number): File {
  const f = new File(['x'], name, { type: 'text/plain' });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

describe('fileService.upload 용량 제한(H-18)', () => {
  it('한도(50MB) 초과 시 FileTooLargeError를 던지고 네트워크 요청을 보내지 않는다', async () => {
    let posted = false;
    mock.onPost(/\/api\/files/).reply(() => { posted = true; return [200, { data: {} }]; });

    const tooBig = fakeFile('big.bin', MAX_FILE_SIZE + 1);
    await expect(fileService.upload(1, tooBig)).rejects.toBeInstanceOf(FileTooLargeError);
    expect(posted).toBe(false); // 조기종료 — POST 미발생
  });

  it('FileTooLargeError 메시지에 한도(50MB)가 포함된다', () => {
    const err = new FileTooLargeError();
    expect(err.message).toContain('50MB');
    expect(err.name).toBe('FileTooLargeError');
  });

  it('한도 이하 파일은 정상 업로드되어 응답 data를 반환한다', async () => {
    const item = { fileIdx: 7, oriFilename: 'ok.txt', fileExtension: 'txt', fileSize: 10, createdAt: '', uploaderNickname: '', uploaderId: '' };
    mock.onPost(/\/api\/files/).reply(200, { data: item });

    const ok = fakeFile('ok.txt', MAX_FILE_SIZE); // 경계값(정확히 50MB) 허용
    const res = await fileService.upload(1, ok);
    expect(res.fileIdx).toBe(7);
  });
});
