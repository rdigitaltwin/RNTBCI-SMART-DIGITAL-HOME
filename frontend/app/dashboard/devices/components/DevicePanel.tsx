import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Server, Radio, Power } from 'lucide-react';
import { type Device } from '@/store';
import { DEVICE_TYPE_CONFIG } from '../constants';
import DeviceControls from './DeviceControls';
import DeviceToggle from './DeviceToggle';

interface DevicePanelProps {
  device: Device | null;
  onClose: () => void;
}

export default function DevicePanel({ device, onClose }: DevicePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!device) return null;

  const config = DEVICE_TYPE_CONFIG[device.type] || { emoji: '📱', label: device.type, color: '#94A3B8' };
  const isOn = device.power_state === 'on';
  const meta = device.metadata || {};

  return (
    <AnimatePresence>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 999,
        }}
      />

      {/* Side Panel */}
      <motion.div
        ref={panelRef}
        initial={{ x: '100%', opacity: 0.5 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'tween', duration: 0.3, ease: 'easeInOut' }}
        style={{
          position: 'fixed',
          top: 0, right: 0, bottom: 0,
          width: '100%', maxWidth: '450px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          borderTopLeftRadius: '24px',
          borderBottomLeftRadius: '24px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ 
          padding: '24px', 
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: 'rgba(15, 23, 42, 0.95)', zIndex: 2
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '16px',
              background: `${config.color}15`, border: `1px solid ${config.color}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '24px',
            }}>
              {config.emoji}
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#F8FAFC', margin: 0 }}>{device.name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span className={`status-dot ${device.status}`} style={{ width: '8px', height: '8px' }} />
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>{device.status === 'online' ? 'Online' : 'Offline'}</span>
                <span style={{ color: '#475569' }}>•</span>
                <span style={{ fontSize: '12px', color: config.color }}>{config.label}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{ 
              background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer',
              padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Main Power Control */}
          <div style={{ 
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '16px', padding: '20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '10px', background: isOn ? `${config.color}20` : 'rgba(255,255,255,0.05)', borderRadius: '12px', color: isOn ? config.color : '#64748B' }}>
                <Power size={20} />
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#F8FAFC', fontWeight: 500 }}>Device Power</div>
                <div style={{ fontSize: '12px', color: '#94A3B8' }}>Toggle power state</div>
              </div>
            </div>
            <DeviceToggle device={device} color={config.color} />
          </div>

          {/* Specific Controls */}
          {isOn && (
            <div>
              <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748B', marginBottom: '16px' }}>Device Controls</h3>
              <DeviceControls device={device} color={config.color} />
            </div>
          )}

          {/* Telemetry / Status */}
          <div>
            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748B', marginBottom: '16px' }}>Real-time Telemetry</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Activity size={14} color="#3B82F6" />
                  <span style={{ fontSize: '12px', color: '#94A3B8' }}>Efficiency</span>
                </div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: '#F8FAFC', fontFamily: "'JetBrains Mono', monospace" }}>{device.efficiency_percent || 90}%</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Radio size={14} color="#10B981" />
                  <span style={{ fontSize: '12px', color: '#94A3B8' }}>Connection</span>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#F8FAFC', textTransform: 'capitalize' }}>{device.connectivity || 'wifi'}</div>
              </div>

            </div>
          </div>

          {/* Metadata Dump (Logs/Sensors Placeholder) */}
          <div>
            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748B', marginBottom: '16px' }}>Sensor Values & Meta</h3>
            <div style={{ 
              background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', 
              border: '1px solid rgba(255,255,255,0.05)',
              fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#94A3B8',
              maxHeight: '200px', overflowY: 'auto'
            }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(meta, null, 2)}
              </pre>
            </div>
          </div>

        </div>
      </motion.div>
    </AnimatePresence>
  );
}
