'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './Sidebar.module.css';

const teams = [
  { id: 1, name: 'Team Alpha', initial: 'A' },
  { id: 2, name: 'Team Beta', initial: 'B' },
];

const friends = [
  { id: 1, name: '홍길동', online: true },
  { id: 2, name: '김영희', online: false },
  { id: 3, name: '이철수', online: true },
];

export default function Sidebar() {
  const [selectedTeam, setSelectedTeam] = useState(1);

  return (
    <aside className={styles.sidebar}>
      {/* 헤더 */}
      <div className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>C</div>
          <span className={styles.logoText}>Collab</span>
        </div>
        <button className={styles.iconBtn}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* 스크롤 영역 */}
      <div className={styles.scrollArea}>
        {/* 팀 */}
        <div>
          <p className={styles.sectionLabel}>팀</p>
          <div className={styles.itemList}>
            {teams.map(team => (
              <button
                key={team.id}
                onClick={() => setSelectedTeam(team.id)}
                className={`${styles.teamBtn} ${selectedTeam === team.id ? styles.teamBtnActive : ''}`}
              >
                <div className={`${styles.teamAvatar} ${selectedTeam === team.id ? styles.teamAvatarActive : ''}`}>
                  {team.initial}
                </div>
                <span className={styles.teamName}>{team.name}</span>
              </button>
            ))}
            <button className={styles.addBtn}>
              <div className={styles.addIcon}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className={styles.addText}>팀 만들기</span>
            </button>
          </div>
        </div>

        {/* 친구 */}
        <div>
          <p className={styles.sectionLabel}>친구</p>
          <div className={styles.itemList}>
            {friends.map(f => (
              <div key={f.id} className={styles.friendItem}>
                <div className={styles.avatarWrap}>
                  <div className={styles.friendAvatar}>{f.name[0]}</div>
                  <div className={`${styles.statusDot} ${f.online ? styles.online : styles.offline}`} />
                </div>
                <span className={styles.friendName}>{f.name}</span>
              </div>
            ))}
            <button className={styles.addBtn}>
              <div className={styles.addIcon}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className={styles.addText}>친구 추가</span>
            </button>
          </div>
        </div>
      </div>

      {/* 푸터 */}
      <div className={styles.footer}>
        <div className={styles.userCard}>
          <div className={styles.myAvatarWrap}>
            <div className={styles.myAvatar}>나</div>
            <div className={styles.myOnlineDot} />
          </div>
          <div className={styles.userInfo}>
            <p className={styles.userName}>내 이름</p>
            <p className={styles.userStatus}>온라인</p>
          </div>
          <Link href="/profile" className={styles.settingsLink}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>
      </div>
    </aside>
  );
}
