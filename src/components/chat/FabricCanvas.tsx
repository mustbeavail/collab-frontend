'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './FabricCanvas.module.css';

type Tool = 'pencil' | 'eraser' | 'line' | 'rect' | 'ellipse';

const BG = '#ffffff';
const PALETTE = ['#000000', '#1d4ed8', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#7c3aed', '#db2777', '#64748b'];

export default function FabricCanvas() {
  const canvasElRef  = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fbRef        = useRef<any>(null);
  const historyRef   = useRef<object[]>([]);
  const shapeRef     = useRef<any>(null);
  const drawingRef   = useRef(false);
  const startRef     = useRef({ x: 0, y: 0 });

  const [tool,  setTool]  = useState<Tool>('pencil');
  const [size,  setSize]  = useState(4);
  const [color, setColor] = useState('#000000');

  // 이벤트 핸들러가 항상 최신 값을 참조하도록 ref 유지
  const toolRef  = useRef(tool);
  const sizeRef  = useRef(size);
  const colorRef = useRef(color);
  useEffect(() => { toolRef.current  = tool;  }, [tool]);
  useEffect(() => { sizeRef.current  = size;  }, [size]);
  useEffect(() => { colorRef.current = color; }, [color]);

  const saveHistory = useCallback(() => {
    const fb = fbRef.current;
    if (!fb) return;
    historyRef.current.push(fb.toJSON());
    if (historyRef.current.length > 50) historyRef.current.shift();
  }, []);

  /* ── 캔버스 초기화 + 도형 이벤트 등록 (한 번만) ── */
  useEffect(() => {
    if (!canvasElRef.current || !containerRef.current) return;
    let alive = true;

    (async () => {
      const { Canvas, PencilBrush, Rect, Ellipse, Line } = await import('fabric');
      if (!alive) return;

      const w = containerRef.current!.clientWidth;
      const h = containerRef.current!.clientHeight;

      const fb = new Canvas(canvasElRef.current!, {
        isDrawingMode: true,
        backgroundColor: BG,
        width: w, height: h,
        selection: false,
      });

      const brush = new PencilBrush(fb);
      brush.color = colorRef.current;
      brush.width = sizeRef.current;
      fb.freeDrawingBrush = brush;

      fbRef.current = fb;
      historyRef.current = [fb.toJSON()];

      // 펜 자유곡선 완성 시 히스토리 저장
      fb.on('path:created', saveHistory);

      // ─── 도형 그리기 이벤트 (ref로 현재 값 참조) ───
      fb.on('mouse:down', (opt: any) => {
        const t = toolRef.current;
        if (t === 'pencil' || t === 'eraser') return;

        // Fabric v7: opt.pointer가 캔버스 좌표
        const ptr = opt.pointer;
        if (!ptr) return;

        startRef.current = { x: ptr.x, y: ptr.y };
        drawingRef.current = true;

        const base = {
          left: ptr.x, top: ptr.y,
          stroke: colorRef.current,
          strokeWidth: sizeRef.current,
          fill: 'transparent',
          selectable: false,
          evented: false,
          strokeUniform: true,
        };

        let s: any = null;
        if (t === 'rect')    s = new Rect({ ...base, width: 0, height: 0 });
        if (t === 'ellipse') s = new Ellipse({ ...base, rx: 0, ry: 0 });
        if (t === 'line')    s = new Line([ptr.x, ptr.y, ptr.x, ptr.y], {
          stroke: colorRef.current,
          strokeWidth: sizeRef.current,
          selectable: false,
          evented: false,
          strokeUniform: true,
        });

        if (s) { fb.add(s); shapeRef.current = s; }
      });

      fb.on('mouse:move', (opt: any) => {
        if (!drawingRef.current || !shapeRef.current) return;
        const ptr = opt.pointer;
        if (!ptr) return;

        const { x: sx, y: sy } = startRef.current;
        const s = shapeRef.current;
        const t = toolRef.current;

        if (t === 'rect') {
          s.set({
            left:   Math.min(ptr.x, sx),
            top:    Math.min(ptr.y, sy),
            width:  Math.abs(ptr.x - sx),
            height: Math.abs(ptr.y - sy),
          });
        } else if (t === 'ellipse') {
          s.set({
            left: Math.min(ptr.x, sx),
            top:  Math.min(ptr.y, sy),
            rx:   Math.abs(ptr.x - sx) / 2,
            ry:   Math.abs(ptr.y - sy) / 2,
          });
        } else if (t === 'line') {
          s.set({ x2: ptr.x, y2: ptr.y });
        }

        fb.requestRenderAll();
      });

      fb.on('mouse:up', () => {
        if (!drawingRef.current) return;
        drawingRef.current = false;
        if (shapeRef.current) {
          shapeRef.current.set({ selectable: false, evented: false });
          shapeRef.current = null;
          saveHistory();
        }
      });
    })();

    return () => {
      alive = false;
      fbRef.current?.dispose();
      fbRef.current = null;
    };
  }, [saveHistory]);

  /* ── 리사이즈 → 좌표 재보정 ── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const fb = fbRef.current;
      if (!fb) return;
      fb.setDimensions({ width: el.clientWidth, height: el.clientHeight });
      fb.requestRenderAll();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── 도구 / 크기 / 색상 변경 → 브러시 갱신 ── */
  useEffect(() => {
    const fb = fbRef.current;
    if (!fb) return;
    (async () => {
      const { PencilBrush } = await import('fabric');
      if (tool === 'pencil' || tool === 'eraser') {
        fb.isDrawingMode = true;
        const b = new PencilBrush(fb);
        b.color = tool === 'eraser' ? BG : color;
        b.width = size;
        fb.freeDrawingBrush = b;
      } else {
        fb.isDrawingMode = false;
      }
    })();
  }, [tool, size, color]);

  /* ── 실행 취소 ── */
  const undo = useCallback(async () => {
    const fb = fbRef.current;
    if (!fb || historyRef.current.length <= 1) return;
    historyRef.current.pop();
    const prev = historyRef.current[historyRef.current.length - 1];
    await fb.loadFromJSON(prev);
    fb.requestRenderAll();
  }, []);

  /* ── 전체 지우기 ── */
  const clearAll = useCallback(() => {
    const fb = fbRef.current;
    if (!fb) return;
    fb.clear();
    fb.backgroundColor = BG;
    fb.requestRenderAll();
    historyRef.current = [fb.toJSON()];
  }, []);

  /* ── 도구 목록 ── */
  const TOOLS: { id: Tool; label: string; icon: React.ReactNode }[] = [
    { id: 'pencil', label: '펜',
      icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg> },
    { id: 'eraser', label: '지우개',
      icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L17.5 6.5a2.121 2.121 0 013 3L9 21H6v-3z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18"/></svg> },
    { id: 'line', label: '선',
      icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="4" strokeWidth={2} strokeLinecap="round"/></svg> },
    { id: 'rect', label: '사각형',
      icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2}/></svg> },
    { id: 'ellipse', label: '원',
      icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="9" ry="6" strokeWidth={2}/></svg> },
  ];

  const showSize   = true;
  const showColors = tool !== 'eraser';

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        {/* 도구 버튼 */}
        <div className={styles.group}>
          {TOOLS.map(t => (
            <button
              key={t.id}
              className={`${styles.toolBtn} ${tool === t.id ? styles.toolBtnActive : ''}`}
              onClick={() => setTool(t.id)}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div className={styles.sep} />

        {/* 크기 슬라이더 */}
        {showSize && (
          <>
            <div className={styles.group}>
              <span className={styles.sizeLabel}>{size}px</span>
              <input
                type="range"
                min={1} max={tool === 'eraser' ? 60 : 40}
                value={size}
                onChange={e => setSize(Number(e.target.value))}
                className={styles.slider}
              />
            </div>
            <div className={styles.sep} />
          </>
        )}

        {/* 색상 팔레트 */}
        {showColors && (
          <>
            <div className={styles.group}>
              {PALETTE.map(c => (
                <button
                  key={c}
                  className={`${styles.colorDot} ${color === c ? styles.colorDotActive : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  title={c}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className={styles.colorPicker}
                title="직접 선택"
              />
            </div>
            <div className={styles.sep} />
          </>
        )}

        {/* 액션 */}
        <div className={styles.group}>
          <button className={styles.actionBtn} onClick={undo} title="실행 취소">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
            </svg>
          </button>
          <button className={`${styles.actionBtn} ${styles.clearBtn}`} onClick={clearAll} title="전체 지우기">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>

      <div ref={containerRef} className={styles.canvasWrap}>
        <canvas ref={canvasElRef} />
      </div>
    </div>
  );
}
