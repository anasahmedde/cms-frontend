// useDeviceWebSocket.js
// Location: cms-frontend-staging/src/hooks/useDeviceWebSocket.js
// React Hook for Real-time Device Updates

import { useEffect, useState, useCallback, useRef } from 'react';
import { deviceWS } from '../api/websocket';

/**
 * React hook for WebSocket device updates
 * 
 * @example
 * function DeviceList() {
 *   const { 
 *     deviceArray, 
 *     isConnected, 
 *     onlineCount,
 *     subscribeAll 
 *   } = useDeviceWebSocket();
 * 
 *   useEffect(() => {
 *     subscribeAll();
 *   }, [subscribeAll]);
 * 
 *   return (
 *     <div>
 *       {isConnected ? '🟢 Live' : '🔴 Connecting...'}
 *       {deviceArray.map(d => <div key={d.mobile_id}>{d.device_name}</div>)}
 *     </div>
 *   );
 * }
 */
export function useDeviceWebSocket(autoConnect = true) {
  const [devices, setDevices] = useState(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const mountedRef = useRef(true);
  const connectedRef = useRef(false);

  // Connect on mount
  useEffect(() => {
    mountedRef.current = true;
    
    if (autoConnect) {
      const token = localStorage.getItem('digix_token') || localStorage.getItem('token');
      if (token && !connectedRef.current) {
        connectedRef.current = true;
        deviceWS.connect(token);
      }
    }

    // Connection handlers
    const handleConnected = () => {
      if (mountedRef.current) {
        setIsConnected(true);
        setConnectionError(null);
      }
    };
    
    const handleDisconnected = ({ code, reason }) => {
      if (mountedRef.current) {
        setIsConnected(false);
        if (code === 4001) {
          setConnectionError('Authentication failed');
        }
      }
    };

    const handleError = (data) => {
      if (mountedRef.current) {
        setConnectionError(data.message || 'Connection error');
      }
    };

    // Device list handler (initial load)
    const handleDeviceList = (data) => {
      if (!mountedRef.current) return;
      
      const deviceMap = new Map();
      (data.devices || []).forEach(device => {
        deviceMap.set(device.mobile_id, device);
      });
      setDevices(deviceMap);
      setLastUpdate(new Date());
    };

    // Individual device status update
    const handleDeviceStatus = (data) => {
      if (!mountedRef.current) return;
      
      setDevices(prev => {
        const next = new Map(prev);
        const existing = next.get(data.mobile_id) || {};
        next.set(data.mobile_id, { ...existing, ...data });
        return next;
      });
      setLastUpdate(new Date());
    };

    // Device online
    const handleDeviceOnline = (data) => {
      if (!mountedRef.current) return;
      
      setDevices(prev => {
        const next = new Map(prev);
        const existing = next.get(data.mobile_id) || {};
        next.set(data.mobile_id, { 
          ...existing, 
          mobile_id: data.mobile_id,
          device_name: data.device_name || existing.device_name,
          is_online: true,
          last_online_at: data.timestamp
        });
        return next;
      });
      setLastUpdate(new Date());
    };

    // Device offline
    const handleDeviceOffline = (data) => {
      if (!mountedRef.current) return;
      
      setDevices(prev => {
        const next = new Map(prev);
        const existing = next.get(data.mobile_id) || {};
        next.set(data.mobile_id, { 
          ...existing, 
          mobile_id: data.mobile_id,
          device_name: data.device_name || existing.device_name,
          is_online: false
        });
        return next;
      });
      setLastUpdate(new Date());
    };

    // Temperature update
    const handleDeviceTemperature = (data) => {
      if (!mountedRef.current) return;
      
      setDevices(prev => {
        const next = new Map(prev);
        const existing = next.get(data.mobile_id);
        if (existing) {
          next.set(data.mobile_id, { 
            ...existing, 
            temperature: data.temperature
          });
        }
        return next;
      });
    };

    // Download progress
    const handleDeviceDownload = (data) => {
      if (!mountedRef.current) return;
      
      setDevices(prev => {
        const next = new Map(prev);
        const existing = next.get(data.mobile_id);
        if (existing) {
          next.set(data.mobile_id, { 
            ...existing, 
            download_progress: data.progress
          });
        }
        return next;
      });
    };

    // Register listeners
    const unsubscribers = [
      deviceWS.on('connected', handleConnected),
      deviceWS.on('disconnected', handleDisconnected),
      deviceWS.on('error', handleError),
      deviceWS.on('deviceList', handleDeviceList),
      deviceWS.on('deviceStatus', handleDeviceStatus),
      deviceWS.on('deviceOnline', handleDeviceOnline),
      deviceWS.on('deviceOffline', handleDeviceOffline),
      deviceWS.on('deviceTemperature', handleDeviceTemperature),
      deviceWS.on('deviceDownload', handleDeviceDownload),
    ];

    // Check if already connected
    if (deviceWS.isConnected) {
      setIsConnected(true);
    }

    // Cleanup
    return () => {
      mountedRef.current = false;
      unsubscribers.forEach(unsub => unsub && unsub());
    };
  }, [autoConnect]);

  // Manual connect
  const connect = useCallback((token) => {
    if (!connectedRef.current) {
      connectedRef.current = true;
      deviceWS.connect(token || localStorage.getItem('digix_token') || localStorage.getItem('token'));
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    connectedRef.current = false;
    deviceWS.disconnect();
    setDevices(new Map());
    setIsConnected(false);
  }, []);

  // Subscribe to specific devices
  const subscribe = useCallback((deviceIds) => {
    deviceWS.subscribe(deviceIds);
  }, []);

  // Subscribe to all devices
  const subscribeAll = useCallback(() => {
    deviceWS.subscribeAll();
  }, []);

  // Unsubscribe from devices
  const unsubscribe = useCallback((deviceIds) => {
    deviceWS.unsubscribe(deviceIds);
  }, []);

  // Get a specific device
  const getDevice = useCallback((mobileId) => {
    return devices.get(mobileId);
  }, [devices]);

  // Get devices as array
  const deviceArray = Array.from(devices.values());

  // Get online/offline counts
  const onlineCount = deviceArray.filter(d => d.is_online).length;
  const offlineCount = deviceArray.filter(d => !d.is_online).length;
  const totalCount = deviceArray.length;

  return {
    // State
    devices,
    deviceArray,
    isConnected,
    lastUpdate,
    connectionError,
    
    // Counts
    onlineCount,
    offlineCount,
    totalCount,
    
    // Methods
    connect,
    disconnect,
    subscribe,
    subscribeAll,
    unsubscribe,
    getDevice,
  };
}

export default useDeviceWebSocket;
