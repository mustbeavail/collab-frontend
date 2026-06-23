import api from '@/lib/axios';

// 항목8(일정이후): 그림판 캔버스 스냅샷(서버 보관 완성 요소 목록) 조회.
// 패널을 (다시) 열 때 그 이전에 그려진 내용을 받아 초기 표시.
export const drawService = {
  getState: async (roomIdx: number): Promise<unknown[]> => {
    const res = await api.get(`/api/draw/rooms/${roomIdx}`);
    return res.data?.data ?? [];
  },
};
