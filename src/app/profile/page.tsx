import Link from 'next/link';
import styles from './profile.module.css';

export default function ProfilePage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link href="/" className={styles.backLink}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          돌아가기
        </Link>

        <div className={styles.card}>
          <div className={styles.avatarArea}>
            <div className={styles.avatarWrap}>
              <div className={styles.avatar}>나</div>
              <button className={styles.avatarEditBtn}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
            <p className={styles.avatarHint}>프로필 사진 변경</p>
          </div>

          <h1 className={styles.title}>회원정보 수정</h1>
          <p className={styles.subtitle}>내 계정 정보를 관리하세요</p>

          <form className={styles.form}>
            <div>
              <label className={styles.label}>아이디</label>
              <input type="text" defaultValue="my_id" disabled className={styles.input} />
            </div>
            <div>
              <label className={styles.label}>이메일</label>
              <input type="email" defaultValue="myemail@example.com" className={styles.input} />
            </div>
            <div>
              <label className={styles.label}>닉네임</label>
              <input type="text" defaultValue="내 닉네임" className={styles.input} />
            </div>
            <div>
              <label className={styles.label}>소개</label>
              <textarea defaultValue="안녕하세요!" rows={3} className={styles.textarea} />
            </div>

            <div className={styles.divider}>
              <p className={styles.sectionTitle}>비밀번호 변경</p>
              <div className={styles.pwFields}>
                <input type="password" placeholder="현재 비밀번호" className={styles.input} />
                <input type="password" placeholder="새 비밀번호" className={styles.input} />
                <input type="password" placeholder="새 비밀번호 확인" className={styles.input} />
              </div>
            </div>

            <button type="submit" className={styles.submitBtn}>저장하기</button>
            <button type="button" className={styles.dangerBtn}>회원 탈퇴</button>
          </form>
        </div>
      </div>
    </div>
  );
}
