'use client';

import { create } from 'zustand';

/**
 * 기능 시연 상태. 시연 중 만든 부산물 정리는 전부 백엔드가 담당한다(서버 일원화):
 * - 파일: 업로드 시 서버가 시연 세션에 등록 → 종료 시 일괄 삭제
 * - 봇 친구/DM: 종료 시 서버가 정리
 * 종료 트리거: 중단/완료(POST /api/demo/release) · 새로고침/탭종료(release-beacon) · 크래시(WS 끊김).
 * 따라서 프론트는 아티팩트를 추적하지 않고, 데모-고정(번역/차트/봇응답) 게이트로 active만 쓴다.
 */
interface DemoState {
  active: boolean;
  start: () => void;
  end: () => void;
}

// 비영속(persist 안 함) — 새로고침/탭종료 시 시연은 끝난 것으로 본다(서버가 WS 끊김으로 정리).
export const useDemoStore = create<DemoState>((set) => ({
  active: false,
  start: () => set({ active: true }),
  end: () => set({ active: false }),
}));
