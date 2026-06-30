// 시연 모드에서 실 API 대신 사용하는 고정 데이터(챗봇 응답·번역). 규칙3 안내와 함께 표시된다.

export const DEMO_BOT_ID = 'testbot@naver.com';
export const DEMO_BOT_NICK = '테스트봇';

// public 폴더의 데모 에셋
export const DEMO_EXCEL_PATH = '/demo_excel.xlsx';
export const DEMO_EXCEL_NAME = 'demo_excel.xlsx';
export const DEMO_IMAGE_PATH = '/demo_image.png';
export const DEMO_IMAGE_NAME = 'demo_image.png';

/** public/demo_excel.xlsx 를 File 객체로 가져와 분석(시각화)에 사용 */
export async function fetchDemoExcelFile(): Promise<File> {
  const res = await fetch(DEMO_EXCEL_PATH);
  const blob = await res.blob();
  return new File([blob], DEMO_EXCEL_NAME, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// 시연 시 '분석 질문'에 미리 채워둘 프롬프트(수정 불가)
export const DEMO_CHART_PROMPT = '막대그래프로 표현해줘';

/** public/demo_image.png 를 File 객체로 가져와 '일반 파일 첨부'(이미지) 시연에 사용 */
export async function fetchDemoImageFile(): Promise<File> {
  const res = await fetch(DEMO_IMAGE_PATH);
  const blob = await res.blob();
  return new File([blob], DEMO_IMAGE_NAME, { type: 'image/png' });
}

// 시연용 고정 AI 회의록(채팅 AI 회의록 결과). 시연 채팅은 로컬 연출이라 실제 분석 대신 고정 결과를 보여준다.
export const DEMO_MINUTES_TITLE = 'Collab 기능 소개 회의록 (AI 자동 작성)';
export const DEMO_MINUTES_CONTENT =
  '## 참석자\n' +
  '- 테스트봇, 시연 참여자\n' +
  '\n' +
  '## 안건\n' +
  '- Collab 협업 메신저의 주요 기능 소개\n' +
  '\n' +
  '## 논의 내용\n' +
  '- 실시간 채팅(DM·단톡방·팀 채널)과 메시지 번역 기능을 살펴봄\n' +
  '- 파일 첨부 및 엑셀 데이터 AI 시각화(차트 생성) 시연\n' +
  '- 그림판(실시간 공동 드로잉), 음성·화상 채팅(녹음 30일 보관) 소개\n' +
  '- AI 회의록: 채팅/음성 내용을 Gemini AI가 분석해 자동 작성\n' +
  '\n' +
  '## 결정 사항\n' +
  '- 팀·친구·일정·캘린더로 협업 일정을 함께 관리하기로 함\n' +
  '\n' +
  '## 다음 할 일\n' +
  '- 실제 데이터로 각 기능을 직접 사용해 보기';

// 시연 중 입력란에 자동으로 채워 넣을 프롬프트(정확히 일치해야 고정 응답 매칭)
export const DEMO_PROMPT_FEATURES_KO = 'Collab 의 구현 기능 목록에 대해 말해봐';
export const DEMO_PROMPT_FEATURES_EN = "Tell me about Collab's implementation capabilities list in english";

export const DEMO_BOT_REPLY_KO =
  'Collab은 이런 기능을 제공해요!\n' +
  '• 실시간 채팅(DM·단톡방·팀채널)\n' +
  '• 파일 첨부(드래그앤드롭, 최대 50MB)\n' +
  '• 실시간 번역\n' +
  '• 음성·화상 채팅(녹음 30일 보관)\n' +
  '• 그림판(실시간 공동 드로잉)\n' +
  '• 엑셀 데이터 시각화(AI 차트)\n' +
  '• AI 회의록\n' +
  '• 일정·캘린더, 팀·친구 관리\n' +
  '무엇이든 편하게 물어보세요 🙂';

export const DEMO_BOT_REPLY_EN =
  'Collab provides these features!\n' +
  '• Real-time chat (DM, group, team channels)\n' +
  '• File attachments (drag & drop, up to 50MB)\n' +
  '• Real-time translation\n' +
  '• Voice & video chat (recordings kept for 30 days)\n' +
  '• Whiteboard (real-time collaborative drawing)\n' +
  '• Excel data visualization (AI charts)\n' +
  '• AI meeting minutes\n' +
  '• Schedule & calendar, team & friend management\n' +
  'Feel free to ask me anything 🙂';

export const DEMO_GENERIC_REPLY = '시연용 데모 봇이에요. 안내를 따라 기능을 둘러보세요! 🤖';

// 영어 응답을 한국어로 번역한 고정 번역
export const DEMO_TRANSLATION =
  'Collab은 이런 기능을 제공합니다!\n' +
  '• 실시간 채팅(DM, 그룹, 팀 채널)\n' +
  '• 파일 첨부(드래그 앤 드롭, 최대 50MB)\n' +
  '• 실시간 번역\n' +
  '• 음성·영상 채팅(녹음 30일 보관)\n' +
  '• 화이트보드(실시간 공동 드로잉)\n' +
  '• 엑셀 데이터 시각화(AI 차트)\n' +
  '• AI 회의록\n' +
  '• 일정·캘린더, 팀·친구 관리\n' +
  '무엇이든 편하게 물어보세요 🙂';

/** 입력란 content에 대응하는 고정 봇 응답(없으면 일반 응답). */
export function demoBotReply(content: string): string {
  const c = content.trim();
  if (c === DEMO_PROMPT_FEATURES_KO) return DEMO_BOT_REPLY_KO;
  if (c === DEMO_PROMPT_FEATURES_EN) return DEMO_BOT_REPLY_EN;
  return DEMO_GENERIC_REPLY;
}
