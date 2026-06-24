'use client';

import { create } from 'zustand';

/** 시연 중 만든 부산물(종료/중단 시 정리 대상). 시연 중 생성한 것만 추적해 기존 데이터는 안 건드림. */
export interface DemoArtifacts {
  friendIdx: number | null;   // 챗봇 친구관계
  dmRoomIdx: number | null;   // 챗봇 DM 방
  scheduleIdx: number | null; // 데모 일정
  teamIdx: number | null;     // 데모 팀
  fileIdxs: number[];         // 데모 첨부 파일
}

const emptyArtifacts = (): DemoArtifacts => ({
  friendIdx: null, dmRoomIdx: null, scheduleIdx: null, teamIdx: null, fileIdxs: [],
});

interface DemoState {
  active: boolean;          // 시연 진행중 여부 — 데모-고정(번역/차트/회의록/봇응답) 게이트로도 사용
  artifacts: DemoArtifacts;
  start: () => void;
  end: () => void;
  setArtifact: (patch: Partial<DemoArtifacts>) => void;
  addFileIdx: (fileIdx: number) => void;
}

// 비영속(persist 안 함) — 새로고침/탭종료 시 시연은 끝난 것으로 본다.
export const useDemoStore = create<DemoState>((set) => ({
  active: false,
  artifacts: emptyArtifacts(),
  start: () => set({ active: true, artifacts: emptyArtifacts() }),
  end: () => set({ active: false, artifacts: emptyArtifacts() }),
  setArtifact: (patch) => set((s) => ({ artifacts: { ...s.artifacts, ...patch } })),
  addFileIdx: (fileIdx) => set((s) => ({ artifacts: { ...s.artifacts, fileIdxs: [...s.artifacts.fileIdxs, fileIdx] } })),
}));
