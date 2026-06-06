'use client';

import { useState } from 'react';
import styles from './MinutesPanel.module.css';

interface Minutes {
  id: string;
  title: string;
  date: string;
  author: string;
  content: string;
  isAI: boolean;
}

const INITIAL_MINUTES: Minutes[] = [
  {
    id: '1', title: '팀 스프린트 킥오프 회의', date: '2026-06-05', author: '홍길동', isAI: false,
    content: `## 참석자\n홍길동, 김영희, 박민준, 정다은\n\n## 안건\n1. 이번 스프린트 목표 설정\n2. 태스크 분배\n3. 데일리 스크럼 시간 조율\n\n## 결정사항\n- 스프린트 목표: Collab 채팅 기능 완성\n- 데일리 스크럼: 매일 오전 10시\n- 박민준: 백엔드 WebSocket 구현 담당\n- 정다은: 프론트엔드 채팅 UI 담당\n\n## 다음 회의\n2026-06-12 오전 10시`,
  },
  {
    id: '2', title: '코드 리뷰 세션', date: '2026-06-03', author: '박민준', isAI: false,
    content: `## 리뷰 대상\nPR #42 — 백엔드 API 리팩토링\n\n## 주요 피드백\n- 인증 미들웨어 중복 제거 필요\n- N+1 쿼리 문제 발견 (getMembersForChat)\n- 에러 핸들링 일관성 개선 요청\n\n## 조치사항\n- 홍길동이 N+1 쿼리 수정 후 재요청\n- 에러 핸들링 표준 문서 작성 예정`,
  },
  {
    id: '3', title: '기술 스택 검토 미팅', date: '2026-06-01', author: '이철수', isAI: false,
    content: `## 검토 항목\n- WebRTC vs SFU 서버 방식 비교\n- 실시간 채팅 프레임워크 선정\n\n## 결론\n- 초기 버전은 WebRTC P2P로 구현\n- 확장 시 SFU(미디어 서버) 도입 검토\n- Socket.IO 유지`,
  },
];

const AI_TEMPLATE = (date: string) =>
  `## AI 자동 생성 회의록\n\n## 참석자\n(자동 감지) 홍길동, 김영희, 박민준\n\n## 주요 논의 내용\n- 프로젝트 진행 상황 공유\n- 이슈 및 블로커 논의\n- 다음 스프린트 우선순위 조율\n\n## 결정사항\n- 이슈 #15 이번 주 내 해결 목표\n- 다음 회의: 일정 조율 후 공지\n\n*이 회의록은 AI가 자동 생성했습니다. (${date})*`;

const renderContent = (content: string, s: Record<string, string>) =>
  content.split('\n').map((line, i) => {
    if (line.startsWith('## ')) return <p key={i} className={s.h2}>{line.slice(3)}</p>;
    if (line.startsWith('- '))  return <p key={i} className={s.li}>• {line.slice(2)}</p>;
    if (line === '')             return <div key={i} className={s.spacer} />;
    return <p key={i} className={s.p}>{line}</p>;
  });

export default function MinutesPanel({ onClose }: { onClose: () => void }) {
  const [minutes, setMinutes] = useState<Minutes[]>(INITIAL_MINUTES);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = selectedId ? minutes.find(m => m.id === selectedId) ?? null : null;

  const deleteMinutes = (id: string) => {
    setMinutes(prev => prev.filter(m => m.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const createAI = () => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const entry: Minutes = {
      id: Date.now().toString(), title: `AI 회의록 ${date}`,
      date, author: 'AI', isAI: true, content: AI_TEMPLATE(date),
    };
    setMinutes(prev => [entry, ...prev]);
    setSelectedId(entry.id);
  };

  /* ── 상세 보기 ── */
  if (selected) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => setSelectedId(null)}>
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            목록
          </button>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={styles.detailBody}>
          <div className={styles.detailMeta}>
            <span className={`${styles.detailTitle} ${selected.isAI ? styles.aiTitleColor : ''}`}>
              {selected.isAI && <span className={styles.aiTag}>AI</span>}
              {selected.title}
            </span>
            <span className={styles.detailSub}>{selected.date} · {selected.author}</span>
          </div>
          <div className={styles.contentArea}>
            {renderContent(selected.content, {
              h2: styles.h2, li: styles.li, p: styles.p, spacer: styles.spacer,
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ── 목록 ── */
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>회의록 <span style={{fontSize:'10px',background:'#f59e0b',color:'#fff',borderRadius:'4px',padding:'1px 5px',verticalAlign:'middle'}}>준비 중</span></span>
        <button className={styles.closeBtn} onClick={onClose}>
          <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className={styles.toolbar}>
        <button className={styles.aiBtn} onClick={createAI}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          AI 회의록 작성
        </button>
      </div>

      <div className={styles.list}>
        {minutes.length === 0 ? (
          <div className={styles.emptyMsg}>회의록이 없습니다</div>
        ) : (
          minutes.map(m => (
            <div
              key={m.id}
              className={`${styles.item} ${m.id === selectedId ? styles.itemSelected : ''}`}
              onClick={() => setSelectedId(m.id)}
            >
              <div className={styles.itemInfo}>
                <span className={styles.itemTitle}>
                  {m.isAI && <span className={styles.aiTag}>AI</span>}
                  {m.title}
                </span>
                <span className={styles.itemMeta}>{m.date} · {m.author}</span>
              </div>
              <button
                className={styles.deleteBtn}
                onClick={e => { e.stopPropagation(); deleteMinutes(m.id); }}
                title="삭제"
              >
                <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
