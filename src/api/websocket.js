// websocket.js
// Location: cms-frontend-staging/src/api/websocket.js
// WebSocket Client for Real-time Device Status

const WS_RECONNECT_DELAY = 3000;
const WS_MAX_RECONNECT_ATTEMPTS = 10;

class DeviceWebSocket {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.listeners = new Map();
    this.subscriptions = new Set();
    this.isConnected = false;
    this.reconnectTimer = null;
    this.token = null;
  }

  /**
   * Connect to the WebSocket server
   * @param {string} token - Authentication token
   */
  connect(token) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected');
      return;
    }

    this.token = token;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.REACT_APP_API_HOST || window.location.hostname;
    const port = process.env.REACT_APP_WS_PORT || process.env.REACT_APP_API_PORT || '8005';
    
    const wsUrl = `${protocol}//${host}:${port}/ws/devices?token=${encodeURIComponent(token)}`;
    
    console.log('[WS] Connecting...');
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('[WS] Connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected', {});
      
      // Resubscribe if we had subscriptions
      if (this.subscriptions.size > 0) {
        this.subscribe(Array.from(this.subscriptions));
      }
    };
    
    this.ws.onclose = (event) => {
      console.log('[WS] Disconnected:', event.code, event.reason);
      this.isConnected = false;
      this.emit('disconnected', { code: event.code, reason: event.reason });
      
      // Don't reconnect if manually closed or auth error
      if (event.code === 4001) {
        console.log('[WS] Auth error, not reconnecting');
        return;
      }
      
      // Attempt to reconnect
      if (this.reconnectAttempts < WS_MAX_RECONNECT_ATTEMPTS && this.token) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectAttempts++;
          console.log(`[WS] Reconnecting... (attempt ${this.reconnectAttempts})`);
          this.connect(this.token);
        }, WS_RECONNECT_DELAY);
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('[WS] Error:', error);
      this.emit('error', { error });
    };
    
    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };
  }

  /**
   * Handle incoming WebSocket message
   */
  handleMessage(message) {
    const { type, data } = message;
    
    switch (type) {
      case 'connected':
        console.log('[WS] Server confirmed connection');
        break;
        
      case 'device_list':
        this.emit('deviceList', data);
        break;
        
      case 'device_status':
        this.emit('deviceStatus', data);
        break;
        
      case 'device_online':
        this.emit('deviceOnline', data);
        break;
        
      case 'device_offline':
        this.emit('deviceOffline', data);
        break;
        
      case 'device_temperature':
        this.emit('deviceTemperature', data);
        break;
        
      case 'device_download':
        this.emit('deviceDownload', data);
        break;
        
      case 'heartbeat':
        // Keep-alive, no action needed
        break;
        
      case 'subscribed':
      case 'unsubscribed':
        console.log('[WS]', type, data);
        break;
        
      case 'pong':
        // Response to ping
        break;
        
      case 'error':
        console.error('[WS] Server error:', data);
        this.emit('error', data);
        break;
        
      default:
        console.log('[WS] Unknown message type:', type, data);
    }
  }

  /**
   * Subscribe to device updates
   * @param {string|string[]} deviceIds - Device mobile_id(s) to subscribe to
   */
  subscribe(deviceIds) {
    if (!Array.isArray(deviceIds)) {
      deviceIds = [deviceIds];
    }
    
    deviceIds.forEach(id => this.subscriptions.add(id));
    
    if (this.isConnected) {
      this.send({
        type: 'subscribe',
        devices: deviceIds
      });
    }
  }

  /**
   * Subscribe to all device updates
   */
  subscribeAll() {
    if (this.isConnected) {
      this.send({
        type: 'subscribe',
        all: true
      });
    }
  }

  /**
   * Unsubscribe from device updates
   */
  unsubscribe(deviceIds) {
    if (!Array.isArray(deviceIds)) {
      deviceIds = [deviceIds];
    }
    
    deviceIds.forEach(id => this.subscriptions.delete(id));
    
    if (this.isConnected) {
      this.send({
        type: 'unsubscribe',
        devices: deviceIds
      });
    }
  }

  /**
   * Unsubscribe from all
   */
  unsubscribeAll() {
    this.subscriptions.clear();
    if (this.isConnected) {
      this.send({
        type: 'unsubscribe',
        all: true
      });
    }
  }

  /**
   * Send a ping to keep connection alive
   */
  ping() {
    this.send({ type: 'ping' });
  }

  /**
   * Send a message to the server
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[WS] Cannot send, not connected');
    }
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * Emit event to all listeners
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error('[WS] Listener error:', e);
        }
      });
    }
  }

  /**
   * Disconnect from the server
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.reconnectAttempts = WS_MAX_RECONNECT_ATTEMPTS; // Prevent reconnection
    this.token = null;
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.isConnected = false;
    this.subscriptions.clear();
    console.log('[WS] Disconnected manually');
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      subscriptionCount: this.subscriptions.size,
    };
  }
}

// Singleton instance
export const deviceWS = new DeviceWebSocket();
export default deviceWS;
