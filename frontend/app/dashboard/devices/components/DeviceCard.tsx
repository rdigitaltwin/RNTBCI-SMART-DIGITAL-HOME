import { type Device } from '@/store';
import { DEVICE_TYPE_CONFIG } from '../constants';
import DeviceToggle from './DeviceToggle';

interface DeviceCardProps {
  device: Device;
  onClick: () => void;
}

export default function DeviceCard({ device, onClick }: DeviceCardProps) {
  const config = DEVICE_TYPE_CONFIG[device.type] || { emoji: '📱', label: device.type, color: '#94A3B8' };
  const isOn = device.power_state === 'on';

  return (
    <div 
      className={`device-card ${device.status}`} 
      style={{ 
        position: 'relative', 
        cursor: 'pointer',
        transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s',
        transform: isOn ? 'translateY(-2px)' : 'none',
        boxShadow: isOn ? `0 8px 24px -8px ${config.color}40` : 'none',
      }} 
      onClick={onClick}
    >
      {/* Status indicator line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: `linear-gradient(90deg, transparent, ${config.color}, transparent)`,
        opacity: isOn ? 1 : 0.3,
      }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: `${config.color}15`, border: `1px solid ${config.color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px',
          }}>
            {config.emoji}
          </div>
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', lineHeight: 1.3 }}>{device.name}</h4>
            <span style={{ fontSize: '11px', color: '#64748B' }}>{config.label}</span>
          </div>
        </div>
        <div className={`status-dot ${device.status}`} style={{ boxShadow: isOn ? `0 0 8px ${config.color}` : 'none' }} />
      </div>

      {/* Power & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <DeviceToggle device={device} color={config.color} />
      </div>

      {device.type === 'energy_evse' && (
        <div style={{ marginTop: '12px', display: 'flex', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '10px', color: '#64748B', marginBottom: '2px' }}>Voltage</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#F8FAFC', fontFamily: "'JetBrains Mono', monospace" }}>
              {device.metadata?.Voltage != null ? ((device.metadata.Voltage as number) / 1000).toFixed(1) + ' V' : '—'}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '10px', color: '#64748B', marginBottom: '2px' }}>Current</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#F8FAFC', fontFamily: "'JetBrains Mono', monospace" }}>
              {device.metadata?.ActiveCurrent != null ? ((device.metadata.ActiveCurrent as number) / 1000).toFixed(1) + ' A' : '—'}
            </div>
          </div>
        </div>
      )}

      {/* Efficiency bar */}
      <div style={{ marginTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '10px', color: '#64748B' }}>Efficiency</span>
          <span style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8' }}>
            {device.efficiency_percent || 90}%
          </span>
        </div>
        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            width: `${device.efficiency_percent || 90}%`, height: '100%',
            borderRadius: '2px',
            background: `linear-gradient(90deg, ${config.color}, ${config.color}80)`,
            transition: 'width 0.5s',
          }} />
        </div>
      </div>
    </div>
  );
}
