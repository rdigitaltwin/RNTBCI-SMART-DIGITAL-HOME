import { type Device, useDeviceStore } from '@/store';
import { DEVICE_TYPE_CONFIG, isDeviceConnected } from '../constants';
import DeviceToggle from './DeviceToggle';
import { Wifi, WifiOff } from 'lucide-react';
import api from '@/services/api';

interface DeviceCardProps {
  device: Device;
  onClick: () => void;
}

export default function DeviceCard({ device, onClick }: DeviceCardProps) {
  const config = DEVICE_TYPE_CONFIG[device.type] || { emoji: '📱', label: device.type, color: '#94A3B8' };
  const isConnected = isDeviceConnected(device);
  const isOn = isConnected && device.power_state === 'on';

  const handleToggleConnection = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newConnectivity = isConnected ? 'disconnected' : 'connected';
    const newStatus = isConnected ? 'offline' : 'online';
    const newPower = isConnected ? 'off' : device.power_state;

    useDeviceStore.getState().updateDevice(device.id, {
      connectivity: newConnectivity,
      status: newStatus,
      power_state: newPower,
    });

    try {
      await api.updateDevice(device.id, {
        connectivity: newConnectivity,
        status: newStatus,
      });
    } catch (err) {
      console.error('Failed to sync connectivity update', err);
    }
  };

  return (
    <div 
      className={`device-card ${isConnected ? device.status : 'offline'}`} 
      style={{ 
        position: 'relative', 
        cursor: 'pointer',
        transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s, opacity 0.2s',
        transform: isOn ? 'translateY(-2px)' : 'none',
        boxShadow: isOn ? `0 8px 24px -8px ${config.color}40` : 'none',
        opacity: isConnected ? 1 : 0.78,
        border: !isConnected ? '1px dashed rgba(255,255,255,0.12)' : undefined,
      }} 
      onClick={onClick}
    >
      {/* Status indicator line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: isConnected 
          ? `linear-gradient(90deg, transparent, ${config.color}, transparent)`
          : 'linear-gradient(90deg, transparent, #64748B, transparent)',
        opacity: isOn ? 1 : 0.3,
      }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: isConnected ? `${config.color}15` : 'rgba(255,255,255,0.03)', 
            border: `1px solid ${isConnected ? `${config.color}30` : 'rgba(255,255,255,0.08)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px',
            filter: !isConnected ? 'grayscale(0.6)' : 'none',
          }}>
            {config.emoji}
          </div>
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', lineHeight: 1.3 }}>{device.name}</h4>
            <span style={{ fontSize: '11px', color: '#64748B' }}>{config.label}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          {/* Simulation Status Badge */}
          {isConnected ? (
            <div 
              title="Device is connected — simulation and operations active"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '2px 8px', borderRadius: '10px',
                background: 'rgba(0, 255, 157, 0.1)', border: '1px solid rgba(0, 255, 157, 0.25)',
                color: '#00FF9D', fontSize: '10px', fontWeight: 600, letterSpacing: '0.3px',
              }}
            >
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#00FF9D', boxShadow: '0 0 6px #00FF9D' }} />
              SIM ACTIVE
            </div>
          ) : (
            <div 
              title="Device is not connected — simulation is not required"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '2px 8px', borderRadius: '10px',
                background: 'rgba(100, 116, 139, 0.15)', border: '1px solid rgba(100, 116, 139, 0.3)',
                color: '#94A3B8', fontSize: '10px', fontWeight: 600, letterSpacing: '0.3px',
              }}
            >
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#64748B' }} />
              SIM NOT REQ
            </div>
          )}

          {/* Quick Connect / Disconnect Button */}
          <button
            onClick={handleToggleConnection}
            title={isConnected ? 'Click to disconnect device' : 'Click to connect device'}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '2px 4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              fontSize: '10px',
              color: isConnected ? '#64748B' : '#00E5FF',
              textDecoration: 'none',
            }}
            onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            {isConnected ? (
              <>
                <Wifi size={11} color="#00FF9D" />
                <span style={{ color: '#94A3B8' }}>Connected</span>
              </>
            ) : (
              <>
                <WifiOff size={11} color="#EF4444" />
                <span style={{ color: '#00E5FF', fontWeight: 600 }}>Connect</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Power & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <DeviceToggle device={device} color={config.color} />
      </div>

      {/* Disconnected Notice Banner */}
      {!isConnected && (
        <div style={{
          marginTop: '12px',
          padding: '6px 10px',
          borderRadius: '8px',
          background: 'rgba(148, 163, 184, 0.05)',
          border: '1px solid rgba(148, 163, 184, 0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '11px',
          color: '#94A3B8',
        }}>
          <WifiOff size={12} color="#64748B" style={{ flexShrink: 0 }} />
          <span>Simulation not required (Disconnected)</span>
        </div>
      )}

      {device.type === 'energy_evse' && isConnected && (
        <div style={{ marginTop: '12px', display: 'flex', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '10px', color: '#64748B', marginBottom: '2px' }}>Voltage</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: isOn ? '#F8FAFC' : '#64748B', fontFamily: "'JetBrains Mono', monospace", transition: 'color 0.3s' }}>
              {isOn && device.metadata?.Voltage != null ? ((device.metadata.Voltage as number) / 1000).toFixed(1) + ' V' : '0.0 V'}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '10px', color: '#64748B', marginBottom: '2px' }}>Current</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: isOn ? '#F8FAFC' : '#64748B', fontFamily: "'JetBrains Mono', monospace", transition: 'color 0.3s' }}>
              {isOn && device.metadata?.ActiveCurrent != null ? ((device.metadata.ActiveCurrent as number) / 1000).toFixed(1) + ' A' : '0.0 A'}
            </div>
          </div>
        </div>
      )}

      {(device.type === 'solar_pv' || device.type === 'solar_panel' || device.type === 'energy_solar') && isConnected && (
        <div style={{ marginTop: '12px', display: 'flex', gap: '12px', background: 'rgba(252, 211, 77, 0.04)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(252, 211, 77, 0.15)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '10px', color: '#64748B', marginBottom: '2px' }}>Generation</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: isOn ? '#FCD34D' : '#64748B', fontFamily: "'JetBrains Mono', monospace", transition: 'color 0.3s' }}>
              {isOn ? (device.metadata?.ActivePower != null ? (Math.abs(device.metadata.ActivePower as number) / 1000).toFixed(2) + ' kW' : (device.energy_usage_kw ? Math.abs(device.energy_usage_kw).toFixed(2) + ' kW' : '4.69 kW')) : '0.00 kW'}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '10px', color: '#64748B', marginBottom: '2px' }}>Efficiency</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: isOn ? '#F8FAFC' : '#64748B', fontFamily: "'JetBrains Mono', monospace", transition: 'color 0.3s' }}>
              {device.metadata?.efficiency != null ? String(device.metadata.efficiency) + '%' : '22.5%'}
            </div>
          </div>
        </div>
      )}

      {/* Efficiency bar / Simulation indicator */}
      <div style={{ marginTop: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '10px', color: '#64748B' }}>
            {isConnected ? 'Efficiency' : 'Simulation'}
          </span>
          <span style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: isConnected ? '#94A3B8' : '#64748B' }}>
            {isConnected ? `${device.efficiency_percent || 90}%` : 'Not Required'}
          </span>
        </div>
        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            width: isConnected ? `${device.efficiency_percent || 90}%` : '0%',
            height: '100%',
            borderRadius: '2px',
            background: isConnected ? `linear-gradient(90deg, ${config.color}, ${config.color}80)` : '#475569',
            transition: 'width 0.5s',
          }} />
        </div>
      </div>
    </div>
  );
}

