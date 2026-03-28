import { useEffect, useRef, useState, useCallback } from 'react';

interface WSMessage {
  type: string;
  data: unknown;
  timestamp: string;
}

function getWebSocketUrl(): string {
  const configured = import.meta.env.VITE_WS_BASE_URL?.trim();

  if (configured) {
    const noTrailingSlash = configured.endsWith('/')
      ? configured.slice(0, -1)
      : configured;
    return noTrailingSlash.endsWith('/ws')
      ? noTrailingSlash
      : `${noTrailingSlash}/ws`;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const listenersRef = useRef<Map<string, Set<(data: unknown) => void>>>(new Map());

  useEffect(() => {
    const ws = new WebSocket(getWebSocketUrl());

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(() => { wsRef.current = null; }, 3000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        setLastMessage(msg);
        const handlers = listenersRef.current.get(msg.type);
        if (handlers) {
          handlers.forEach(handler => handler(msg.data));
        }
      } catch { /* ignore parse errors */ }
    };

    wsRef.current = ws;
    return () => { ws.close(); };
  }, []);

  const on = useCallback((event: string, handler: (data: unknown) => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(handler);
    return () => { listenersRef.current.get(event)?.delete(handler); };
  }, []);

  return { connected, lastMessage, on };
}
