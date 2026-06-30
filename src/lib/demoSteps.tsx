// 기능 시연 단계 정의. 대상은 런타임 DOM getter로 찾는다(컴포넌트 수정 최소화).
// Phase 1: 좌측 메뉴·헤더 소개. Phase 2: 챗봇 친구수락·대화·번역. 이후 Phase 3~4에서 확장.

import type { ReactNode } from 'react';
import { testbotService } from '@/services/testbot';
import { useNotificationStore } from '@/store/notificationStore';
import { useFriendStore } from '@/store/friendStore';
import { TranslateButtonGlyph } from '@/components/chat/TranslateIcon';
import {
  DEMO_BOT_ID, DEMO_BOT_NICK, DEMO_PROMPT_FEATURES_KO, DEMO_PROMPT_FEATURES_EN,
} from '@/lib/demoFixtures';

export type StepMode = 'confirm' | 'action';

export interface DemoStep {
  id: string;
  getTarget: () => HTMLElement | null; // null → 화면 중앙 팝업
  getRect?: () => DOMRect | DOMRect[] | null; // 있으면 getTarget 대신 이 사각형(들)을 강조(구멍 여러 개 가능)
  getPopupRect?: () => DOMRect | null; // 안내 팝업 배치 기준(강조영역과 분리하고 싶을 때). 없으면 강조영역 기준
  padding?: number;       // 강조 구멍 여백(기본 8). 작은 헤더 버튼은 옆 버튼 안 물리게 줄임
  interactive?: boolean;  // confirm이라도 강조영역 클릭 허용(예: 그림판에서 실제로 그려보기)
  title?: string;
  text: ReactNode;
  mode?: StepMode;        // 기본 'confirm'(확인 버튼으로 진행)
  actionHint?: ReactNode; // action 모드 하단 안내
  fixedNote?: boolean;    // 규칙3 데모 안내 표시
  onEnter?: () => void;
  onExit?: () => void;
  advanceWhen?: () => boolean; // action 모드 자동진행 조건
}

// ── DOM getter 헬퍼 ──────────────────────────────────────────
const el = <T extends HTMLElement = HTMLElement>(sel: string): T | null =>
  document.querySelector<T>(sel);

const byTextExact = (sel: string, text: string): HTMLElement | null =>
  ([...document.querySelectorAll<HTMLElement>(sel)]
    .find((e) => e.textContent?.trim() === text)) ?? null;

const buttonByText = (text: string): HTMLElement | null =>
  ([...document.querySelectorAll<HTMLElement>('button')]
    .find((b) => b.textContent?.includes(text))) ?? null;

/** 사이드바 섹션 헤더(팀/채팅방/친구/일정) 버튼 */
const sidebarSection = (label: string): HTMLElement | null =>
  (byTextExact('[class*="sectionLabel"]', label)?.closest('button') as HTMLElement) ?? null;

