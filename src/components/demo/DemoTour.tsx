'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDemoStore } from '@/store/demoStore';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/auth';
import { cleanupDemoArtifacts } from '@/lib/demoCleanup';
import { buildDemoSteps, type DemoStep } from '@/lib/demoSteps';
import Spotlight from './Spotlight';
import styles from './DemoTour.module.css';

const FIXED_NOTE =
  '※ 이번엔 시연용 이미지·응답 등이 사용되었지만, 시연 후 실제 데이터를 이용해 직접 사용해 보실 수도 있습니다.';

function sameRect(a: DOMRect | null, b: DOMRect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

export default function DemoTour() {
  const active = useDemoStore((s) => s.active);
  const endDemo = useDemoStore((s) => s.end);
  const clearAuth = useAuthStore((s) => s.clear);
  const router = useRouter();

  const [steps] = useState<DemoStep[]>(() => buildDemoSteps());
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [closing, setClosing] = useState(false);

  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const indexRef = useRef(0);
  indexRef.current = index;

  const step = active ? steps[index] : null;

  // 시연 시작 시 첫 단계로
  useEffect(() => {
    if (active) { setIndex(0); setRect(null); setClosing(false); }
  }, [active]);

  // 단계 진입 콜백
  useEffect(() => {
    if (active && step) step.onEnter?.();
  }, [active, step]);

  // 종료(완료/중단) — 부산물 정리 후 로그아웃 → 로그인 화면
  const finish = useCallback(async () => {
    if (closing) return;
    setClosing(true);
    try { await cleanupDemoArtifacts(useDemoStore.getState().artifacts); } catch { /* ignore */ }
    try { await authService.logout(); } catch { /* ignore */ }
    clearAuth();
    endDemo();
    router.replace('/login');
  }, [closing, clearAuth, endDemo, router]);

  const advance = useCallback(() => {
    stepsRef.current[indexRef.current]?.onExit?.();
    const next = indexRef.current + 1;
    if (next >= stepsRef.current.length) { finish(); return; }
    setRect(null);
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
      const target = step.getTarget();
      const r = target ? target.getBoundingClientRect() : null;
      setRect((prev) => (sameRect(prev, r) ? prev : r));
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

  return (
    <Spotlight rect={rect}>
      <div className={styles.stepCount}>{index + 1} / {steps.length}</div>
      {step.title && <div className={styles.title}>{step.title}</div>}
      <p className={styles.text}>{step.text}</p>
      {step.fixedNote && <p className={styles.note}>{FIXED_NOTE}</p>}
      {step.mode === 'action' && (
        <p className={styles.hint}>{step.actionHint ?? '안내대로 진행해 주세요.'}</p>
      )}
      <div className={styles.actions}>
        <button className={styles.abortBtn} onClick={() => finishRef.current()} disabled={closing}>
          중단
        </button>
        {step.mode !== 'action' && (
          <button className={styles.confirmBtn} onClick={() => advanceRef.current()} disabled={closing}>
            {isLast ? '완료' : '확인'}
          </button>
        )}
      </div>
    </Spotlight>
  );
}
