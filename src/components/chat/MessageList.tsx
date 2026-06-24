'use client';

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './MessageList.module.css';
import type { ChatMessage, FileMessageContent } from '@/types/chat';
import { fileService } from '@/services/file';
import { translateService } from '@/services/translate';
import { filterLanguages, type Lang } from '@/lib/languages';
import UserProfileModal from '@/components/user/UserProfileModal';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

function resolveAvatar(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

interface Props {
  messages: ChatMessage[];
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  currentUserId?: string;
  initialLoad?: React.MutableRefObject<boolean>;
  deletedFileIdx?: Set<number>;
  botTyping?: { nickname: string; avatarUrl: string | null } | null;
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${m}`;
}

function avatarText(nickname: string): string {
  return nickname?.charAt(0) ?? '?';
}

// 항목1(일정이후): 메시지 사이 날짜 변경 시 연월일 구분선
function dateKey(isoStr: string): string {
  const d = new Date(isoStr);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
function formatDateDivider(isoStr: string): string {
  const d = new Date(isoStr);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileMessageBubble({ content, canDelete, deletedFileIdx }: { content: string; canDelete?: boolean; deletedFileIdx?: Set<number> }) {
  let parsed: FileMessageContent | null = null;
  try { parsed = JSON.parse(content); } catch { return <p style={{ color: '#ef4444' }}>파일 정보를 불러올 수 없습니다.</p>; }
  if (!parsed) return null;
  const { fileIdx, oriFilename, fileSize } = parsed;
  // 항목1(일정이후): 삭제된 파일이면 메시지는 남기되 안내만 표시(다운로드/삭제 버튼 없음)
  const isDeleted = parsed.deleted === true || (deletedFileIdx?.has(fileIdx) ?? false);
  if (isDeleted) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '8px 12px', borderRadius: '8px',
        background: 'var(--bg-surface)', border: '1px dashed var(--border)',
        color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13px',
      }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        삭제된 파일입니다.
      </div>
    );
  }
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <button
        type="button"
        onClick={() => fileService.download(fileIdx, oriFilename).catch(() => alert('다운로드에 실패했습니다.'))}
        title="다운로드"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
          background: 'var(--bg-surface)', color: 'var(--text-base)',
          border: '1px solid var(--border)', font: 'inherit',
        }}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {/* 항목7: 파일명 또렷한 색 */}
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-light)' }}>{oriFilename}</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatFileSize(fileSize)}</span>
      </button>
      {/* 항목11/항목1: 메시지 옆 삭제 x (업로더만) → 파일 삭제(메시지는 '삭제된 파일'로 남음) */}
      {canDelete && (
        <button
          type="button"
          onClick={() => { if (confirm('이 파일을 삭제하시겠습니까?')) fileService.deleteFile(fileIdx).catch(() => alert('삭제에 실패했습니다.')); }}
          title="파일 삭제"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '20px', height: '20px', borderRadius: '50%', cursor: 'pointer',
            background: 'transparent', border: 'none', color: 'var(--text-muted)',
          }}
        >
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

function TranslateIcon() {
  return (
    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
    </svg>
  );
}

export default function MessageList({ messages, loading, loadingMore, hasMore, onLoadMore, currentUserId, initialLoad, deletedFileIdx, botTyping }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);
  const prevMessagesLengthRef = useRef(0);

  // msgIdx → 번역 결과(선택 언어 코드/라벨 포함)
  const [translations, setTranslations] = useState<Record<number, { lang: string; label: string; text: string }>>({});
  const [translating, setTranslating] = useState<Record<number, boolean>>({});
  // 언어 선택 메뉴가 열린 메시지 + 검색어
  const [langMenuFor, setLangMenuFor] = useState<number | null>(null);
  const [langQuery, setLangQuery] = useState('');

  // F(23): 맨밑으로 버튼
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // F(10): 닉네임 클릭 → 회원정보 팝업
  const [profileTarget, setProfileTarget] = useState<{ userId: string; nickname: string; email: string } | null>(null);

  const closeLangMenu = useCallback(() => { setLangMenuFor(null); setLangQuery(''); }, []);

  // 선택한 언어로 번역. 이미 같은 언어로 번역돼 있으면 토글로 숨김.
  const translateTo = useCallback(async (msgIdx: number, text: string, lang: Lang) => {
    closeLangMenu();
    if (translations[msgIdx]?.lang === lang.code) {
      setTranslations(prev => { const next = { ...prev }; delete next[msgIdx]; return next; });
      return;
    }
    setTranslating(prev => ({ ...prev, [msgIdx]: true }));
    try {
      const result = await translateService.translate(text, lang.code);
      setTranslations(prev => ({ ...prev, [msgIdx]: { lang: lang.code, label: lang.ko, text: result } }));
    } catch {
      alert('번역에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setTranslating(prev => { const next = { ...prev }; delete next[msgIdx]; return next; });
    }
  }, [translations, closeLangMenu]);

  const hideTranslation = useCallback((msgIdx: number) => {
    setTranslations(prev => { const next = { ...prev }; delete next[msgIdx]; return next; });
    closeLangMenu();
  }, [closeLangMenu]);

  // 언어 메뉴 바깥 클릭 시 닫기
  useEffect(() => {
    if (langMenuFor === null) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-translate-menu]') && !t.closest('[data-translate-btn]')) closeLangMenu();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [langMenuFor, closeLangMenu]);

  // 초기 로드 완료 시 맨 아래로 스크롤
  useEffect(() => {
    if (!loading && initialLoad?.current && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
      if (initialLoad) initialLoad.current = false;
    }
  }, [loading, messages.length, initialLoad]);

  // 현재 스크롤 위치 기준으로 '맨밑으로' 버튼 표시 여부 갱신
  const updateScrollBtn = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setShowScrollBtn(!nearBottom);
  }, []);

  // 새 메시지(STOMP) 수신 시 맨 아래 근처이면 자동 스크롤 + '맨밑으로' 버튼 갱신
  useEffect(() => {
    const el = listRef.current;
    if (!el || loadingMore) return;
    const grew = messages.length > prevMessagesLengthRef.current;
    if (grew) {
      const addedOne = messages.length - prevMessagesLengthRef.current === 1;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      if (addedOne && nearBottom) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        setShowScrollBtn(false);
      } else {
        // 위로 스크롤한 상태 또는 여러 개 동시 도착(스크롤 이벤트 미발생) → 현재 위치 기준 버튼 표시
        // 이전엔 handleScroll에서만 갱신해 새 메시지로 휠이 생겨도 버튼이 안 떴음
        setShowScrollBtn(!nearBottom);
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, loadingMore]);

  // 컨테이너 크기 변화(패널 열림/창 리사이즈 등으로 스크롤 생김)에도 버튼 재계산
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateScrollBtn());
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateScrollBtn]);

  // '답변 생성 중' 인디케이터가 나타날 때 맨 아래 근처면 자동 스크롤해 보이게
  useEffect(() => {
    if (!botTyping) return;
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [botTyping]);

  // 과거 메시지 prepend 후 스크롤 위치 복원
  useLayoutEffect(() => {
    if (loadingMore) {
      prevScrollHeightRef.current = listRef.current?.scrollHeight ?? 0;
    }
  }, [loadingMore]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || prevScrollHeightRef.current === 0) return;
    if (!loadingMore && prevScrollHeightRef.current > 0) {
      el.scrollTop += el.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
    }
  });

  // 스크롤 상단 감지 → 과거 메시지 로드 + F(23) 맨밑으로 버튼 표시
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    if (onLoadMore && hasMore && !loadingMore && el.scrollTop < 80) onLoadMore();
    updateScrollBtn();
  }, [onLoadMore, hasMore, loadingMore, updateScrollBtn]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading) {
    return <div className={styles.list}><p className={styles.empty}>메시지 로딩 중...</p></div>;
  }

  if (messages.length === 0) {
    return <div className={styles.list}><p className={styles.empty}>아직 메시지가 없습니다.</p></div>;
  }

  return (
    <div className={styles.listWrap}>
      <div className={styles.list} ref={listRef} onScroll={handleScroll}>
        {loadingMore && <p className={styles.loadingMore}>이전 메시지 로딩 중...</p>}
        {hasMore && !loadingMore && <p className={styles.scrollHint}>위로 스크롤하면 이전 메시지를 불러옵니다</p>}

        {messages.map((msg, i) => {
          // 항목1(일정이후): 직전 메시지와 날짜가 다르면(또는 첫 메시지) 연월일 구분선 삽입
          const prev = messages[i - 1];
          const dateDivider = (!prev || dateKey(prev.sentAt) !== dateKey(msg.sentAt)) ? (
            <div className={styles.dateDivider}><span>{formatDateDivider(msg.sentAt)}</span></div>
          ) : null;

          // G(11): SYSTEM 메시지 별도 표시
          if (msg.msgType === 'SYSTEM') {
            return (
              <Fragment key={msg.msgIdx}>
                {dateDivider}
                <div className={styles.systemMessage}>{msg.content}</div>
              </Fragment>
            );
          }

          return (
            <Fragment key={msg.msgIdx}>
            {dateDivider}
            <div
              className={`${styles.message} ${msg.userId === currentUserId ? styles.mine : ''}`}
            >
              {msg.userId !== currentUserId && (
                (() => {
                  const avatarSrc = resolveAvatar(msg.avatarUrl);
                  const openProfile = () => setProfileTarget({ userId: msg.userId, nickname: msg.nickname, email: msg.userId });
                  return avatarSrc
                    ? <img src={avatarSrc} alt={msg.nickname} className={`${styles.avatarImg} ${styles.avatarClickable}`} onClick={openProfile} title="프로필 보기" />
                    : <div className={`${styles.avatar} ${styles.avatarClickable}`} onClick={openProfile} title="프로필 보기">{avatarText(msg.nickname)}</div>;
                })()
              )}
              <div className={styles.body}>
                {msg.userId !== currentUserId && (
                  <div className={styles.meta}>
                    <span
                      className={`${styles.sender} ${styles.senderClickable}`}
                      onClick={() => setProfileTarget({ userId: msg.userId, nickname: msg.nickname, email: msg.userId })}
                      title="프로필 보기"
                    >
                      {msg.nickname}
                    </span>
                    <span className={styles.time}>{formatTime(msg.sentAt)}</span>
                  </div>
                )}
                {msg.msgType === 'FILE' ? (
                  <FileMessageBubble
                    content={msg.content}
                    canDelete={msg.userId === currentUserId}
                    deletedFileIdx={deletedFileIdx}
                  />
                ) : (
                  <div className={styles.bubbleWrap}>
                    <p className={styles.content}>{msg.content}</p>
                    <button
                      data-translate-btn
                      className={`${styles.translateBtn} ${translations[msg.msgIdx] ? styles.translateBtnActive : ''} ${langMenuFor === msg.msgIdx ? styles.translateBtnOpen : ''}`}
                      onClick={() => { setLangQuery(''); setLangMenuFor(langMenuFor === msg.msgIdx ? null : msg.msgIdx); }}
                      title="번역 언어 선택"
                      disabled={translating[msg.msgIdx]}
                    >
                      {translating[msg.msgIdx] ? (
                        <span className={styles.translateSpinner} />
                      ) : (
                        <TranslateIcon />
                      )}
                    </button>

                    {langMenuFor === msg.msgIdx && (
                      <div className={styles.langMenu} data-translate-menu>
                        <input
                          className={styles.langSearch}
                          placeholder="언어 검색 또는 직접 입력…"
                          value={langQuery}
                          onChange={e => setLangQuery(e.target.value)}
                          autoFocus
                        />
                        <div className={styles.langList}>
                          {translations[msg.msgIdx] && (
                            <button className={styles.langHideItem} onClick={() => hideTranslation(msg.msgIdx)}>
                              원문 보기
                            </button>
                          )}
                          {filterLanguages(langQuery).map(l => (
                            <button
                              key={l.code}
                              className={`${styles.langItem} ${translations[msg.msgIdx]?.lang === l.code ? styles.langItemActive : ''}`}
                              onClick={() => translateTo(msg.msgIdx, msg.content, l)}
                            >
                              <span className={styles.langKo}>{l.ko}</span>
                              <span className={styles.langNative}>{l.native}</span>
                            </button>
                          ))}
                          {filterLanguages(langQuery).length === 0 && (
                            <p className={styles.langEmpty}>일치하는 언어가 없어요</p>
                          )}
                        </div>
                      </div>
                    )}

                    {translations[msg.msgIdx] && (
                      <p className={styles.translatedText}>
                        <span className={styles.translatedLangTag}>{translations[msg.msgIdx].label}</span>
                        {translations[msg.msgIdx].text}
                      </p>
                    )}
                  </div>
                )}
                {msg.userId === currentUserId && (
                  <span className={`${styles.time} ${styles.mineTime}`}>{formatTime(msg.sentAt)}</span>
                )}
              </div>
            </div>
            </Fragment>
          );
        })}

        {/* 테스트봇 '답변 생성 중' 인디케이터 — 실제 응답이 오면 useChatRoom이 해제하고 메시지로 대체 */}
        {botTyping && (
          <div className={styles.message}>
            {(() => {
              const src = resolveAvatar(botTyping.avatarUrl);
              return src
                ? <img src={src} alt={botTyping.nickname} className={styles.avatarImg} />
                : <div className={styles.avatar}>{avatarText(botTyping.nickname)}</div>;
            })()}
            <div className={styles.body}>
              <div className={styles.meta}>
                <span className={styles.sender}>{botTyping.nickname}</span>
              </div>
              <div className={styles.typingBubble}>
                답변 생성 중
                <span className={styles.typingDots}><span /><span /><span /></span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* F(23): 맨밑으로 버튼 */}
      {showScrollBtn && (
        <button className={styles.scrollToBottomBtn} onClick={scrollToBottom} title="맨 아래로">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {/* F(10): 회원정보 팝업 */}
      {profileTarget && (
        <UserProfileModal
          user={profileTarget}
          onClose={() => setProfileTarget(null)}
        />
      )}
    </div>
  );
}
