'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut, Radar } from 'react-chartjs-2';
import { chartService, ChartAnalyzeResponse } from '@/services/chart';
import { useStompClient } from '@/providers/StompProvider';
import styles from './ChartPanel.module.css';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, RadialLinearScale, Title, Tooltip, Legend, Filler
);

type View = 'upload' | 'loading' | 'result';

interface ChartSharePayload {
  fromUserId: string;
  fromNickname: string;
  chartConfig: ChartAnalyzeResponse;
}

function renderChart(config: ChartAnalyzeResponse) {
  const data = { labels: config.labels, datasets: config.datasets as never[] };
  const opts = { responsive: true, maintainAspectRatio: false };
  switch (config.chartType) {
    case 'line':     return <Line     data={data} options={opts} />;
    case 'pie':      return <Pie      data={data} options={opts} />;
    case 'doughnut': return <Doughnut data={data} options={opts} />;
    case 'radar':    return <Radar    data={data} options={opts} />;
    default:         return <Bar      data={data} options={opts} />;
  }
}

export default function ChartPanel({
  onClose,
  roomIdx,
  currentUserId,
}: {
  onClose: () => void;
  roomIdx?: number | null;
  currentUserId?: string;
}) {
  const client = useStompClient();
  const [view, setView]             = useState<View>('upload');
  const [question, setQuestion]     = useState('');
  const [tableData, setTableData]   = useState<(string | number | null)[][]>([]);
  const [fileName, setFileName]     = useState('');
  const [chartConfig, setChartConfig] = useState<ChartAnalyzeResponse | null>(null);
  const [sharedChart, setSharedChart] = useState<ChartSharePayload | null>(null);
  const [error, setError]           = useState('');
  const subRef = useRef<{ unsubscribe(): void } | null>(null);

  // 차트 공유 구독
  useEffect(() => {
    if (!client || !roomIdx) return;
    subRef.current = client.subscribe(`/topic/chart/${roomIdx}`, frame => {
      try {
        const payload: ChartSharePayload = JSON.parse(frame.body);
        if (payload.fromUserId !== currentUserId) {
          setSharedChart(payload);
        }
      } catch { /* ignore */ }
    });
    return () => { subRef.current?.unsubscribe(); };
  }, [client, roomIdx, currentUserId]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError('');
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        setTableData(rows.filter(r => r.some(c => c !== null && c !== '')));
      } catch {
        setError('파일을 읽을 수 없습니다. xlsx 또는 xls 파일을 선택해주세요.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!roomIdx || tableData.length === 0) return;
    setView('loading');
    setError('');
    try {
      const result = await chartService.analyze({ roomIdx, tableData, question: question.trim() || undefined });
      setChartConfig(result);
      setView('result');
    } catch {
      setError('분석에 실패했습니다. 다시 시도해주세요.');
      setView('upload');
    }
  }, [roomIdx, tableData, question]);

  const handleShare = useCallback(() => {
    if (!client || !roomIdx || !chartConfig) return;
    try {
      client.publish({
        destination: `/app/chart.share/${roomIdx}`,
        body: JSON.stringify({ chartConfig }),
      });
    } catch { /* ignore */ }
  }, [client, roomIdx, chartConfig]);

  const handleReset = useCallback(() => {
    setView('upload');
    setTableData([]);
    setFileName('');
    setQuestion('');
    setChartConfig(null);
    setSharedChart(null);
    setError('');
  }, []);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>엑셀 데이터 시각화</span>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div className={styles.body}>
        {/* 다른 사용자가 공유한 차트 */}
        {sharedChart && (
          <div className={styles.sharedBanner}>
            <span className={styles.sharedNick}>{sharedChart.fromNickname}</span>님이 차트를 공유했습니다.
            <button
              className={styles.sharedViewBtn}
              onClick={() => { setChartConfig(sharedChart.chartConfig); setView('result'); setSharedChart(null); }}
            >
              보기
            </button>
            <button className={styles.sharedDismissBtn} onClick={() => setSharedChart(null)}>✕</button>
          </div>
        )}

        {view === 'upload' && (
          <div className={styles.uploadView}>
            <label className={styles.fileLabel}>
              <input type="file" accept=".xlsx,.xls,.csv" className={styles.fileInput} onChange={handleFileChange} />
              <div className={styles.fileDropzone}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={styles.uploadIcon}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className={styles.dropText}>
                  {fileName ? fileName : 'Excel / CSV 파일을 선택하세요'}
                </p>
                <p className={styles.dropSub}>.xlsx · .xls · .csv 지원</p>
              </div>
            </label>

            {tableData.length > 0 && (
              <>
                <div className={styles.preview}>
                  <p className={styles.previewTitle}>미리보기 ({tableData.length}행)</p>
                  <div className={styles.tableWrap}>
                    <table className={styles.previewTable}>
                      <tbody>
                        {tableData.slice(0, 5).map((row, ri) => (
                          <tr key={ri}>
                            {row.map((cell, ci) => (
                              <td key={ci} className={styles.td}>{cell ?? ''}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {tableData.length > 5 && (
                    <p className={styles.previewMore}>... 외 {tableData.length - 5}행</p>
                  )}
                </div>

                <input
                  className={styles.questionInput}
                  type="text"
                  placeholder="분석 질문 (선택): 예) 월별 판매량 추이를 보여줘"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  maxLength={200}
                />

                <button className={styles.analyzeBtn} onClick={handleAnalyze}>
                  AI로 차트 생성
                </button>
              </>
            )}

            {error && <p className={styles.error}>{error}</p>}
          </div>
        )}

        {view === 'loading' && (
          <div className={styles.loadingView}>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>AI가 데이터를 분석하고 있습니다...</p>
          </div>
        )}

        {view === 'result' && chartConfig && (
          <div className={styles.resultView}>
            <div className={styles.chartWrap}>
              {renderChart(chartConfig)}
            </div>
            <div className={styles.resultActions}>
              <button className={styles.shareBtn} onClick={handleShare}>
                채팅방에 공유
              </button>
              <button className={styles.resetBtn} onClick={handleReset}>
                다시 분석
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
