'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const expiresAt = useAuthStore((s) => s.expiresAt);
  const clear = useAuthStore((s) => s.clear);

  useEffect(() => {
    if (expiresAt !== null && Date.now() > expiresAt) {
      clear();
      return;
    }
    if (!accessToken) router.replace('/login');
  }, [accessToken, expiresAt, clear, router]);

  if (!accessToken || (expiresAt !== null && Date.now() > expiresAt)) return null;
  return <>{children}</>;
}
