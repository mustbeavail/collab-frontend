'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './Spotlight.module.css';

interface Props {
  rects: DOMRect[];   // 강조할 영역들(여러 개 가능 = 여러 구멍). 비면 화면 중앙 팝업
  padding?: number;
  // false면 강조 영역도 클릭 불가(설명 단계). 진행은 팝업 [확인]으로만 → 시나리오 이탈 방지.
  interactive?: boolean;
  // 안내 팝업 배치 기준(강조영역과 분리). 없으면 강조영역(holes) 기준으로 배치.
  popupAnchor?: DOMRect | null;
  children: React.ReactNode; // 팝업 내용(문구 + 버튼)
}

const POPUP_MAX_W = 340;
const POPUP_MIN_W = 260;

interface Hole { top: number; left: number; width: number; height: number; }

/**
 * 스포트라이트 오버레이: 지정한 영역(들)만 남기고 화면 전체를 어둡게 덮는다.
 * SVG 마스크로 구멍을 여러 개 뚫을 수 있어, "채팅 영역 + 보내기 버튼"처럼 떨어진 두 영역을
 * 동시에(사이의 입력란은 제외하고) 강조할 수 있다. 구멍은 클릭 통과, 딤은 클릭 차단.
 * 안내 팝업은 강조 영역과 겹치지 않도록 아래/위/옆 중 들어갈 곳을 골라 배치하고, 항상 화면 안에 둔다.
 */
export default function Spotlight({ rects, padding = 8, interactive = true, popupAnchor = null, children }: Props) {
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupH, setPopupH] = useState(180);

  useEffect(() => {
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (popupRef.current) setPopupH(popupRef.current.offsetHeight);
  });

  if (vp.w === 0) return null; // 마운트 전(SSR 안전)

  // 대상 없으면 전체 딤 + 중앙 팝업
  if (rects.length === 0) {
    const w = Math.min(POPUP_MAX_W, vp.w - 24);
    return (
      <div className={styles.root}>
        <div className={styles.fullDim} />
        <div
          className={styles.popup}
          style={{ width: w, left: (vp.w - w) / 2, top: Math.max(12, (vp.h - popupH) / 2) }}
          ref={popupRef}
        >
          {children}
        </div>
      </div>
    );
  }

  // 패딩 적용 + 화면 안으로 클램프한 구멍들
  const holes: Hole[] = rects.map((r) => {
    const top = Math.max(0, r.top - padding);
    const left = Math.max(0, r.left - padding);
    const right = Math.min(vp.w, r.right + padding);
    const bottom = Math.min(vp.h, r.bottom + padding);
    return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
  });

  // 팝업 배치 기준: popupAnchor가 있으면 그 사각형, 없으면 모든 구멍의 합집합
  const uTop = popupAnchor ? popupAnchor.top : Math.min(...holes.map((h) => h.top));
  const uBottom = popupAnchor ? popupAnchor.bottom : Math.max(...holes.map((h) => h.top + h.height));
  const uLeft = popupAnchor ? popupAnchor.left : Math.min(...holes.map((h) => h.left));
  const uRight = popupAnchor ? popupAnchor.right : Math.max(...holes.map((h) => h.left + h.width));

  // 팝업 배치: 강조 영역과 겹치지 않게 아래→위→오른쪽→왼쪽 순으로 들어갈 곳을 고른다.
  // 위/아래는 가로 폭이 넉넉하므로 최대 폭, 좌/우는 그쪽 여백에 맞춰 폭을 줄인다(작은 화면에서 채팅 영역을 안 덮도록).
  // 어디에도 못 넣으면 여백이 가장 큰 쪽에 최소 폭으로 두고 화면 안에 클램프(불가피하면 일부 겹침 허용).
  const gap = 12;
  const belowSpace = vp.h - uBottom;
  const aboveSpace = uTop;
  const rightSpace = vp.w - uRight;
  const leftSpace = uLeft;

  let popupW = POPUP_MAX_W;
  let popupTop: number;
  let popupLeft: number;
  const clampX = (x: number, w: number) => Math.min(Math.max(gap, x), vp.w - w - gap);
  const clampY = (y: number) => Math.min(Math.max(gap, y), vp.h - popupH - gap);

  if (belowSpace >= popupH + gap * 2) {
    popupW = Math.min(POPUP_MAX_W, vp.w - gap * 2);
    popupTop = uBottom + gap;
    popupLeft = clampX(uLeft, popupW);
  } else if (aboveSpace >= popupH + gap * 2) {
    popupW = Math.min(POPUP_MAX_W, vp.w - gap * 2);
    popupTop = uTop - gap - popupH;
    popupLeft = clampX(uLeft, popupW);
  } else if (rightSpace - gap * 2 >= POPUP_MIN_W) {
    popupW = Math.min(POPUP_MAX_W, rightSpace - gap * 2);
    popupTop = clampY(uTop);
    popupLeft = uRight + gap;
  } else if (leftSpace - gap * 2 >= POPUP_MIN_W) {
    popupW = Math.min(POPUP_MAX_W, leftSpace - gap * 2);
    popupTop = clampY(uTop);
    popupLeft = uLeft - gap - popupW;
  } else {
    // 어디에도 충분치 않음 → 여백 최대인 쪽에 최소 폭으로(부득이 일부 겹침)
    popupW = POPUP_MIN_W;
    const maxSide = Math.max(belowSpace, aboveSpace, rightSpace, leftSpace);
    if (maxSide === belowSpace) { popupTop = clampY(vp.h - popupH); popupLeft = clampX(uLeft, popupW); }
    else if (maxSide === aboveSpace) { popupTop = clampY(0); popupLeft = clampX(uLeft, popupW); }
    else if (maxSide === rightSpace) { popupTop = clampY(uTop); popupLeft = clampX(vp.w - popupW, popupW); }
    else { popupTop = clampY(uTop); popupLeft = clampX(0, popupW); }
  }

  // clip-path(evenodd)로 구멍을 실제로 도려낸 딤 → 구멍 영역은 클릭이 통과(마스크와 달리 hit-test에 반영됨)
  const clipPath =
    `path(evenodd, "M0 0H${vp.w}V${vp.h}H0Z` +
    holes.map((h) => `M${h.left} ${h.top}H${h.left + h.width}V${h.top + h.height}H${h.left}Z`).join('') +
    `")`;

  return (
    <div className={styles.root}>
      {/* 구멍 뚫린 딤(딤=클릭 차단, 구멍=클릭 통과) */}
      <div className={styles.dim} style={{ clipPath, WebkitClipPath: clipPath }} />
      {/* 강조 테두리(구멍마다) */}
      {holes.map((h, i) => (
        <div key={i} className={styles.highlight} style={{ top: h.top, left: h.left, width: h.width, height: h.height }} />
      ))}
      {/* 설명(확인) 단계: 강조 영역도 클릭 막기 — 진행은 팝업 [확인]으로만(시나리오 이탈 방지) */}
      {!interactive && <div className={styles.clickBlocker} />}
      {/* 팝업 */}
      <div className={styles.popup} style={{ width: popupW, top: popupTop, left: popupLeft }} ref={popupRef}>
        {children}
      </div>
    </div>
  );
}
