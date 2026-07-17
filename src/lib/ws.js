// The ONE WebSocket client (singleton) — replaces the three legacy
// implementations. Events emitted by server message `type`: device_list,
// device_online, device_offline, device_temperature, pending_approvals,
// announcement, announcement_cleared — plus a synthetic "connection" event
// with {connected: boolean}.
import { WS_BASE_URL } from "./config";

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const AUTH_REJECTED_CODE = 4001; // server closes with 4001 on bad token — never retry

class WSClient {
  constructor() {
    this.socket = null;
    this.token = null;
    this.listeners = new Map(); // event -> Set<cb>
    this.backoff = INITIAL_BACKOFF_MS;
    this.reconnectTimer = null;
    this.closedByUser = false;
  }

  connect(token) {
    if (token && token !== this.token) {
      this.token = token;
      this._teardownSocket(); // token changed (re-login): drop the old socket
    }
    if (!this.token) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    this.closedByUser = false;

    let ws;
    try {
      ws = new WebSocket(`${WS_BASE_URL}/ws/devices?token=${encodeURIComponent(this.token)}`);
    } catch {
      this._scheduleReconnect();
      return;
    }
    this.socket = ws;

    ws.onopen = () => {
      this.backoff = INITIAL_BACKOFF_MS;
      try {
        ws.send(JSON.stringify({ type: "subscribe", all: true }));
      } catch {
        /* socket raced closed; onclose handles it */
      }
      this._emit("connection", { connected: true });
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return; // malformed frame — ignore
      }
      if (msg && msg.type) this._emit(msg.type, msg.data);
    };

    ws.onclose = (event) => {
      if (this.socket === ws) this.socket = null;
      this._emit("connection", { connected: false });
      if (this.closedByUser || event.code === AUTH_REJECTED_CODE) return;
      this._scheduleReconnect();
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* already closed */
      }
    };
  }

  disconnect() {
    this.closedByUser = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const hadSocket = !!this.socket;
    this._teardownSocket();
    this.backoff = INITIAL_BACKOFF_MS;
    if (hadSocket) this._emit("connection", { connected: false });
  }

  // Subscribe to an event; returns the unsubscribe function.
  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    const set = this.listeners.get(event);
    set.add(cb);
    return () => set.delete(cb);
  }

  isConnected() {
    return !!this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  _teardownSocket() {
    const ws = this.socket;
    this.socket = null;
    if (!ws) return;
    ws.onclose = null; // we own the lifecycle from here
    ws.onerror = null;
    try {
      ws.close();
    } catch {
      /* already closed */
    }
  }

  _scheduleReconnect() {
    if (this.reconnectTimer || this.closedByUser) return;
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  _emit(event, data) {
    const set = this.listeners.get(event);
    if (!set) return;
    set.forEach((cb) => {
      try {
        cb(data);
      } catch {
        /* one bad listener must not break the rest */
      }
    });
  }
}

export const wsClient = new WSClient();
