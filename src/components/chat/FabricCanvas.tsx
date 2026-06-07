'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line, Rect, Ellipse } from 'react-konva';
import styles from './FabricCanvas.module.css';
import { useStompClient } from '@/providers/StompProvider';
import { useAuthStore } from '@/store/authStore';

type Tool = 'pencil' | 'eraser' | 'line' | 'rect' | 'ellipse';

type PencilEl  = { id: string; type: 'pencil' | 'eraser'; points: number[]; color: string; size: number };
type LineEl    = { id: string; type: 'line';    points: number[]; color: string; size: number };
type RectEl    = { id: string; type: 'rect';    x: number; y: number; w: number; h: number; color: string; size: number };
type EllipseEl = { id: string; type: 'ellipse'; cx: number; cy: number; rx: number; ry: number; color: string; size: number };
type DrawEl    = PencilEl | LineEl | RectEl | EllipseEl;

type DrawEventPayload = {
  eventType: 'DRAW_MOVE' | 'DRAW_DONE' | 'DRAW_CLEAR' | 'DRAW_UNDO';
  userId: string;
  nickname: string;
  element?: DrawEl | null;
  elementId?: string;
};

const PALETTE = ['#000000', '#1d4ed8', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#7c3aed', '#db2777', '#64748b'];
const THROTTLE_MS = 30;

let _id = 0;
const uid = () => String(++_id);

function renderEl(el: DrawEl) {
  switch (el.type) {
    case 'pencil':
      return <Line key={el.id} points={el.points} stroke={el.color} strokeWidth={el.size} lineCap="round" lineJoin="round" tension={0.5} listening={false} />;
    case 'eraser':
      return (
        <Line
          key={el.id}
          points={el.points}
          stroke="rgba(0,0,0,1)"
          strokeWidth={el.size}
          lineCap="round"
          lineJoin="round"
          // @ts-ignore — Konva에서 지원하는 속성
          globalCompositeOperation="destination-out"
          listening={false}
        />
      );
    case 'line':
      return <Line key={el.id} points={el.points} stroke={el.color} strokeWidth={el.size} lineCap="round" listening={false} />;
    case 'rect':
      return <Rect key={el.id} x={el.x} y={el.y} width={el.w} height={el.h} stroke={el.color} strokeWidth={el.size} fill="transparent" listening={false} />;
    case 'ellipse':
      return <Ellipse key={el.id} x={el.cx} y={el.cy} radiusX={Math.max(el.rx, 0)} radiusY={Math.max(el.ry, 0)} stroke={el.color} strokeWidth={el.size} fill="transparent" listening={false} />;
  }
}

interface Props {
  roomIdx?: number | null;
}

export default function FabricCanvas({ roomIdx }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef     = useRef<any>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  const stompClient     = useStompClient();
  const currentUserId   = useAuthStore((s) => s.user?.userId) ?? '';
  const currentNickname = useAuthStore((s) => s.user?.nickname) ?? '';

  const [tool,  setTool]  = useState<Tool>('pencil');
  const [size,  setSize]  = useState(4);
  const [color, setColor] = useState('#000000');

  // 모든 사용자 공유 요소 (완성된 것만)
  const [elements, setElements] = useState<DrawEl[]>([]);
  // 내 진행 중 요소
  const [currentState, setCurrentState] = useState<DrawEl | null>(null);
  // 원격 사용자 진행 중 요소 (live preview)
  const [remoteInProgress, setRemoteInProgress] = useState<Map<string, DrawEl>>(new Map());

  // 내가 추가한 elementId 스택 — undo 시 마지막 것 제거
  const myElementIdsRef = useRef<string[]>([]);
  const currentRef      = useRef<DrawEl | null>(null);
  const isDrawing       = useRef(false);
  const startPos        = useRef({ x: 0, y: 0 });
  const lastSentRef     = useRef(0);

  const toolRef  = useRef(tool);
  const sizeRef  = useRef(size);
  const colorRef = useRef(color);
  useEffect(() => { toolRef.current  = tool;  }, [tool]);
  useEffect(() => { sizeRef.current  = size;  }, [size]);
  useEffect(() => { colorRef.current = color; }, [color]);

  const setCurrent = useCallback((el: DrawEl | null) => {
    currentRef.current = el;
    setCurrentState(el);
  }, []);

  /* ── 컨테이너 크기 감지 ── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setStageSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setStageSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  /* ── WebSocket 구독 ── */
  useEffect(() => {
    if (!stompClient || !roomIdx) return;

    const sub = stompClient.subscribe(`/topic/draw/${roomIdx}`, (frame) => {
      const payload: DrawEventPayload = JSON.parse(frame.body);
      // 내 이벤트는 이미 낙관적으로 적용했으므로 스킵
      if (payload.userId === currentUserId) return;

      if (payload.eventType === 'DRAW_MOVE' && payload.element) {
        setRemoteInProgress(prev => new Map(prev).set(payload.userId, payload.element!));
      } else if (payload.eventType === 'DRAW_DONE' && payload.element) {
        setRemoteInProgress(prev => {
          const next = new Map(prev);
          next.delete(payload.userId);
          return next;
        });
        setElements(prev => [...prev, payload.element!]);
      } else if (payload.eventType === 'DRAW_CLEAR') {
        setElements([]);
        setRemoteInProgress(new Map());
      } else if (payload.eventType === 'DRAW_UNDO' && payload.elementId) {
        setElements(prev => prev.filter(e => e.id !== payload.elementId));
      }
    });

    return () => sub.unsubscribe();
  }, [stompClient, roomIdx, currentUserId]);

  /* ── 이벤트 발행 ── */
  const publishEvent = useCallback((
    eventType: string,
    element: DrawEl | null,
    elementId?: string,
  ) => {
    if (!stompClient || !roomIdx || !currentUserId) return;
    stompClient.publish({
      destination: `/app/draw.event/${roomIdx}`,
      body: JSON.stringify({ eventType, userId: currentUserId, nickname: currentNickname, element, elementId }),
    });
  }, [stompClient, roomIdx, currentUserId, currentNickname]);

  const getPos = () => stageRef.current?.getPointerPosition() ?? null;

  /* ── 마우스 이벤트 ── */
  const handleMouseDown = useCallback(() => {
    const pos = getPos();
    if (!pos) return;

    isDrawing.current = true;
    startPos.current  = { x: pos.x, y: pos.y };

    const t = toolRef.current;
    const s = sizeRef.current;
    const c = colorRef.current;

    if (t === 'pencil' || t === 'eraser') {
      setCurrent({ id: uid(), type: t, points: [pos.x, pos.y, pos.x, pos.y], color: c, size: s });
    } else if (t === 'line') {
      setCurrent({ id: uid(), type: 'line', points: [pos.x, pos.y, pos.x, pos.y], color: c, size: s });
    } else if (t === 'rect') {
      setCurrent({ id: uid(), type: 'rect', x: pos.x, y: pos.y, w: 0, h: 0, color: c, size: s });
    } else if (t === 'ellipse') {
      setCurrent({ id: uid(), type: 'ellipse', cx: pos.x, cy: pos.y, rx: 0, ry: 0, color: c, size: s });
    }
  }, [setCurrent]);

  const handleMouseMove = useCallback(() => {
    if (!isDrawing.current) return;
    const pos = getPos();
    if (!pos || !currentRef.current) return;

    const el = currentRef.current;
    const { x: sx, y: sy } = startPos.current;
    let updated: DrawEl;

    switch (el.type) {
      case 'pencil':
      case 'eraser':
        updated = { ...el, points: [...el.points, pos.x, pos.y] };
        break;
      case 'line':
        updated = { ...el, points: [sx, sy, pos.x, pos.y] };
        break;
      case 'rect':
        updated = {
          ...el,
          x: Math.min(sx, pos.x),
          y: Math.min(sy, pos.y),
          w: Math.abs(pos.x - sx),
          h: Math.abs(pos.y - sy),
        };
        break;
      case 'ellipse':
        updated = {
          ...el,
          cx: (sx + pos.x) / 2,
          cy: (sy + pos.y) / 2,
          rx: Math.abs(pos.x - sx) / 2,
          ry: Math.abs(pos.y - sy) / 2,
        };
        break;
      default:
        return;
    }

    setCurrent(updated);

    const now = Date.now();
    if (now - lastSentRef.current >= THROTTLE_MS) {
      lastSentRef.current = now;
      publishEvent('DRAW_MOVE', updated);
    }
  }, [setCurrent, publishEvent]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    const el = currentRef.current;
    if (el) {
      // 낙관적 적용
      setElements(prev => [...prev, el]);
      myElementIdsRef.current.push(el.id);
      publishEvent('DRAW_DONE', el);
    }
    setCurrent(null);
  }, [setCurrent, publishEvent]);

  /* ── 실행 취소 — 내 마지막 요소를 공유 캔버스에서 제거, 상대에게도 브로드캐스트 ── */
  const undo = useCallback(() => {
    const lastId = myElementIdsRef.current.pop();
    if (!lastId) return;
    setElements(prev => prev.filter(e => e.id !== lastId));
    publishEvent('DRAW_UNDO', null, lastId);
  }, [publishEvent]);

  /* ── 전체 지우기 — 공유 캔버스 전체 초기화 ── */
  const clearAll = useCallback(() => {
    setElements([]);
    setRemoteInProgress(new Map());
    setCurrent(null);
    myElementIdsRef.current = [];
    publishEvent('DRAW_CLEAR', null);
  }, [setCurrent, publishEvent]);

  /* ── PNG 저장 ── */
  const saveAsPng = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const dataUrl = stage.toDataURL({ mimeType: 'image/png', pixelRatio: 2 });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `drawing-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

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

  const showColors = tool !== 'eraser';
  const cursor = tool === 'eraser' ? 'cell' : 'crosshair';

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
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

        {showColors && (
          <>
            <div className={styles.sep} />
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
          </>
        )}

        <div className={styles.sep} />

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
          <button className={styles.actionBtn} onClick={saveAsPng} title="PNG로 저장">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
          </button>
        </div>
      </div>

      <div ref={containerRef} className={styles.canvasWrap}>
        {stageSize.w > 0 && (
          <Stage
            ref={stageRef}
            width={stageSize.w}
            height={stageSize.h}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor }}
          >
            {/* 배경 레이어 — PNG 내보내기 시 흰 배경 보장 */}
            <Layer listening={false}>
              <Rect x={0} y={0} width={stageSize.w} height={stageSize.h} fill="#ffffff" />
            </Layer>
            {/* 공유 드로잉 레이어 — 모든 사용자 요소가 하나의 레이어에서 렌더링
                eraser(destination-out)가 같은 레이어 내 모든 이전 요소를 지움 */}
            <Layer>
              {elements.map(renderEl)}
              {Array.from(remoteInProgress.values()).map(renderEl)}
              {currentState && renderEl(currentState)}
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  );
}
