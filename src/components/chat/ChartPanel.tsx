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
import { chartService, ChartAnalyzeResponse, ChartSharePayload } from '@/services/chart';
import { useStompClient } from '@/providers/StompProvider';
import { useDemoStore } from '@/store/demoStore';
import { DEMO_CHART_PROMPT } from '@/lib/demoFixtures';
import styles from './ChartPanel.module.css';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, RadialLinearScale, Title, Tooltip, Legend, Filler
);

type View = 'upload' | 'loading' | 'result';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderChart(config: ChartAnalyzeResponse, chartRef: React.MutableRefObject<any>) {
  const data = { labels: config.labels, datasets: config.datasets as never[] };
  const opts = { responsive: true, maintainAspectRatio: false };
  switch (config.chartType) {
    case 'line':     return <Line     ref={chartRef} data={data} options={opts} />;
    case 'pie':      return <Pie      ref={chartRef} data={data} options={opts} />;
    case 'doughnut': return <Doughnut ref={chartRef} data={data} options={opts} />;
    case 'radar':    return <Radar    ref={chartRef} data={data} options={opts} />;
    default:         return <Bar      ref={chartRef} data={data} options={opts} />;
  }
}

export default function ChartPanel({
  onClose,
  roomIdx,
  currentUserId,
  initialFile,
  onFileConsumed,
}: {
  onClose: () => void;
  roomIdx?: number | null;
  currentUserId?: string;
  initialFile?: File | null;
  onFileConsumed?: () => void;
}) {
  const client = useStompClient();
  const demoActive = useDemoStore((s) => s.active);
  const [view, setView]             = useState<View>('upload');
  const [question, setQuestion]     = useState('');
  const [tableData, setTableData]   = useState<(string | number | null)[][]>([]);
  const [fileName, setFileName]     = useState('');
  const [chartConfig, setChartConfig] = useState<ChartAnalyzeResponse | null>(null);
  // 항목4(일정이후): 현재 표시 중인 차트를 누가 만들었는지(다른 사용자가 공유한 경우만 set, 내가 만들면 null)
  const [chartAuthor, setChartAuthor] = useState<string | null>(null);
  const [error, setError]           = useState('');
  const subRef = useRef<{ unsubscribe(): void } | null>(null);
  // 차트 이미지 다운로드용 chart.js 인스턴스 ref
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  // WS 수신 시 내 분석 진행중(loading)이면 덮어쓰지 않기 위한 현재 view 추적
  const viewRef = useRef<View>('upload');
  useEffect(() => { viewRef.current = view; }, [view]);
  // 'AI 데이터 분석' 첨부로 파일을 들고 열렸으면 스냅샷이 미리보기를 덮지 않도록 표시
  const openedWithFileRef = useRef(false);
  if (initialFile) openedWithFileRef.current = true;

  /* ── 파일 파싱(첨부/드롭 공용) ── */
  const parseFile = useCallback((file: File) => {
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
  }, []);

  /* ── 항목4: 채팅방 첨부메뉴 'AI 데이터 분석'으로 넘어온 파일을 미리보기에 로드 ── */
  useEffect(() => {
    if (!initialFile) return;
    parseFile(initialFile);
    setView('upload');
    onFileConsumed?.();
  }, [initialFile, parseFile, onFileConsumed]);

  /* ── 시연: 데이터가 로드되면 분석 질문에 예시 프롬프트를 미리 채운다(수정 불가) ── */
  useEffect(() => {
    if (demoActive && tableData.length > 0) setQuestion(DEMO_CHART_PROMPT);
  }, [demoActive, tableData.length]);

  /* ── 항목4: 패널 열 때 방의 현재 공유 차트 스냅샷 로드(나중에 연 사용자도 표시) ── */
  useEffect(() => {
    if (!roomIdx) return;
    let cancelled = false;
    chartService.getShared(roomIdx)
      .then(shared => {
        if (cancelled || !shared) return;
        // 파일을 들고 열렸으면(미리보기 중) 스냅샷으로 덮지 않음
        if (openedWithFileRef.current) return;
        // 진행 중이거나 이미 차트를 보고 있으면 굳이 덮지 않음(초기 진입에서만 표시)
        if (viewRef.current !== 'upload' || tableData.length > 0) return;
        setChartConfig(shared.chartConfig);
        setChartAuthor(shared.fromUserId === currentUserId ? null : shared.fromNickname);
        setView('result');
      })
      .catch(() => { /* 스냅샷 실패 시 빈 패널 */ });
    return () => { cancelled = true; };
    // tableData는 의도적으로 deps 제외(최초 1회 스냅샷)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomIdx, currentUserId]);

  /* ── 항목4: 차트 공유 구독 — 그림판처럼 실시간 자동 반영 ── */
  useEffect(() => {
    if (!client || !roomIdx) return;
    subRef.current = client.subscribe(`/topic/chart/${roomIdx}`, frame => {
      try {
        const payload: ChartSharePayload = JSON.parse(frame.body);
        if (payload.fromUserId === currentUserId) return; // 내가 보낸 건 이미 반영됨
        if (viewRef.current === 'loading') return;          // 내 분석 진행중이면 보호
        setChartConfig(payload.chartConfig);
        setChartAuthor(payload.fromNickname);
        setView('result');
      } catch { /* ignore */ }
    });
    return () => { subRef.current?.unsubscribe(); };
  }, [client, roomIdx, currentUserId]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = '';
  }, [parseFile]);

  /* ── 차트 생성 시 그림판처럼 방 전체에 자동 공유(별도 '공유' 버튼 없음) ── */
  const publishShare = useCallback((config: ChartAnalyzeResponse) => {
    if (!client || !roomIdx) return;
    try {
      client.publish({
        destination: `/app/chart.share/${roomIdx}`,
        body: JSON.stringify({ chartConfig: config }),
      });
    } catch { /* ignore */ }
  }, [client, roomIdx]);

  const handleAnalyze = useCallback(async () => {
    if (!roomIdx || tableData.length === 0) return;
    setView('loading');
    setError('');
    try {
      const result = await chartService.analyze({ roomIdx, tableData, question: question.trim() || undefined });
      setChartConfig(result);
      setChartAuthor(null);   // 내가 만든 차트
      setView('result');
      publishShare(result);   // 방 전체 실시간 공유
    } catch {
      setError('분석에 실패했습니다. 다시 시도해주세요.');
      setView('upload');
    }
  }, [roomIdx, tableData, question, publishShare]);

  /* ── 항목4: '채팅방에 공유'를 그래프 이미지(PNG) 다운로드로 변경 ── */
  const handleDownloadImage = useCallback(() => {
    const chart = chartRef.current;
    if (!chart?.canvas) return;
    const src = chart.canvas as HTMLCanvasElement;
    // 차트 캔버스는 배경이 투명 → 흰 배경 위에 합성해 저장
    const tmp = document.createElement('canvas');
    tmp.width = src.width;
    tmp.height = src.height;
    const ctx = tmp.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(src, 0, 0);
    const a = document.createElement('a');
    a.href = tmp.toDataURL('image/png');
    a.download = `chart-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const handleReset = useCallback(() => {
    setView('upload');
    setTableData([]);
    setFileName('');
    setQuestion('');
    setChartConfig(null);
    setChartAuthor(null);
    setError('');
  }, []);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>엑셀 데이터 시각화</span>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div className={styles.body}>
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
                  readOnly={demoActive}
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
            {chartAuthor && (
              <div className={styles.authorLabel}>
                <span className={styles.authorNick}>{chartAuthor}</span>님이 공유한 차트
              </div>
            )}
            <div className={styles.chartWrap}>
              {renderChart(chartConfig, chartRef)}
            </div>
            <div className={styles.resultActions}>
              <button className={styles.shareBtn} onClick={handleDownloadImage}>
                이미지로 다운로드
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
