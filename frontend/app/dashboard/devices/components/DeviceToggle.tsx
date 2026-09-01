import { useState } from 'react';
import { Zap, WifiOff } from 'lucide-react';
import api from '@/services/api';
import { useDeviceStore, type Device } from '@/store';
import { useEnergyStore } from '@/store/energyEngine';
import { isDeviceConnected } from '../constants';

interface DeviceToggleProps {
  device: Device;
  color: string;
}

export default function DeviceToggle({ device, color }: DeviceToggleProps) {
  const [toggling, setToggling] = useState(false);
  const isConnected = isDeviceConnected(device);
  const isOn = isConnected && device.power_state === 'on';

  const handlePowerToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isConnected || toggling) return;
    setToggling(true);
    
    const newState = isOn ? 'off' : 'on';
    
    // Optimistic UI update
    useDeviceStore.getState().updateDevice(device.id, { power_state: newState });
    
    // Sync with local energy engine simulator so 3D model and Energy Command stay in sync
    const energyStore = useEnergyStore.getState();
    const energyDevice = Object.values(energyStore.devices).find(e => {
      const dName = device.name.toLowerCase();
      const eName = e.name.toLowerCase();
      if (dName === eName || dName.includes(eName) || eName.includes(dName)) return true;
      if (e.id === 'living_light_1' && dName.includes('living room main light')) return true;
      if (e.id === 'air_conditioner' && dName.includes('living room ac')) return true;
      if (e.id === 'bedroom_light' && dName.includes('master bedroom light')) return true;
      return false;
    });
    
    if (energyDevice && energyDevice.powerState !== newState) {
      // Pass skipBackendSync=true to avoid double API calls
      energyStore.toggleDevice(energyDevice.id, true);
    }

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
      <span 
        title={!isConnected ? 'Device disconnected — Simulation not required' : undefined}
        style={{
          fontFamily: "'Orbitron', monospace", fontSize: '16px', fontWeight: 700,
          color: isOn ? '#F8FAFC' : '#64748B',
        }}
      >
        {(() => {
          if (!isConnected) {
            return <>0<span style={{ fontSize: '10px', color: '#64748B', marginLeft: '2px' }}>W</span></>;
          }
          const powerW = (device.energy_usage_kw || 0) * 1000;
          if (powerW >= 1000) {
            return <>{(powerW / 1000).toFixed(2)}<span style={{ fontSize: '10px', color: '#64748B', marginLeft: '2px' }}>kW</span></>;
          } else {
            return <>{Math.round(powerW)}<span style={{ fontSize: '10px', color: '#64748B', marginLeft: '2px' }}>W</span></>;
          }
        })()}
      </span>
      {device.type !== 'energy_solar' && device.type !== 'solar_panel' && device.type !== 'solar_pv' && (
        <button 
          onClick={handlePowerToggle}
          disabled={!isConnected || toggling}
          title={!isConnected ? 'Cannot operate: Device is disconnected' : (isOn ? 'Turn OFF' : 'Turn ON')}
          style={{
            width: '44px', height: '24px', borderRadius: '12px',
            background: !isConnected 
              ? 'rgba(255,255,255,0.04)' 
              : (isOn ? `${color}40` : 'rgba(255,255,255,0.1)'),
            border: `1px solid ${!isConnected ? 'rgba(255,255,255,0.08)' : (isOn ? color : 'rgba(255,255,255,0.2)')}`,
            position: 'relative', 
            cursor: !isConnected ? 'not-allowed' : (toggling ? 'wait' : 'pointer'),
            opacity: !isConnected ? 0.45 : 1,
            marginLeft: '8px', transition: 'all 0.3s'
          }}
        >
          <div style={{
            width: '18px', height: '18px', borderRadius: '50%',
            background: !isConnected ? '#475569' : (isOn ? '#FFF' : '#94A3B8'), 
            position: 'absolute', top: '2px',
            left: isOn ? '22px' : '3px',
            transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }} />
        </button>
      )}
    </div>
  );
}

