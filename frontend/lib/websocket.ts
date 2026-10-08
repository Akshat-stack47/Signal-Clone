import { WSEvent } from '@/types';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
type EventHandler = (event: WSEvent) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private token: string | null = null;
  private reconnectDelay = 2000;

  connect(token: string) {
    this.token = token;
    this.reconnectDelay = 2000;
    this._connect();
  }

  private _connect() {
    if (!this.token) return;
    if (this.ws?.readyState === WebSocket.OPEN) return;
    try {
      this.ws = new WebSocket(`${WS_BASE}/ws?token=${this.token}`);
      this.ws.onopen = () => {
        this.reconnectDelay = 2000;
        this._emit('connected', { type: 'connected', data: {} });
      };
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WSEvent;
          this._emit(data.type, data);
          this._emit('*', data);
        } catch { /* ignore */ }
      };
      this.ws.onclose = () => {
        this._emit('disconnected', { type: 'disconnected' as WSEvent['type'], data: {} });
        this._scheduleReconnect();
      };
      this.ws.onerror = () => this.ws?.close();
    } catch { this._scheduleReconnect(); }
  }

  private _scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
      this._connect();
    }, this.reconnectDelay);
  }

  send(message: object) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler) {
    this.handlers.get(event)?.delete(handler);
  }

  private _emit(event: string, data: WSEvent) {
    this.handlers.get(event)?.forEach((h) => h(data));
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.token = null;
    this.ws?.close();
    this.ws = null;
  }

  isConnected() { return this.ws?.readyState === WebSocket.OPEN; }
}

export const wsClient = new WebSocketClient();
