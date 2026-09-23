import type { ConnectionStatus } from '../types';

export interface WebSocketEvent {
  event_type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

type EventListener = (event: WebSocketEvent) => void;
type StatusListener = (status: ConnectionStatus) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = 'DISCONNECTED';
  private eventListeners: Map<string, Set<EventListener>> = new Map();
  private statusListeners: Set<StatusListener> = new Set();
  private reconnectTimeout: number | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectDelay = 10000;
  private explicitDisconnect = false;

  constructor() {
    this.eventListeners.set('*', new Set());
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.explicitDisconnect = false;
    this.setStatus(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'DISCONNECTED');

    // Determine WS URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    // If running with Vite dev server on 5173, backend is on 8000
    const port = window.location.port === '5173' ? '8000' : (window.location.port ? window.location.port : '8000');
    const wsUrl = `${protocol}//${host}:${port}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('CONNECTED');
      };

      this.ws.onmessage = (messageEvent) => {
        try {
          const data = JSON.parse(messageEvent.data);
          if (data && data.event_type) {
            this.dispatchEvent(data as WebSocketEvent);
          }
        } catch {
          // ignore ping or malformed json
        }
      };

      this.ws.onclose = () => {
        this.ws = null;
        if (!this.explicitDisconnect) {
          this.scheduleReconnect();
        } else {
          this.setStatus('DISCONNECTED');
        }
      };

      this.ws.onerror = () => {
        if (this.ws) {
          this.ws.close();
        }
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.explicitDisconnect = true;
    if (this.reconnectTimeout !== null) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('DISCONNECTED');
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public on(eventType: string, listener: EventListener): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(listener);

    return () => {
      this.eventListeners.get(eventType)?.delete(listener);
    };
  }

  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((listener) => {
        try {
          listener(newStatus);
        } catch {
          // Ignore listener error
        }
      });
    }
  }

  private dispatchEvent(event: WebSocketEvent): void {
    // Notify specific event listeners
    const specificListeners = this.eventListeners.get(event.event_type);
    if (specificListeners) {
      specificListeners.forEach((l) => {
        try {
          l(event);
        } catch {
          // Ignore listener error
        }
      });
    }

    // Notify wildcard listeners
    const wildcardListeners = this.eventListeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach((l) => {
        try {
          l(event);
        } catch {
          // Ignore listener error
        }
      });
    }
  }

  private scheduleReconnect(): void {
    this.setStatus('RECONNECTING');
    this.reconnectAttempts += 1;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts - 1), this.maxReconnectDelay);

    if (this.reconnectTimeout !== null) {
      window.clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
    }, delay);
  }
}

export const wsClient = new WebSocketClient();
