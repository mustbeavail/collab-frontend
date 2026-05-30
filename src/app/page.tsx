import Sidebar from '@/components/layout/Sidebar';
import ChatArea from '@/components/layout/ChatArea';
import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.layout}>
      <Sidebar />
      <ChatArea />
    </div>
  );
}
