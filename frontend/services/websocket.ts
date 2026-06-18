/**
 * RNTBCI Smart Home Digital Twin - WebSocket Client
 *
 * Auto-reconnecting WebSocket with exponential backoff,
 * event deduplication, and Zustand store integration.
 */

import { useDeviceStore, useEventStore, useSimulationStore, useWSStore } from '@/store';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/api/v1/ws';

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private processedEvents = new Set<string>();
  private maxProcessedEvents = 5000;
  private token: string | null = null;
  private intentionalClose = false;

  connect(token?: string) {
    this.token = token || null;
    this.intentionalClose = false;
    this._connect();
  }

  disconnect() {
    this.intentionalClose = true;
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    useWSStore.getState().setConnected(false);
  }

  send(type: string, payload: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  subscribe(channel: string) {
    this.send('subscribe', { channel });
  }

  unsubscribe(channel: string) {
    this.send('unsubscribe', { channel });
  }

  private _connect() {
    try {
      const url = this.token ? `${WS_BASE}?token=${this.token}` : WS_BASE;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        useWSStore.getState().setConnected(true);

        // Subscribe to all channels
        this.subscribe('device:updates');
        this.subscribe('events:stream');
        this.subscribe('system:alerts');
        this.subscribe('system:metrics');
        this.subscribe('system:hems');
        this.subscribe('system:replay');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this._handleMessage(data);
        } catch {
          // Invalid JSON, ignore
        }
      };

      this.ws.onclose = () => {
        useWSStore.getState().setConnected(false);
        if (!this.intentionalClose) {
          this._reconnect();
        }
      };

      this.ws.onerror = () => {
        // Error will trigger onclose
      };
    } catch {
      this._reconnect();
    }
  }

  private _reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);

    setTimeout(() => this._connect(), delay);
  }

  private _handleMessage(data: Record<string, unknown>) {
    const { type, channel, payload, event_id } = data as {
      type: string;
      channel?: string;
      payload?: Record<string, unknown>;
      event_id?: string;
    };

    // Deduplication
    if (event_id) {
      if (this.processedEvents.has(event_id)) return;
      this.processedEvents.add(event_id);
      if (this.processedEvents.size > this.maxProcessedEvents) {
        const arr = Array.from(this.processedEvents);
        this.processedEvents = new Set(arr.slice(arr.length - 2500));
      }
    }

    useWSStore.getState().setLastMessage(data);

    if (type === 'ping') {
      this.send('pong', {});
      return;
    }

    if (type === 'connected') {
      const connId = (payload as Record<string, unknown>)?.connection_id as string;
      useWSStore.getState().setConnected(true, connId);
      return;
    }

    if (type !== 'update' || !payload) return;

    // Route by channel
    if (channel === 'device:updates') {
      const action = (payload as Record<string, unknown>).action as string;
      const deviceData = (payload as Record<string, unknown>).device as Record<string, unknown> | undefined;
      const deviceId = ((payload as Record<string, unknown>).device_id as string) ||
                       (deviceData?.id as string);

      if (deviceId && deviceData) {
        useDeviceStore.getState().updateDevice(deviceId, deviceData as Partial<import('@/store').Device>);
      }
    }

    if (channel === 'events:stream') {
      const eventData = payload as Record<string, unknown>;
      useEventStore.getState().addEvent({
        id: event_id || crypto.randomUUID(),
        device_id: eventData.device_id as string || '',
        device_name: eventData.device_name as string || '',
        event_type: eventData.event_type as string || '',
        severity: eventData.severity as string || 'info',
        message: eventData.message as string || '',
        timestamp: eventData.timestamp as string || new Date().toISOString(),
      });
    }

    if (channel === 'system:metrics') {
      useSimulationStore.getState().setMetrics(payload as Record<string, number>);
    }

    if (channel === 'system:replay') {
      const status = (payload as Record<string, unknown>).status as string;
      if (status === 'complete') {
        useSimulationStore.getState().setReplayMode(false);
      }
    }
  }
}

export const wsClient = new WebSocketClient();
export default wsClient;
