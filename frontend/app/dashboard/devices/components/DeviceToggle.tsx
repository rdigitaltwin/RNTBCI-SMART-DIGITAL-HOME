import { useState } from 'react';
import { Zap, WifiOff } from 'lucide-react';
import api from '@/services/api';
import { useDeviceStore, toggleDeviceState, type Device, DEFAULT_DEVICE_KW } from '@/store';
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
    try {
      await toggleDeviceState(device);
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
          if (!isConnected || !isOn) {
            return <>0<span style={{ fontSize: '10px', color: '#64748B', marginLeft: '2px' }}>W</span></>;
          }

          let powerW: number;

          if (device.type === 'ev_vehicle') {
            // Estimate EV driving power from average speed (~150 Wh/km efficiency)
            const meta = (device.metadata || {}) as any;
            const avgSpeed = meta.AvgSpeed as number | undefined;
            if (avgSpeed && avgSpeed > 0) {
              powerW = avgSpeed * 150; // Wh/km × km/h ≈ W
            } else {
              powerW = 7500; // Reasonable default: 7.5 kW typical EV draw
            }
          } else {
            const isSolar = device.type === 'solar_pv' || device.type === 'solar_panel' || device.type === 'energy_solar';
            const defaultSolarWatts = 4690;
            const fallbackKw = isSolar ? defaultSolarWatts / 1000 : (DEFAULT_DEVICE_KW[device.type] ?? 0.1);
            const usageKw = device.energy_usage_kw != null && device.energy_usage_kw !== 0
              ? Math.abs(device.energy_usage_kw) 
              : fallbackKw;
            powerW = usageKw * 1000;
          }

          if (powerW >= 1000) {
            return <>{(powerW / 1000).toFixed(2)}<span style={{ fontSize: '10px', color: '#64748B', marginLeft: '2px' }}>kW</span></>;
          } else {
            return <>{Math.round(powerW)}<span style={{ fontSize: '10px', color: '#64748B', marginLeft: '2px' }}>W</span></>;
          }
        })()}
      </span>
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
    </div>
  );
}