// ── Phase 2 헬퍼 ──────────────────────────────────────────
const setReactValue = (input: HTMLTextAreaElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const botDmTextarea = (): HTMLTextAreaElement | null =>
  ([...document.querySelectorAll('textarea')]
    .find((t) => (t.placeholder ?? '').includes(DEMO_BOT_NICK)) as HTMLTextAreaElement) ?? null;
const botDmSendBtn = (): HTMLElement | null => {
  const ta = botDmTextarea();
  if (!ta) return null;
  let p: HTMLElement | null = ta.parentElement;
  while (p && !p.querySelector('[class*="sendBtn"]')) p = p.parentElement;
  return (p?.querySelector('[class*="sendBtn"]') as HTMLElement) ?? null;
};
/** 채팅 내역 영역(헤더·입력란 제외)의 사각형. */
const botChatAreaRect = (): DOMRect | null => {
  const win = botDmTextarea()?.closest('[class*="window"]');
  const listWrap = win?.querySelector('[class*="listWrap"]') as HTMLElement | null;
  return listWrap ? listWrap.getBoundingClientRect() : null;
};
/** 채팅 내역 + 보내기 버튼만 강조(사이의 입력란은 제외) — 구멍 2개. */
const botChatAndSendRects = (): DOMRect[] => {
  const area = botChatAreaRect();
  const send = botDmSendBtn();
  return [area, send ? send.getBoundingClientRect() : null].filter((r): r is DOMRect => !!r);
};
const botFriendRequest = () =>
  useNotificationStore.getState().pendingRequests.find((r) => r.userId === DEMO_BOT_ID);
const isBotFriend = () =>
  useFriendStore.getState().friends.some((f) => f.userId === DEMO_BOT_ID);
const chatHasText = (snippet: string) => document.body.innerText.includes(snippet);
const bubbleByContent = (snippet: string): HTMLElement | null =>
  ([...document.querySelectorAll<HTMLElement>('[class*="bubbleWrap"]')]
    .find((b) => b.querySelector('[class*="__content"]')?.textContent?.includes(snippet))) ?? null;
const translateBtnOf = (bubble: HTMLElement | null): HTMLElement | null =>
  (bubble?.querySelector('button[data-translate-btn]') as HTMLElement) ?? null;
const langMenuItem = (label: string): HTMLElement | null => {
  const menu = document.querySelector('[data-translate-menu]');
  return ([...(menu?.querySelectorAll<HTMLElement>('button') ?? [])]
    .find((b) => b.textContent?.includes(label))) ?? null;
};
/** 알림 드롭다운이 열렸을 때 봇 친구요청 항목의 '수락' 버튼(없으면 null) */
const botAcceptButton = (): HTMLElement | null => {
  for (const item of [...document.querySelectorAll<HTMLElement>('[class*="item"]')]) {
    if (item.textContent?.includes(DEMO_BOT_NICK) && item.textContent?.includes('친구 요청')) {
      const accept = [...item.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent?.trim() === '수락');
      if (accept) return accept;
    }
  }
  return null;
};
let lastReinviteAt = 0; // 거절 시 재요청 쓰로틀

// ── Phase 3/4 헬퍼 ──────────────────────────────────────────
const chatHeaderBtn = (title: string): HTMLElement | null => el(`button[title="${title}"]`);
const attachClipBtn = (): HTMLElement | null => el('button[title="파일 첨부"]');
const attachMenuItem = (text: string): HTMLElement | null =>
  ([...document.querySelectorAll<HTMLElement>('[class*="attachMenu"] button')]
    .find((b) => b.textContent?.includes(text))) ?? null;
// 첨부 메뉴가 열렸으면 해당 항목, 아니면 클립 버튼을 강조
const attachOrItem = (itemText: string) => (): HTMLElement | null => attachMenuItem(itemText) ?? attachClipBtn();
const chartGenerateBtn = (): HTMLElement | null => buttonByText('AI로 차트 생성');
// 실제 차트 결과(캔버스)와 결과 표시 여부
const chartCanvas = (): HTMLElement | null => el('[class*="chartWrap"] canvas') ?? el('[class*="resultView"]');
const chartResultShown = () => buttonByText('이미지로 다운로드') != null;
const chartQuestionInput = (): HTMLElement | null => el('[class*="questionInput"]');
// 강조 rect 헬퍼들(요소 → DOMRect)
const rectOf = (e: HTMLElement | null): DOMRect | null => (e ? e.getBoundingClientRect() : null);
const excelFileAreaRect = (): DOMRect | null => rectOf(el('[class*="fileDropzone"]'));   // 첨부된 엑셀 파일 영역(드롭존)
const chartWrapRect = (): DOMRect | null => rectOf(el('[class*="chartWrap"]'));          // 차트 시각화 영역만
const drawCanvasAreaRect = (): DOMRect | null => rectOf(el('[class*="canvasArea"]'));    // 그림판 캔버스+도구(헤더 X 제외)
const minutesContentRect = (): DOMRect | null => rectOf(el('[class*="detailBody"]'));    // 회의록 본문(헤더 버튼 제외)
// 봇 채팅창 전체 rect(팝업을 창 옆에 두기 위한 기준 — 포커스와 별개)
const botWindowRect = (): DOMRect | null => {
  const ta = botDmTextarea();
  const win = (ta?.closest('[class*="window"]') as HTMLElement | null)
    ?? (document.querySelector('[class*="window"]') as HTMLElement | null);
  return rectOf(win);
};
const drawClearBtn = (): HTMLElement | null => el('button[title="전체 지우기"]');
const drawCanvas = (): HTMLElement | null => el('canvas');
const minutesPanelOpen = () => [...document.querySelectorAll<HTMLElement>('button')].some((b) => b.textContent?.includes('AI 회의록'));
const minutesAiBtn = (): HTMLElement | null => buttonByText('채팅 AI 회의록');
const minutesGenerateBtn = (): HTMLElement | null => buttonByText('회의록 생성');
const minutesAiFormShown = () => document.body.innerText.includes('분석할 채팅 시간 범위');
const minutesResultShown = () => document.body.innerText.includes('Collab 기능 소개 회의록');
const fileMsgShown = () => document.body.innerText.includes('demo_image.png');
const filePanelOpen = () => document.body.innerText.includes('파일 업로드');

export function buildDemoSteps(): DemoStep[] {
  return [
    {
      id: 'welcome',
      getTarget: () => null,
      title: '🚀 Collab 기능 시연',
      text: 'Collab의 주요 기능을 차례로 둘러봅니다. 각 단계에서 [확인]을 누르면 다음으로 넘어가고, [중단]을 누르면 시연을 종료하고 로그인 화면으로 돌아갑니다.',
    },
    // ── 좌측 메뉴 ──
    {
      id: 'sidebar-teams',
      getTarget: () => sidebarSection('팀'),
      title: '팀',
      text: '팀을 만들어 팀 전용 채널과 멤버(리더/매니저/멤버 권한)를 관리할 수 있어요.',
    },
    {
      id: 'sidebar-channels',
      getTarget: () => sidebarSection('채팅방'),
      title: '채팅방',
      text: '1:1 DM·단체 채팅방·팀 채널이 여기에 모입니다. 실시간으로 메시지를 주고받아요.',
    },
    {
      id: 'sidebar-friends',
      getTarget: () => sidebarSection('친구'),
      title: '친구',
      text: '친구를 추가하고, 친구 요청을 수락·거절할 수 있어요.',
    },
    {
      id: 'sidebar-schedules',
      getTarget: () => sidebarSection('일정'),
      title: '일정',
      text: '등록한 일정을 사이드바에서 확인하고, 클릭하면 상세 정보가 떠요.',
    },
    // ── 헤더 ──
    {
      id: 'header-testbot',
      getTarget: () => buttonByText('챗봇 테스트'),
      title: '챗봇 테스트',
      text: 'AI 챗봇과 친구가 되어 채팅하며 메시지·번역 등 채팅 기능을 직접 체험할 수 있어요. (잠시 후 함께 해봅니다)',
    },
    {
      id: 'header-clock',
      getTarget: () => el('[class*="clock"]'),
      padding: 2,
      title: '시계',
      text: '현재 날짜와 시각을 표시합니다.',
    },
    {
      id: 'header-search',
      getTarget: () => el('button[title^="검색"]'),
      padding: 2,
      title: '검색',
      text: '친구·팀·채팅방을 한 번에 검색하고 바로 열 수 있어요.',
    },
    {
      id: 'header-calendar',
      getTarget: () => el('button[title^="캘린더"]'),
      padding: 2,
      title: '캘린더',
      text: '전체 일정을 달력으로 한눈에 볼 수 있어요.',
    },
    {
      id: 'header-notif',
      getTarget: () => el('button[title="알림"]'),
      padding: 2,
      title: '알림',
      text: '친구 요청·팀 초대가 오면 여기로 알림이 와서 바로 수락·거절할 수 있어요.',
    },
    {
      id: 'header-closeall',
      getTarget: () => el('button[title="채팅방 모두 닫기"]') ?? buttonByText('채팅방 모두 닫기'),
      padding: 2,
      title: '채팅방 모두 닫기',
      text: '열려 있는 채팅창을 한 번에 모두 닫습니다.',
    },

    // ── Phase 2: 챗봇 친구수락 · 대화 · 번역 ──
    {
      id: 'bot-invite',
      getTarget: () => buttonByText('챗봇 테스트'),
      title: '챗봇과 친구 맺기',
      text: "이제 AI 챗봇과 대화하며 기능을 체험해 봅니다. 헤더의 '챗봇 테스트' 버튼을 눌러 친구 요청을 받아보세요.",
      mode: 'action',
      actionHint: "👆 '챗봇 테스트' 버튼을 눌러주세요.",
      advanceWhen: () => {
        // 봇 친구/DM 정리는 서버(종료 시)가 담당하므로 추적 불필요. 진행 조건만 본다.
        if (isBotFriend()) return true; // 이미 친구면 통과
        return botFriendRequest() != null; // 친구요청 도착하면 통과
      },
    },
    {
      id: 'bot-accept',
      // 알림을 열면 '수락' 버튼으로, 아직 안 열었으면 알림 벨로 강조(스포트라이트가 따라감)
      getTarget: () => botAcceptButton() ?? el('button[title="알림"]'),
      title: '친구 요청 수락',
      text: '알림(🔔)을 열어 챗봇의 친구 요청을 [수락]해주세요. 거절하면 챗봇이 다시 요청을 보냅니다.',
      mode: 'action',
      actionHint: '🔔 알림에서 챗봇 친구 요청을 수락해주세요.',
      advanceWhen: () => {
        if (isBotFriend()) return true;
        // 거절 등으로 요청이 사라졌는데 아직 친구가 아니면 재요청(4초 쓰로틀)
        if (!botFriendRequest() && Date.now() - lastReinviteAt > 4000) {
          lastReinviteAt = Date.now();
          testbotService.invite().catch(() => {});
        }
        return false;
      },
    },
    {
      id: 'bot-open-dm',
      getTarget: () => buttonByText(DEMO_BOT_NICK),
      title: '챗봇과 채팅 열기',
      text: '사이드바에서 챗봇(테스트봇)을 클릭해 채팅창을 열어주세요.',
      mode: 'action',
      actionHint: '💬 챗봇과의 채팅창을 열어주세요.',
      advanceWhen: () => botDmTextarea() != null,
    },
    {
      id: 'bot-ask-ko',
      getTarget: () => botDmSendBtn(),
      getRect: botChatAndSendRects, // 채팅 내역 + 보내기 버튼만(입력란 제외)
      title: 'AI 챗봇에게 질문',
      text: '입력란에 질문을 미리 채워뒀어요. [보내기]를 눌러 챗봇의 답변을 받아보세요.',
      mode: 'action',
      fixedNote: true,
      actionHint: '📨 보내기 버튼을 눌러주세요.',
      onEnter: () => { const ta = botDmTextarea(); if (ta) setReactValue(ta, DEMO_PROMPT_FEATURES_KO); },
      advanceWhen: () => chatHasText('DM·단톡방·팀채널'),
    },
    {
      id: 'bot-ask-en',
      getTarget: () => botDmSendBtn(),
      getRect: botChatAndSendRects, // 채팅 내역 + 보내기 버튼만(입력란 제외)
      title: '영어로 질문 (번역 준비)',
      text: '이번엔 같은 질문을 영어로 보냅니다. [보내기]를 눌러주세요. 잠시 후 번역 기능을 살펴봅니다.',
      mode: 'action',
      fixedNote: true,
      actionHint: '📨 보내기 버튼을 눌러주세요.',
      onEnter: () => { const ta = botDmTextarea(); if (ta) setReactValue(ta, DEMO_PROMPT_FEATURES_EN); },
      advanceWhen: () => chatHasText('Real-time chat'),
    },
    {
      id: 'translate-open',
      getTarget: () => translateBtnOf(bubbleByContent('Real-time chat')),
      getRect: botChatAreaRect, // 번역 버튼은 채팅 내역 안에 있으므로 채팅 영역만 강조
      title: '실시간 번역',
      text: <>영어 메시지 옆 번역 버튼(<TranslateButtonGlyph />)을 눌러 언어 선택 메뉴를 열어보세요.</>,
      mode: 'action',
      actionHint: <><TranslateButtonGlyph /> 번역 버튼을 눌러주세요.</>,
      onEnter: () => {
        // 항목3: 영어 응답 버블을 화면 안으로 스크롤해 번역 버튼이 보이도록(스포트라이트가 엉뚱한 곳을 가리키던 문제)
        const bubble = bubbleByContent('Real-time chat');
        bubble?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const b = translateBtnOf(bubble);
        if (b) b.style.display = 'flex';
      },
      advanceWhen: () => document.querySelector('[data-translate-menu]') != null,
    },
    {
      id: 'translate-pick',
      // 메뉴 항목 대신 메뉴 전체를 강조 → 안내 팝업이 메뉴 바깥(아래/위)에 배치돼 겹치지 않음(#2)
      getTarget: () => el('[data-translate-menu]') ?? langMenuItem('한국어'),
      title: '한국어로 번역',
      text: '메뉴에서 [한국어]를 선택하면 메시지가 번역되어 표시됩니다.',
      mode: 'action',
      fixedNote: true,
      actionHint: '🇰🇷 한국어를 선택해주세요.',
      advanceWhen: () => chatHasText('DM, 그룹, 팀 채널'),
    },

    // ── Phase 3: 채팅창 도구(파일·시각화·그림판·음성화상·회의록) ──
    {
      id: 'file-attach',
      getTarget: attachOrItem('일반 파일 첨부'),
      title: '파일 첨부',
      text: "입력란의 클립(📎) 아이콘 → '일반 파일 첨부'를 누르면 데모 엑셀이 첨부돼요. 파일은 클릭하면 다운로드되고 채팅창에 끌어다 놓아도 첨부됩니다.",
      mode: 'action',
      actionHint: "📎 클립 → '일반 파일 첨부'를 눌러주세요.",
      advanceWhen: () => fileMsgShown(),
    },
    {
      id: 'file-panel',
      getTarget: () => chatHeaderBtn('파일'),
      padding: 2,
      title: '파일 패널',
      text: "채팅창 상단의 '파일' 아이콘을 눌러보세요. 방에 올라온 파일을 한눈에 보고 다운로드·삭제할 수 있어요(녹음 파일도 30일 보관).",
      mode: 'action',
      actionHint: '📂 헤더의 파일 아이콘을 눌러주세요.',
      advanceWhen: () => filePanelOpen(),
    },
    {
      id: 'excel-attach',
      getTarget: attachOrItem('AI 데이터 분석'),
      title: '엑셀 파일 선택',
      text: "이번엔 클립(📎) → 'AI 데이터 분석'을 눌러 데모 엑셀 파일을 올려보세요.",
      mode: 'action',
      actionHint: "📎 클립 → 'AI 데이터 분석'을 눌러주세요.",
      advanceWhen: () => chartGenerateBtn() != null,
    },
    {
      id: 'excel-question',
      getTarget: () => chartQuestionInput(),
      // 첨부된 엑셀 파일 영역 + 분석 질문 입력, 두 영역을 함께 강조(구멍 2개)
      getRect: () => [excelFileAreaRect(), rectOf(chartQuestionInput())].filter((r): r is DOMRect => !!r),
      title: '분석 질문 입력',
      text: "엑셀 파일이 선택돼 위에 미리보기가 표시돼요. '분석 질문'에 원하는 요청을 직접 적을 수 있어요. 예시로 '막대그래프로 표현해줘'를 미리 넣어뒀습니다.",
      mode: 'confirm',
    },
    {
      id: 'excel-generate',
      getTarget: () => chartGenerateBtn(),
      title: 'AI 차트 생성',
      text: "'AI로 차트 생성'을 누르면 AI가 데이터를 분석해 실제 그래프를 만들어 줍니다. (잠시 걸릴 수 있어요)",
      mode: 'action',
      actionHint: '📊 AI로 차트 생성 버튼을 눌러주세요.',
      advanceWhen: () => chartResultShown(),
    },
    {
      id: 'excel-result',
      getTarget: () => chartCanvas(),
      // 데이터 시각화 차트 영역만 강조(이미지 다운로드·다시분석·메시지영역 제외)
      getRect: () => chartWrapRect(),
      // 팝업은 차트가 아니라 채팅창 기준으로 배치 → 창 옆(오른쪽)으로 빠져 다운로드 버튼을 안 가림
      getPopupRect: () => botWindowRect(),
      title: '차트 공유 · 다운로드',
      text: '만든 차트는 채팅방의 모든 유저에게 실시간으로 공유되고, 아래 [이미지로 다운로드]로 저장할 수 있어요.',
      mode: 'confirm',
    },
    {
      id: 'draw-open',
      getTarget: () => chatHeaderBtn('그림판'),
      padding: 2,
      title: '그림판',
      text: "채팅창 상단의 '그림판' 아이콘을 눌러보세요. 여러 명이 같은 캔버스에 실시간으로 함께 그릴 수 있어요.",
      mode: 'action',
      actionHint: '🎨 헤더의 그림판 아이콘을 눌러주세요.',
      advanceWhen: () => drawClearBtn() != null,
    },
    {
      id: 'draw-draw',
      getTarget: () => drawCanvas(),
      // 그림판 전체(캔버스+도구) 강조 + 실제로 그려볼 수 있게(interactive). 헤더 X·창 최소화/드래그는 영역 밖이라 제외.
      getRect: () => drawCanvasAreaRect(),
      interactive: true,
      title: '자유롭게 그리기',
      text: '캔버스에 마우스로 직접 그려보세요. 색·굵기 도구도 써볼 수 있어요. 다 해보셨으면 [확인]을 눌러 주세요.',
      mode: 'confirm',
    },
    {
      id: 'voice-chat',
      getTarget: () => chatHeaderBtn('음성채팅'),
      padding: 2,
      title: '음성 채팅',
      text: 'WebRTC로 채팅방 멤버끼리 실시간 음성 통화를 할 수 있어요. 녹음하면 서버에 30일간 보관됩니다. (시연에서는 버튼을 눌러도 실제로 연결되지 않아요)',
      mode: 'confirm',
    },
    {
      id: 'video-chat',
      getTarget: () => chatHeaderBtn('화상채팅'),
      padding: 2,
      title: '화상 채팅',
      text: '화상채팅 버튼을 누르면 카메라를 켜고 얼굴을 보며 실시간 영상 통화를 할 수 있어요. (시연에서는 버튼을 눌러도 실제로 연결되지 않아요)',
      mode: 'confirm',
    },
    {
      id: 'minutes',
      getTarget: () => chatHeaderBtn('회의록'),
      padding: 2,
      title: 'AI 회의록',
      text: "채팅창 상단의 '회의록' 아이콘을 눌러보세요. 채팅 내용이나 음성 파일을 AI가 분석해 회의록을 자동 작성하고 .md로 내보낼 수 있어요.",
      mode: 'action',
      actionHint: '📝 헤더의 회의록 아이콘을 눌러주세요.',
      advanceWhen: () => minutesPanelOpen(),
    },
    {
      id: 'minutes-ai-open',
      getTarget: () => minutesAiBtn(),
      title: '채팅 AI 회의록',
      text: "'채팅 AI 회의록'을 눌러보세요. 선택한 시간 범위의 채팅 내용을 AI가 분석해 회의록을 자동 작성해요.",
      mode: 'action',
      actionHint: "🤖 '채팅 AI 회의록' 버튼을 눌러주세요.",
      advanceWhen: () => minutesAiFormShown(),
    },
    {
      id: 'minutes-generate',
      getTarget: () => minutesGenerateBtn(),
      title: '회의록 생성',
      text: "시간 범위가 채워져 있어요. '회의록 생성'을 누르면 AI가 채팅을 분석해 회의록을 작성합니다.",
      mode: 'action',
      fixedNote: true,
      actionHint: '📝 회의록 생성 버튼을 눌러주세요.',
      advanceWhen: () => minutesResultShown(),
    },
    {
      id: 'minutes-result',
      getTarget: () => null,
      // 회의록 본문만 강조(메시지영역·입력란·목록·다운로드·수정·X 버튼 제외) → 안내 팝업은 옆(오른쪽)
      getRect: () => minutesContentRect(),
      title: '회의록 완성',
      text: 'AI가 작성한 회의록이에요. 우측 상단 내보내기로 .md 파일로 저장할 수 있어요.',
      mode: 'confirm',
      fixedNote: true,
    },

    // ── 마무리 ──
    // (일정/팀/검색/알림은 앞 좌측메뉴·헤더 단계에서 이미 소개했으므로 중복 단계 삭제 — #5)
    {
      id: 'finish',
      getTarget: () => null,
      title: '🎉 시연 완료',
      text: '이것으로 Collab의 주요 기능 시연을 마칩니다. 이제 직접 자유롭게 사용해 보세요! [완료]를 누르면 시연 중 만든 데이터를 정리하고 로그인 화면으로 돌아갑니다.',
    },
  ];
}
