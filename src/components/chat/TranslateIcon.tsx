// 채팅 메시지의 번역 버튼 아이콘(공용). MessageList의 실제 버튼과 시연 안내 팝업이 같은 모양을 쓰도록 분리.

export function TranslateIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
    </svg>
  );
}

/**
 * 실제 번역 버튼과 동일한 모양(22px 원형 + 아이콘)의 인라인 글리프.
 * 시연 안내 문구에서 "번역 버튼"을 실제 버튼과 똑같이 보여줄 때 사용.
 */
export function TranslateButtonGlyph() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        border: '1px solid var(--border)',
        borderRadius: '50%',
        background: 'var(--bg-surface)',
        color: 'var(--text-sub)',
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    >
      <TranslateIcon />
    </span>
  );
}
