'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import { useAuthStore } from '@/store/authStore';

const StompContext = createContext<Client | null>(null);

export function useStompClient() {
  return useContext(StompContext);
}

function buildWsUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
  return base.replace(/^http/, 'ws') + '/ws';
}

export function StompProvider({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const clientRef = useRef<Client | null>(null);
  const [connectedClient, setConnectedClient] = useState<Client | null>(null);

  useEffect(() => {
    if (!accessToken) {
      clientRef.current?.deactivate();
      clientRef.current = null;
      setConnectedClient(null);
      return;
    }

    const c = new Client({
      brokerURL: buildWsUrl(),
      connectHeaders: { Authorization: `Bearer ${accessToken}` },
      reconnectDelay: 5000,
      onConnect: () => setConnectedClient(c),
      onDisconnect: () => setConnectedClient(null),
      onStompError: () => setConnectedClient(null),
    });

    c.activate();
    clientRef.current = c;

    return () => {
      c.deactivate();
      clientRef.current = null;
      setConnectedClient(null);
    };
  }, [accessToken]);

  return (
    <StompContext.Provider value={connectedClient}>
      {children}
    </StompContext.Provider>
  );
}
