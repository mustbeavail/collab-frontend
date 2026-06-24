import api from '@/lib/axios';

export interface ChartDataset {
  label: string;
  data: (number | null)[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
}

export interface ChartAnalyzeResponse {
  chartType: string;
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartAnalyzePayload {
  roomIdx: number;
  tableData: (string | number | null)[][];
  question?: string;
}

export interface ChartSharePayload {
  fromUserId: string;
  fromNickname: string;
  chartConfig: ChartAnalyzeResponse;
}

export const chartService = {
  analyze: async (payload: ChartAnalyzePayload): Promise<ChartAnalyzeResponse> => {
    const res = await api.post('/api/chart/analyze', payload);
    return res.data.data;
  },

  // 항목4(일정이후): 방의 현재 공유 차트 스냅샷(없으면 null) — 패널을 (다시) 열 때 표시.
  getShared: async (roomIdx: number): Promise<ChartSharePayload | null> => {
    const res = await api.get(`/api/chart/rooms/${roomIdx}`);
    return res.data.data ?? null;
  },
};
