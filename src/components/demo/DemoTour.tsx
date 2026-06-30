'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDemoStore } from '@/store/demoStore';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/auth';
import { demoService } from '@/services/demo';
import { buildDemoSteps, type DemoStep } from '@/lib/demoSteps';
import Spotlight from './Spotlight';
import styles from './DemoTour.module.css';

const FIXED_NOTE =
  '※ 이번엔 시연용 이미지·응답 등이 사용되었지만, 시연 후 실제 데이터를 이용해 직접 사용해 보실 수도 있습니다.';

function sameRects(a: DOMRect[], b: DOMRect[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].top !== b[i].top || a[i].left !== b[i].left || a[i].width !== b[i].width || a[i].height !== b[i].height) {
      return false;
    }
  }
  return true;
}

export default function DemoTour() {
  const active = useDemoStore((s) => s.active);
  const endDemo = useDemoStore((s) => s.end);
  const clearAuth = useAuthStore((s) => s.clear);
  const router = useRouter();

  const [steps] = useState<DemoStep[]>(() => buildDemoSteps());
  const [index, setIndex] = useState(0);
  const [rects, setRects] = useState<DOMRect[]>([]);
  const [closing, setClosing] = useState(false);

  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const indexRef = useRef(0);
  indexRef.current = index;

  const step = active ? steps[index] : null;

  // 시연 시작 시 첫 단계로
  useEffect(() => {
    if (active) { setIndex(0); setRects([]); setClosing(false); }
  }, [active]);

  // 단계 진입 콜백
  useEffect(() => {
    if (active && step) step.onEnter?.();
  }, [active, step]);

  // 종료(완료/중단) — 서버가 부산물(파일·봇 친구/DM) 정리 + 예약/online 해제. 로그아웃 전(토큰 유효)에 호출.
  const finish = useCallback(async () => {
    if (closing) return;
    setClosing(true);
    try { await demoService.release(); } catch { /* ignore */ }
    try { await authService.logout(); } catch { /* ignore */ }
    clearAuth();
    endDemo();
    router.replace('/login');
  }, [closing, clearAuth, endDemo, router]);

  // 새로고침·탭종료 등 버튼 외 경로로 떠날 때: 서버에 정리 비콘 전송(토큰 유효 시).
  // sendBeacon은 헤더를 못 실으므로 토큰을 text/plain 본문으로 보낸다(CORS 단순요청). WS 끊김 정리가 백스톱.
  useEffect(() => {
    if (!active) return;
    const handler = () => {
      const token = useAuthStore.getState().accessToken;
      if (!token) return;
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
      navigator.sendBeacon(`${base}/api/demo/release-beacon`, new Blob([token], { type: 'text/plain' }));
    };
    window.addEventListener('pagehide', handler);
    return () => window.removeEventListener('pagehide', handler);
  }, [active]);

  const advance = useCallback(() => {
    stepsRef.current[indexRef.current]?.onExit?.();
    const next = indexRef.current + 1;
    if (next >= stepsRef.current.length) { finish(); return; }
    setRects([]);
    setIndex(next);
  }, [finish]);

  // 핸들러 ref(루프/타이머에서 최신 참조)
  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  const finishRef = useRef(finish);
  finishRef.current = finish;

  // 대상 rect 추적 + action 모드 자동진행 (rAF 루프)
  useEffect(() => {
    if (!active || !step) return;
    let raf = 0;
    const tick = () => {
      // getRect가 있으면 그 사각형(들)을, 없으면 getTarget 요소의 사각형을 강조
      const raw = step.getRect ? step.getRect() : (step.getTarget()?.getBoundingClientRect() ?? null);
      const next = raw == null ? [] : (Array.isArray(raw) ? raw : [raw]);
      setRects((prev) => (sameRects(prev, next) ? prev : next));
      if (step.mode === 'action' && step.advanceWhen?.()) {
        advanceRef.current();
        return; // 다음 단계로
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, step]);

  if (!active || !step) return null;

  const isLast = index >= steps.length - 1;
  const popupAnchor = step.getPopupRect ? step.getPopupRect() : null;

  return (
    <Spotlight rects={rects} padding={step.padding} popupAnchor={popupAnchor} interactive={step.interactive ?? (step.mode === 'action')}>
      <div className={styles.stepCount}>{index + 1} / {steps.length}</div>
      {step.title && <div className={styles.title}>{step.title}</div>}
      <p className={styles.text}>{step.text}</p>
      {step.fixedNote && <p className={styles.note}>{FIXED_NOTE}</p>}
      {step.mode === 'action' && (
        <p className={styles.hint}>{step.actionHint ?? '안내대로 진행해 주세요.'}</p>
      )}
      <div className={styles.actions}>
        {/* 마지막(시연 완료) 단계에서는 중단 없이 완료만 */}
        {!isLast && (
          <button
            className={styles.abortBtn}
            onClick={() => {
              if (confirm('시연을 중단하시겠습니까?\n로그인 화면으로 돌아갑니다.')) {
                finishRef.current();
              }
            }}
            disabled={closing}
          >
            중단
          </button>
        )}
        {step.mode !== 'action' && (
          <button className={styles.confirmBtn} onClick={() => advanceRef.current()} disabled={closing}>
            {isLast ? '완료' : '확인'}
          </button>
        )}
      </div>
    </Spotlight>
  );
}
