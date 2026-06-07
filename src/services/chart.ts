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

export const chartService = {
  analyze: async (payload: ChartAnalyzePayload): Promise<ChartAnalyzeResponse> => {
    const res = await api.post('/api/chart/analyze', payload);
    return res.data.data;
  },
};
