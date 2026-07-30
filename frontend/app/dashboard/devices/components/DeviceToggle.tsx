import { useState } from 'react';
import { Zap } from 'lucide-react';
import api from '@/services/api';
import { useDeviceStore, type Device } from '@/store';

interface DeviceToggleProps {
  device: Device;
  color: string;
}

export default function DeviceToggle({ device, color }: DeviceToggleProps) {
  const [toggling, setToggling] = useState(false);
  const isOn = device.power_state === 'on';

  const handlePowerToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (toggling) return;
    setToggling(true);
    
    const newState = isOn ? 'off' : 'on';
    
    // Optimistic UI update
    useDeviceStore.getState().updateDevice(device.id, { power_state: newState });
    
    try {
      const status = newState.toUpperCase();
      const updatedDevice = await api.toggleState(device.id, status) as Partial<Device>;
      useDeviceStore.getState().updateDevice(device.id, updatedDevice);
    } catch (err) { 
      // Revert if API fails
      console.error('Failed to toggle device state', err);
      useDeviceStore.getState().updateDevice(device.id, { power_state: isOn ? 'on' : 'off' });
    } finally {
      setToggling(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <Zap size={14} color={isOn ? color : '#64748B'} />
      <span style={{
        fontFamily: "'Orbitron', monospace", fontSize: '16px', fontWeight: 700,
        color: isOn ? '#F8FAFC' : '#64748B',
      }}>
        {device.type === 'smart_light' ? ((device.energy_usage_kw || 0)).toFixed(1) : ((device.energy_usage_kw || 0) * 1000).toFixed(0)}<span style={{ fontSize: '10px', color: '#64748B', marginLeft: '2px' }}>W</span>
      </span>
      <button 
        onClick={handlePowerToggle}
        disabled={toggling}
        style={{
          width: '44px', height: '24px', borderRadius: '12px',
          background: isOn ? `${color}40` : 'rgba(255,255,255,0.1)',
          border: `1px solid ${isOn ? color : 'rgba(255,255,255,0.2)'}`,
          position: 'relative', cursor: toggling ? 'wait' : 'pointer',
          marginLeft: '8px', transition: 'all 0.3s'
        }}
      >
        <div style={{
          width: '18px', height: '18px', borderRadius: '50%',
          background: isOn ? '#FFF' : '#94A3B8', position: 'absolute', top: '2px',
          left: isOn ? '22px' : '3px',
          transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </button>
    </div>
  );
}
