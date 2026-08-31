import { useState } from 'react';
import { WifiOff } from 'lucide-react';
import { type Device } from '@/store';
import api from '@/services/api';
import { isDeviceConnected } from '../constants';

interface DeviceControlsProps {
  device: Device;
  color: string;
}

export default function DeviceControls({ device, color }: DeviceControlsProps) {
  const [loading, setLoading] = useState(false);
  const isConnected = isDeviceConnected(device);
  const meta = device.metadata || {};

  const handleControl = async (command: string, params: Record<string, unknown> = {}) => {
    if (!isConnected) return;
    setLoading(true);
    try {
      await api.controlDevice(device.id, command, params);
    } catch (e) {
      console.error("Control failed:", e);
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div style={{
        padding: '16px',
        background: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <WifiOff size={20} color="#F87171" style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#FCA5A5' }}>Device Disconnected</div>
          <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
            Operations cannot be performed and simulation is not required while disconnected.
          </div>
        </div>
      </div>
    );
  }

  const renderACControls = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', color: '#94A3B8' }}>Temperature</span>
        <span style={{ fontSize: '14px', color: '#F8FAFC' }}>{String(meta.target_temperature || 22)}°C</span>
      </div>
      <input 
        type="range" 
        min="16" max="30" 
        value={(meta.target_temperature as number) || 22}
        onChange={(e) => handleControl('set_temperature', { target_temperature: parseInt(e.target.value) })}
        style={{ width: '100%', accentColor: color }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <button 
          onClick={() => handleControl('set_mode', { mode: 'cooling' })}
          style={{ padding: '8px', borderRadius: '8px', background: meta.mode === 'cooling' ? `${color}30` : 'rgba(255,255,255,0.05)', color: meta.mode === 'cooling' ? color : '#94A3B8', border: 'none', cursor: 'pointer' }}
        >Cooling</button>
        <button 
          onClick={() => handleControl('set_mode', { mode: 'heating' })}
          style={{ padding: '8px', borderRadius: '8px', background: meta.mode === 'heating' ? `${color}30` : 'rgba(255,255,255,0.05)', color: meta.mode === 'heating' ? color : '#94A3B8', border: 'none', cursor: 'pointer' }}
        >Heating</button>
      </div>
    </div>
  );

  const renderLightControls = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', color: '#94A3B8' }}>Brightness</span>
        <span style={{ fontSize: '14px', color: '#F8FAFC' }}>{String(meta.brightness || 100)}%</span>
      </div>
      <input 
        type="range" 
        min="0" max="100" 
        value={(meta.brightness as number) || 100}
        onChange={(e) => handleControl('set_brightness', { brightness: parseInt(e.target.value) })}
        style={{ width: '100%', accentColor: color }}
      />
    </div>
  );
  
  const renderDoorLockControls = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
      <button 
        onClick={() => handleControl('lock')}
        style={{ padding: '12px', borderRadius: '8px', background: meta.lock_state === 'locked' ? `${color}30` : 'rgba(255,255,255,0.05)', color: meta.lock_state === 'locked' ? color : '#94A3B8', border: 'none', cursor: 'pointer' }}
      >Lock</button>
      <button 
        onClick={() => handleControl('unlock')}
        style={{ padding: '12px', borderRadius: '8px', background: meta.lock_state === 'unlocked' ? '#10B98130' : 'rgba(255,255,255,0.05)', color: meta.lock_state === 'unlocked' ? '#10B981' : '#94A3B8', border: 'none', cursor: 'pointer' }}
      >Unlock</button>
    </div>
  );

  const renderWashingMachineControls = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
       <button onClick={() => handleControl('start')} style={{ padding: '8px', background: '#10B98120', color: '#10B981', borderRadius: '8px', border: 'none' }}>Start</button>
       <button onClick={() => handleControl('pause')} style={{ padding: '8px', background: '#F59E0B20', color: '#F59E0B', borderRadius: '8px', border: 'none' }}>Pause</button>
       <button onClick={() => handleControl('stop')} style={{ padding: '8px', background: '#EF444420', color: '#EF4444', borderRadius: '8px', border: 'none' }}>Stop</button>
    </div>
  );

  return (
    <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s', pointerEvents: loading ? 'none' : 'auto' }}>
      {device.type === 'hvac' && renderACControls()}
      {device.type === 'smart_light' && renderLightControls()}
      {device.type === 'door_lock' && renderDoorLockControls()}
      {device.type === 'washing_machine' && renderWashingMachineControls()}
      {/* Fallback for others if needed */}
      {!['hvac', 'smart_light', 'door_lock', 'washing_machine'].includes(device.type) && (
        <div style={{ fontSize: '13px', color: '#94A3B8', textAlign: 'center', padding: '16px' }}>
          Specific controls for {device.type} are not available.
        </div>
      )}
    </div>
  );
}

