import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Server, Radio, Power, Download, Zap, Gauge, Wifi, WifiOff, ShieldAlert } from 'lucide-react';
import { useDeviceStore, type Device } from '@/store';
import { DEVICE_TYPE_CONFIG, isDeviceConnected } from '../constants';
import DeviceControls from './DeviceControls';
import DeviceToggle from './DeviceToggle';
import api from '@/services/api';

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
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (device && isDeviceConnected(device) && (device?.type === 'energy_solar' || device?.type === 'solar_panel' || device?.type === 'solar_pv')) {
      const fetchSolar = async () => {
        try {
          const [voltage, current, power, freq, pf, label] = (await Promise.all([
            api.getSolarVoltage(device.id).catch(() => ({})),
            api.getSolarCurrent(device.id).catch(() => ({})),
            api.getSolarPowerOutput(device.id).catch(() => ({})),
            api.getGridFrequency(device.id).catch(() => ({})),
            api.getPowerFactor(device.id).catch(() => ({})),
            api.getSolarUserLabel(device.id).catch(() => ({}))
          ])) as any[];
          
          const currentDevice = useDeviceStore.getState().devices.find(d => d.id === device.id);
          const currentMeta = (currentDevice?.metadata || {}) as any;

          useDeviceStore.getState().updateDevice(device.id, {
            metadata: {
              ...currentMeta,
              Voltage: voltage.Voltage || currentMeta?.Voltage,
              ActiveCurrent: current.ActiveCurrent || currentMeta?.ActiveCurrent,
              ActivePower: power.ActivePower || currentMeta?.ActivePower,
              Frequency: freq.Frequency || currentMeta?.Frequency,
              PowerFactor: pf.Voltage || pf.PowerFactor || currentMeta?.PowerFactor,
              LabelList: label.LabelList || currentMeta?.LabelList
            }
          });
        } catch (err) {
          console.error("Failed to fetch solar telemetry", err);
        }
      };
      fetchSolar();
    }
  }, [device?.id, device?.type, device?.status, device?.connectivity]);

  if (!device) return null;

  const config = DEVICE_TYPE_CONFIG[device.type] || { emoji: '📱', label: device.type, color: '#94A3B8' };
  const isConnected = isDeviceConnected(device);
  const isOn = isConnected && device.power_state === 'on';
  const meta = (device.metadata || {}) as any;

  const handleToggleConnection = async () => {
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
              background: isConnected ? `${config.color}15` : 'rgba(255,255,255,0.05)',
              border: `1px solid ${isConnected ? `${config.color}30` : 'rgba(255,255,255,0.1)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '24px',
              filter: !isConnected ? 'grayscale(0.6)' : 'none',
            }}>
              {config.emoji}
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#F8FAFC', margin: 0 }}>{device.name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                <span className={`status-dot ${isConnected ? device.status : 'offline'}`} style={{ width: '8px', height: '8px' }} />
                <span style={{ fontSize: '12px', color: isConnected ? '#94A3B8' : '#F87171', fontWeight: 500 }}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
                <span style={{ color: '#475569' }}>•</span>
                <span style={{ fontSize: '12px', color: config.color }}>{config.label}</span>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Connect/Disconnect action */}
            <button
              onClick={handleToggleConnection}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                background: isConnected ? 'rgba(239, 68, 68, 0.12)' : 'rgba(0, 229, 255, 0.15)',
                border: `1px solid ${isConnected ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0, 229, 255, 0.35)'}`,
                color: isConnected ? '#F87171' : '#00E5FF',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
            >
              {isConnected ? (
                <>
                  <WifiOff size={14} />
                  Disconnect
                </>
              ) : (
                <>
                  <Wifi size={14} />
                  Connect
                </>
              )}
            </button>

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
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Disconnected Notice Banner */}
          {!isConnected && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '16px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px',
            }}>
              <WifiOff size={22} color="#F87171" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#FCA5A5' }}>
                  Device Disconnected — Operations Disabled
                </div>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px', lineHeight: 1.5 }}>
                  This device is currently not connected to the network. <strong>Simulation is not required</strong> and all operations (power toggle, device control, and automated actions) are disabled until the device is reconnected.
                </div>
              </div>
            </div>
          )}

          {/* Main Power Control */}
          <div style={{ 
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '16px', padding: '20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            opacity: isConnected ? 1 : 0.6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '10px', background: isOn ? `${config.color}20` : 'rgba(255,255,255,0.05)', borderRadius: '12px', color: isOn ? config.color : '#64748B' }}>
                <Power size={20} />
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#F8FAFC', fontWeight: 500 }}>
                  {device.type === 'energy_solar' || device.type === 'solar_panel' || device.type === 'solar_pv' ? 'Power Generation' : 'Device Power'}
                </div>
                <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                  {!isConnected 
                    ? 'Operations disabled while disconnected' 
                    : (device.type === 'energy_solar' || device.type === 'solar_panel' || device.type === 'solar_pv' ? 'Real-time solar array output' : 'Toggle power state')}
                </div>
              </div>
            </div>
            <DeviceToggle device={device} color={config.color} />
          </div>

          {/* Specific Controls */}
          <div>
            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748B', marginBottom: '16px' }}>Device Controls</h3>
            <DeviceControls device={device} color={config.color} />
          </div>

          {/* Telemetry / Status */}
          <div>
            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748B', marginBottom: '16px' }}>Real-time Telemetry</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Activity size={14} color="#3B82F6" />
                  <span style={{ fontSize: '12px', color: '#94A3B8' }}>Simulation Status</span>
                </div>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: 600, 
                  color: isConnected ? '#00FF9D' : '#94A3B8',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isConnected ? '#00FF9D' : '#64748B' }} />
                  {isConnected ? 'Active' : 'Not Required'}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Radio size={14} color={isConnected ? "#10B981" : "#EF4444"} />
                  <span style={{ fontSize: '12px', color: '#94A3B8' }}>Connectivity</span>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#F8FAFC', textTransform: 'capitalize' }}>
                  {isConnected ? (device.connectivity || 'connected') : 'disconnected'}
                </div>
              </div>

              {isConnected && (
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Activity size={14} color="#3B82F6" />
                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>Efficiency</span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: '#F8FAFC', fontFamily: "'JetBrains Mono', monospace" }}>{device.efficiency_percent || 90}%</div>
                </div>
              )}

              {device.type === 'energy_evse' && isConnected && (
                <>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Zap size={14} color="#F59E0B" />
                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>Voltage</span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#F8FAFC', fontFamily: "'JetBrains Mono', monospace" }}>
                      {meta.Voltage != null ? (meta.Voltage / 1000).toFixed(1) + ' V' : '—'}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Gauge size={14} color="#3B82F6" />
                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>Current</span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#F8FAFC', fontFamily: "'JetBrains Mono', monospace" }}>
                      {meta.ActiveCurrent != null ? (meta.ActiveCurrent / 1000).toFixed(1) + ' A' : '—'}
                    </div>
                  </div>
                </>
              )}

              {(device.type === 'energy_solar' || device.type === 'solar_panel' || device.type === 'solar_pv') && isConnected && (
                <>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Panel Identification</div>
                        <div style={{ fontSize: '14px', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          Label: {meta.LabelList?.[0]?.value || 'Unknown'}
                          <button 
                            onClick={() => {
                              const newLabel = window.prompt("Enter new label value:", meta.LabelList?.[0]?.value || "");
                              if (newLabel) {
                                api.setSolarUserLabel(device.id, meta.LabelList?.[0]?.label || "name", newLabel);
                              }
                            }}
                            style={{ background: 'transparent', border: 'none', color: '#3B82F6', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline', padding: 0 }}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                      <button 
                        onClick={() => api.identifySolar(device.id)}
                        style={{
                          background: `${config.color}20`, border: `1px solid ${config.color}40`,
                          color: config.color, padding: '8px 16px', borderRadius: '8px',
                          cursor: 'pointer', fontSize: '12px', fontWeight: 500
                        }}
                      >
                        Trigger Identify
                      </button>
                    </div>
                  </div>
                  
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Zap size={14} color="#F59E0B" />
                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>Voltage</span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#F8FAFC', fontFamily: "'JetBrains Mono', monospace" }}>
                      {meta.Voltage != null ? (meta.Voltage / 1000).toFixed(1) + ' V' : '—'}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Gauge size={14} color="#3B82F6" />
                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>Current</span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#F8FAFC', fontFamily: "'JetBrains Mono', monospace" }}>
                      {meta.ActiveCurrent != null ? (meta.ActiveCurrent / 1000).toFixed(1) + ' A' : '—'}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Activity size={14} color="#10B981" />
                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>Frequency</span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#F8FAFC', fontFamily: "'JetBrains Mono', monospace" }}>
                      {meta.Frequency != null ? (meta.Frequency / 1000).toFixed(1) + ' Hz' : '—'}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Activity size={14} color="#8B5CF6" />
                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>Power Factor</span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#F8FAFC', fontFamily: "'JetBrains Mono', monospace" }}>
                      {meta.PowerFactor != null ? (meta.PowerFactor / 10000).toFixed(2) : '—'}
                    </div>
                  </div>
                </>
              )}

            </div>
          </div>

          {/* Metadata Dump (Logs/Sensors Placeholder) */}
          <div>
            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748B', marginBottom: '16px' }}>Sensor Values & Meta</h3>
            <div style={{ 
              background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', 
              border: '1px solid rgba(255,255,255,0.05)',
              fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#94A3B8',
              maxHeight: '200px', overflowY: 'auto', marginBottom: '16px'
            }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(meta, null, 2)}
              </pre>
            </div>

            <button
              onClick={() => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(device, null, 2));
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", dataStr);
                downloadAnchorNode.setAttribute("download", `device_${device.name.replace(/ /g, '_')}_logs.json`);
                document.body.appendChild(downloadAnchorNode);
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
              }}
              style={{
                width: '100%', padding: '12px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', color: '#F8FAFC',
                fontSize: '13px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              <Download size={16} />
              Download Device JSON Logs
            </button>
          </div>

        </div>
      </motion.div>
    </AnimatePresence>
  );
}

