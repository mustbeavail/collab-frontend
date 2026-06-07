'use client';

import { useEffect, useRef, useState } from 'react';
import { searchService, type GlobalSearchResult } from '@/services/search';
import styles from './SearchModal.module.css';

interface Props {
  onClose: () => void;
}

type TabType = 'all' | 'friend' | 'team' | 'room';

const EMPTY: GlobalSearchResult = { friends: [], teams: [], rooms: [] };

export default function SearchModal({ onClose }: Props) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<TabType>('all');
  const [result, setResult] = useState<GlobalSearchResult>(EMPTY);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) { setResult(EMPTY); return; }
    timerRef.current = setTimeout(() => {
      setLoading(true);
      searchService.globalSearch(query.trim())
        .then(setResult)
        .catch(() => setResult(EMPTY))
        .finally(() => setLoading(false));
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const totalCount = result.friends.length + result.teams.length + result.rooms.length;
  const hasResults = query.trim() && !loading && totalCount > 0;

  const friends = tab === 'all' || tab === 'friend' ? result.friends : [];
  const teams   = tab === 'all' || tab === 'team'   ? result.teams   : [];
  const rooms   = tab === 'all' || tab === 'room'   ? result.rooms   : [];

  return (
    <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.searchRow}>
          <svg className={styles.searchIcon} width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            className={styles.input}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="친구, 팀, 채팅방 검색..."
            onKeyDown={e => e.key === 'Escape' && onClose()}
          />
          {query && (
            <button className={styles.clearBtn} onClick={() => { setQuery(''); inputRef.current?.focus(); }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {query.trim() && (
          <div className={styles.tabs}>
            {(['all', 'friend', 'team', 'room'] as TabType[]).map(t => (
              <button
                key={t}
                className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
                onClick={() => setTab(t)}
              >
                {t === 'all' ? '전체' : t === 'friend' ? '친구' : t === 'team' ? '팀' : '채팅방'}
              </button>
            ))}
          </div>
        )}

        <div className={styles.results}>
          {!query.trim() && (
            <div className={styles.hint}>검색어를 입력하세요.</div>
          )}
          {loading && <div className={styles.hint}>검색 중...</div>}
          {!loading && query.trim() && !hasResults && (
            <div className={styles.hint}>검색 결과가 없습니다.</div>
          )}

          {friends.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>친구</div>
              {friends.map(f => (
                <div key={f.userId} className={styles.item}>
                  <div className={styles.avatar}>
                    {f.avatarUrl
                      ? <img src={f.avatarUrl} alt="" className={styles.avatarImg} />
                      : f.nickname[0]}
                  </div>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{f.nickname}</span>
                    <span className={styles.itemSub}>{f.userId}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {teams.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>팀</div>
              {teams.map(t => (
                <div key={t.teamIdx} className={styles.item}>
                  <div className={`${styles.avatar} ${styles.teamAvatar}`}>{t.teamName[0]}</div>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{t.teamName}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {rooms.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>채팅방</div>
              {rooms.map(r => (
                <div key={r.roomIdx} className={styles.item}>
                  <div className={`${styles.avatar} ${styles.roomAvatar}`}>
                    {r.isDm ? '@' : '#'}
                  </div>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{r.roomName}</span>
                    <span className={styles.itemSub}>{r.isDm ? 'DM' : '채널'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
