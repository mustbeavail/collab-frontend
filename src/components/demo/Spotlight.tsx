'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './Spotlight.module.css';

interface Props {
  rect: DOMRect | null;   // 강조할 대상의 viewport 좌표(없으면 화면 중앙 팝업)
  padding?: number;
  children: React.ReactNode; // 팝업 내용(문구 + 버튼)
}

const POPUP_WIDTH = 340;

/**
 * 스포트라이트 오버레이: 대상 영역만 남기고 화면 전체를 어둡게 덮는다.
 * 4개의 딤 사각형(상/하/좌/우)으로 구성해 가운데 '구멍'은 비워두므로,
 * 강조된 대상은 그대로 클릭 가능하고 나머지 영역 클릭은 막힌다.
 */
export default function Spotlight({ rect, padding = 8, children }: Props) {
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
  if (!rect) {
    return (
      <div className={styles.root}>
        <div className={styles.fullDim} />
        <div
          className={styles.popup}
          style={{ width: POPUP_WIDTH, left: (vp.w - POPUP_WIDTH) / 2, top: Math.max(12, (vp.h - popupH) / 2) }}
          ref={popupRef}
        >
          {children}
        </div>
      </div>
    );
  }

  const hole = {
    top: Math.max(0, rect.top - padding),
    left: Math.max(0, rect.left - padding),
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
  const holeBottom = hole.top + hole.height;
  const holeRight = hole.left + hole.width;

  // 팝업 위치: 아래 공간 있으면 아래, 없으면 위. 가로는 대상 왼쪽 정렬 후 화면 안으로 클램프.
  const gap = 12;
  const placeBelow = holeBottom + gap + popupH <= vp.h;
  const popupTop = placeBelow ? holeBottom + gap : Math.max(gap, hole.top - gap - popupH);
  const popupLeft = Math.min(Math.max(gap, hole.left), vp.w - POPUP_WIDTH - gap);

  return (
    <div className={styles.root}>
      {/* 4분할 딤(구멍은 비움 → 대상 클릭 통과, 나머지 클릭 차단) */}
      <div className={styles.mask} style={{ top: 0, left: 0, width: vp.w, height: hole.top }} />
      <div className={styles.mask} style={{ top: holeBottom, left: 0, width: vp.w, height: Math.max(0, vp.h - holeBottom) }} />
      <div className={styles.mask} style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }} />
      <div className={styles.mask} style={{ top: hole.top, left: holeRight, width: Math.max(0, vp.w - holeRight), height: hole.height }} />
      {/* 강조 테두리 */}
      <div className={styles.highlight} style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }} />
      {/* 팝업 */}
      <div className={styles.popup} style={{ width: POPUP_WIDTH, top: popupTop, left: popupLeft }} ref={popupRef}>
        {children}
      </div>
    </div>
  );
}
