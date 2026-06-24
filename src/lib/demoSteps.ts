// 기능 시연 단계 정의. 대상은 런타임 DOM getter로 찾는다(컴포넌트 수정 최소화).
// Phase 1: 좌측 메뉴·헤더 소개. Phase 2: 챗봇 친구수락·대화·번역. 이후 Phase 3~4에서 확장.

import { testbotService } from '@/services/testbot';
import { useNotificationStore } from '@/store/notificationStore';
import { useFriendStore } from '@/store/friendStore';
import { useDemoStore } from '@/store/demoStore';
import {
  DEMO_BOT_ID, DEMO_BOT_NICK, DEMO_PROMPT_FEATURES_KO, DEMO_PROMPT_FEATURES_EN,
} from '@/lib/demoFixtures';

export type StepMode = 'confirm' | 'action';

export interface DemoStep {
  id: string;
  getTarget: () => HTMLElement | null; // null → 화면 중앙 팝업
  title?: string;
  text: string;
  mode?: StepMode;        // 기본 'confirm'(확인 버튼으로 진행)
  actionHint?: string;    // action 모드 하단 안내
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
const demoChartImg = (): HTMLElement | null => el('img[alt="데모 차트"]');
const drawClearBtn = (): HTMLElement | null => el('button[title="전체 지우기"]');
const drawCanvas = (): HTMLElement | null => el('canvas');
const minutesPanelOpen = () => [...document.querySelectorAll<HTMLElement>('button')].some((b) => b.textContent?.includes('AI 회의록'));
const fileMsgShown = () => document.body.innerText.includes('demo_excel.xlsx');
const filePanelOpen = () => document.body.innerText.includes('파일 업로드');
const workspaceSearchBtn = (): HTMLElement | null => el('button[title*="친구·팀·채팅방"]');

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
      title: '시계',
      text: '현재 날짜와 시각을 표시합니다.',
    },
    {
      id: 'header-search',
      getTarget: () => el('button[title^="검색"]'),
      title: '검색',
      text: '친구·팀·채팅방을 한 번에 검색하고 바로 열 수 있어요.',
    },
    {
      id: 'header-calendar',
      getTarget: () => el('button[title^="캘린더"]'),
      title: '캘린더',
      text: '전체 일정을 달력으로 한눈에 볼 수 있어요.',
    },
    {
      id: 'header-notif',
      getTarget: () => el('button[title="알림"]'),
      title: '알림',
      text: '친구 요청·팀 초대가 오면 여기로 알림이 와서 바로 수락·거절할 수 있어요.',
    },
    {
      id: 'header-closeall',
      getTarget: () => el('button[title="채팅방 모두 닫기"]') ?? buttonByText('채팅방 모두 닫기'),
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
        if (isBotFriend()) return true; // 이미 친구(데모 부산물 아님) → 정리 대상 아님, 다음 단계도 자동통과
        const req = botFriendRequest();
        if (req) { useDemoStore.getState().setArtifact({ friendIdx: req.friendIdx }); return true; }
        return false;
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
      title: '실시간 번역',
      text: '영어 메시지 옆 번역 버튼(🌐)을 눌러 언어 선택 메뉴를 열어보세요.',
      mode: 'action',
      actionHint: '🌐 번역 버튼을 눌러주세요.',
      onEnter: () => { const b = translateBtnOf(bubbleByContent('Real-time chat')); if (b) b.style.display = 'flex'; },
      advanceWhen: () => document.querySelector('[data-translate-menu]') != null,
    },
    {
      id: 'translate-pick',
      getTarget: () => langMenuItem('한국어'),
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
      title: '파일 패널',
      text: "채팅창 상단의 '파일' 아이콘을 눌러보세요. 방에 올라온 파일을 한눈에 보고 다운로드·삭제할 수 있어요(녹음 파일도 30일 보관).",
      mode: 'action',
      actionHint: '📂 헤더의 파일 아이콘을 눌러주세요.',
      advanceWhen: () => filePanelOpen(),
    },
    {
      id: 'excel-attach',
      getTarget: attachOrItem('AI 데이터 분석'),
      title: '엑셀 데이터 시각화',
      text: "이번엔 클립(📎) → 'AI 데이터 분석'을 눌러 데모 엑셀을 올려보세요. AI가 그래프로 시각화해 줍니다.",
      mode: 'action',
      actionHint: "📎 클립 → 'AI 데이터 분석'을 눌러주세요.",
      advanceWhen: () => chartGenerateBtn() != null,
    },
    {
      id: 'excel-generate',
      getTarget: () => chartGenerateBtn(),
      title: 'AI 차트 생성',
      text: "'AI로 차트 생성'을 누르면 데이터가 그래프로 만들어집니다.",
      mode: 'action',
      fixedNote: true,
      actionHint: '📊 AI로 차트 생성 버튼을 눌러주세요.',
      advanceWhen: () => demoChartImg() != null,
    },
    {
      id: 'excel-result',
      getTarget: () => demoChartImg(),
      title: '차트 공유 · 다운로드',
      text: '만든 차트는 채팅방의 모든 유저에게 실시간으로 공유되고, 아래 [이미지로 다운로드]로 저장할 수 있어요.',
      mode: 'confirm',
      fixedNote: true,
    },
    {
      id: 'draw-open',
      getTarget: () => chatHeaderBtn('그림판'),
      title: '그림판',
      text: "채팅창 상단의 '그림판' 아이콘을 눌러보세요. 여러 명이 같은 캔버스에 실시간으로 함께 그릴 수 있어요.",
      mode: 'action',
      actionHint: '🎨 헤더의 그림판 아이콘을 눌러주세요.',
      advanceWhen: () => drawClearBtn() != null,
    },
    {
      id: 'draw-draw',
      getTarget: () => drawCanvas(),
      title: '자유롭게 그리기',
      text: '캔버스에 마우스로 자유롭게 그려보세요. 그린 내용은 PNG로 저장할 수도 있어요. 다 보셨으면 [확인]을 눌러 주세요.',
      mode: 'confirm',
    },
    {
      id: 'voice-video',
      getTarget: () => chatHeaderBtn('음성채팅'),
      title: '음성 · 화상 채팅',
      text: 'WebRTC로 채팅방 멤버끼리 실시간 음성·영상 통화를 하고, 녹음하면 서버에 30일간 보관됩니다. (이 시연에서는 설명만 하고 넘어갑니다)',
      mode: 'confirm',
    },
    {
      id: 'minutes',
      getTarget: () => chatHeaderBtn('회의록'),
      title: 'AI 회의록',
      text: "채팅창 상단의 '회의록' 아이콘을 눌러보세요. 채팅 내용이나 음성 파일을 AI가 분석해 회의록을 자동 작성하고 .md로 내보낼 수 있어요.",
      mode: 'action',
      fixedNote: true,
      actionHint: '📝 헤더의 회의록 아이콘을 눌러주세요.',
      advanceWhen: () => minutesPanelOpen(),
    },

    // ── Phase 4: 좌측 기능 + 마무리 ──
    {
      id: 'schedule',
      getTarget: () => sidebarSection('일정'),
      title: '일정',
      text: '팀·채팅방 멤버와 일정을 공유할 수 있어요. 제목·시간·참여인원·카카오맵 위치까지 지정하고, 사이드바와 헤더 캘린더에서 확인합니다.',
    },
    {
      id: 'team',
      getTarget: () => buttonByText('팀 만들기'),
      title: '팀 만들기',
      text: "'팀 만들기'로 팀을 생성하면 팀 전용 채널이 만들어지고, 멤버를 초대해 리더/매니저/멤버 권한으로 관리할 수 있어요.",
    },
    {
      id: 'search',
      getTarget: () => workspaceSearchBtn(),
      title: '검색',
      text: '헤더의 검색으로 친구·팀·채팅방을 한 번에 찾고 바로 열 수 있어요.',
    },
    {
      id: 'notif',
      getTarget: () => el('button[title="알림"]'),
      title: '알림',
      text: '친구 요청·팀 초대가 오면 알림으로 바로 수락·거절할 수 있어요.',
    },
    {
      id: 'finish',
      getTarget: () => null,
      title: '🎉 시연 완료',
      text: '이것으로 Collab의 주요 기능 시연을 마칩니다. 이제 직접 자유롭게 사용해 보세요! [완료]를 누르면 시연 중 만든 데이터를 정리하고 로그인 화면으로 돌아갑니다.',
    },
  ];
}
