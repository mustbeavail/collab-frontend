import styles from './MessageList.module.css';

const messages = [
  { id: 1, sender: '홍길동', avatar: '홍', time: '오후 2:30', content: '안녕하세요! 오늘 회의 시간이 언제인가요?' },
  { id: 2, sender: '김영희', avatar: '김', time: '오후 2:31', content: '오후 3시로 알고 있어요. 맞죠?' },
  { id: 3, sender: '이철수', avatar: '이', time: '오후 2:32', content: '네 맞습니다. 화상회의로 진행할 예정입니다.' },
  { id: 4, sender: '홍길동', avatar: '홍', time: '오후 2:33', content: '알겠습니다! 준비하겠습니다 😊' },
  { id: 5, sender: '김영희', avatar: '김', time: '오후 2:35', content: '회의 링크는 채널에 올려드릴게요.' },
];

export default function MessageList() {
  return (
    <div className={styles.list}>
      {messages.map(msg => (
        <div key={msg.id} className={styles.message}>
          <div className={styles.avatar}>{msg.avatar}</div>
          <div className={styles.body}>
            <div className={styles.meta}>
              <span className={styles.sender}>{msg.sender}</span>
              <span className={styles.time}>{msg.time}</span>
            </div>
            <p className={styles.content}>{msg.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
