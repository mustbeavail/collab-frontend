// 시연 모드에서 실 API 대신 사용하는 고정 데이터(챗봇 응답·번역). 규칙3 안내와 함께 표시된다.

export const DEMO_BOT_ID = 'testbot@naver.com';
export const DEMO_BOT_NICK = '테스트봇';

// public 폴더의 데모 에셋
export const DEMO_EXCEL_PATH = '/demo_excel.xlsx';
export const DEMO_EXCEL_NAME = 'demo_excel.xlsx';
export const DEMO_IMAGE_PATH = '/demo_image.png';

/** public/demo_excel.xlsx 를 File 객체로 가져와 첨부/분석에 사용 */
export async function fetchDemoExcelFile(): Promise<File> {
  const res = await fetch(DEMO_EXCEL_PATH);
  const blob = await res.blob();
  return new File([blob], DEMO_EXCEL_NAME, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

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
