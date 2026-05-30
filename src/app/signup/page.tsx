import Link from 'next/link';
import styles from './signup.module.css';

export default function SignupPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.logoArea}>
          <div className={styles.logoIcon}>C</div>
          <span className={styles.logoText}>Collab</span>
        </div>

        <div className={styles.card}>
          <h1 className={styles.title}>회원가입</h1>
          <p className={styles.subtitle}>팀과 함께 시작하세요</p>

          <form className={styles.form}>
            <div>
              <label className={styles.label}>아이디</label>
              <input type="text" placeholder="영문, 숫자 4~20자" className={styles.input} />
            </div>
            <div>
              <label className={styles.label}>비밀번호</label>
              <input type="password" placeholder="8자 이상" className={styles.input} />
            </div>
            <div>
              <label className={styles.label}>비밀번호 확인</label>
              <input type="password" placeholder="비밀번호 재입력" className={styles.input} />
            </div>
            <div>
              <label className={styles.label}>이메일</label>
              <input type="email" placeholder="example@email.com" className={styles.input} />
            </div>
            <div>
              <label className={styles.label}>닉네임</label>
              <input type="text" placeholder="표시될 이름" className={styles.input} />
            </div>
            <div>
              <label className={styles.label}>소개 (선택)</label>
              <textarea placeholder="자신을 소개해주세요" rows={3} className={styles.textarea} />
            </div>
            <button type="submit" className={styles.submitBtn}>가입하기</button>
          </form>

          <p className={styles.footer}>
            이미 계정이 있으신가요?{' '}
            <Link href="/" className={styles.link}>로그인</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
