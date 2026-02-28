// DeviceStatusIndicator.jsx
// Location: cms-frontend-staging/src/components/DeviceStatusIndicator.jsx
// Example component showing how to use the WebSocket hook
//
// You can integrate this into your existing Device.js component

import React, { useEffect } from 'react';
import { useDeviceWebSocket } from '../hooks/useDeviceWebSocket';

/**
 * Real-time connection status indicator
 * Add this to your dashboard header
 */
export function ConnectionStatus() {
  const { isConnected, onlineCount, offlineCount, totalCount } = useDeviceWebSocket();
  
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '16px',
      padding: '8px 16px',
      background: isConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
      borderRadius: '8px',
      fontSize: '14px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ 
          display: 'inline-block', 
          width: '10px', 
          height: '10px', 
          borderRadius: '50%',
          backgroundColor: isConnected ? '#10b981' : '#ef4444',
          animation: isConnected ? 'none' : 'pulse 1.5s infinite'
        }} />
        <span style={{ fontWeight: 500 }}>
          {isConnected ? 'Live Updates' : 'Reconnecting...'}
        </span>
      </div>
      
      {totalCount > 0 && (
        <div style={{ display: 'flex', gap: '12px', color: '#64748b' }}>
          <span>🟢 {onlineCount} online</span>
          <span>🔴 {offlineCount} offline</span>
        </div>
      )}
    </div>
  );
}


/**
 * Real-time device list
 * This shows devices updating in real-time
 */
export function LiveDeviceList() {
  const { 
    deviceArray, 
    isConnected, 
    subscribeAll,
    lastUpdate 
  } = useDeviceWebSocket();

  // Subscribe to all devices when component mounts
  useEffect(() => {
    if (isConnected) {
      subscribeAll();
    }
  }, [isConnected, subscribeAll]);

  return (
    <div>
      <div style={{ 
        marginBottom: '16px', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0 }}>Devices ({deviceArray.length})</h3>
        {lastUpdate && (
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Last update: {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>
      
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ textAlign: 'left', padding: '12px 8px' }}>Device</th>
            <th style={{ textAlign: 'center', padding: '12px 8px' }}>Status</th>
            <th style={{ textAlign: 'center', padding: '12px 8px' }}>Temperature</th>
            <th style={{ textAlign: 'right', padding: '12px 8px' }}>Last Seen</th>
          </tr>
        </thead>
        <tbody>
          {deviceArray.map(device => (
            <tr 
              key={device.mobile_id}
              style={{ 
                borderBottom: '1px solid #e5e7eb',
                transition: 'background 0.3s',
              }}
            >
              <td style={{ padding: '12px 8px' }}>
                <div style={{ fontWeight: 500 }}>
                  {device.device_name || device.mobile_id}
                </div>
                {device.device_name && (
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {device.mobile_id}
                  </div>
                )}
              </td>
              <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                <span style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 500,
                  backgroundColor: device.is_online ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: device.is_online ? '#059669' : '#dc2626'
                }}>
                  <span style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%',
                    backgroundColor: device.is_online ? '#10b981' : '#ef4444'
                  }} />
                  {device.is_online ? 'Online' : 'Offline'}
                </span>
              </td>
              <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                {device.temperature != null ? (
                  <span style={{
                    color: device.temperature > 50 ? '#dc2626' : 
                           device.temperature > 40 ? '#f59e0b' : '#059669'
                  }}>
                    {device.temperature.toFixed(1)}°C
                  </span>
                ) : (
                  <span style={{ color: '#9ca3af' }}>-</span>
                )}
              </td>
              <td style={{ textAlign: 'right', padding: '12px 8px', color: '#64748b', fontSize: '13px' }}>
                {device.last_online_at 
                  ? new Date(device.last_online_at).toLocaleString() 
                  : '-'
                }
              </td>
            </tr>
          ))}
          
          {deviceArray.length === 0 && (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                {isConnected ? 'No devices found' : 'Connecting...'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}


/**
 * HOW TO INTEGRATE INTO YOUR EXISTING Device.js:
 * 
 * 1. Import the hook:
 *    import { useDeviceWebSocket } from '../hooks/useDeviceWebSocket';
 * 
 * 2. In your component, use the hook:
 *    const { deviceArray, isConnected, subscribeAll, onlineCount } = useDeviceWebSocket();
 * 
 * 3. Subscribe on mount:
 *    useEffect(() => {
 *      if (isConnected) subscribeAll();
 *    }, [isConnected, subscribeAll]);
 * 
 * 4. Replace your polling logic with the real-time data:
 *    - Remove setInterval for fetching devices
 *    - Use deviceArray instead of your devices state
 *    - The devices will update automatically
 * 
 * 5. Add the ConnectionStatus indicator to your header:
 *    <ConnectionStatus />
 */

export default { ConnectionStatus, LiveDeviceList };
