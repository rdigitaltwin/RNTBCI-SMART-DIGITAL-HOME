import { useEffect, useRef, useState } from 'react';
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

// =============================================================================
// SENSOR META SECTION
// =============================================================================

// Fields that are already shown in the dedicated Real-time Telemetry cards above
// — omit them here to avoid duplication.
const ALREADY_SHOWN_FIELDS = new Set([
  'Voltage', 'ActiveCurrent', 'ActivePower',
  'HVBATVoltage', 'HVSoC', 'AuxBatVoltage', 'AvgSpeed',
  'Frequency', 'PowerFactor', 'LabelList',
  'current_generation',
  // internal simulation fields — not meaningful to users
  'sim_state', 'sim_phase', 'sim_power_kw', 'sim_power_kvar', 'sim_power_factor',
  '_last_real_telemetry_ts',
]);

// Fields classified as Matter/protocol metadata
const MATTER_FIELDS = new Set([
  'endpoint', 'matter_device_type', 'source', 'cluster',
  'State', 'SupplyState', 'FaultState',
  'ChargingEnabledUntil', 'MinimumChargeCurrent', 'MaximumChargeCurrent',
  'UserMaximumChargeCurrent', 'SessionDuration', 'SessionEnergyCharged',
  'StateOfCharge', 'NextChargeStartTime', 'NextChargeTargetTime',
  'NextChargeRequiredEnergy', 'NextChargeTargetSoC',
  'chargingTargetSchedules', 'IdentifyTriggered',
]);

// Fields classified as Electrical
const ELECTRICAL_FIELDS = new Set([
  'voltage', 'current', 'power', 'power_factor', 'frequency',
  'energy_usage', 'energy_kwh', 'rated_current', 'rated_voltage',
  'rated_power',
]);

function formatMetaValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length === 0 ? '(none)' : JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function MetaCard({ label, value, color = '#94A3B8' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)', padding: '12px 14px',
      borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>{label}</div>
      <div style={{
        fontSize: '13px', fontWeight: 600, color,
        fontFamily: "'JetBrains Mono', monospace",
        wordBreak: 'break-word',
      }}>{value}</div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.2px',
      color: '#475569', fontWeight: 600, marginBottom: '10px', marginTop: '4px',
    }}>{title}</div>
  );
}

interface SensorMetaSectionProps {
  meta: Record<string, unknown>;
  deviceType: string;
  deviceName: string;
  liveDevice: import('@/store').Device;
}

function SensorMetaSection({ meta, deviceType, deviceName, liveDevice }: SensorMetaSectionProps) {
  const [rawOpen, setRawOpen] = useState(false);

  // ---- Bucket each key into a category ----
  const electrical: [string, unknown][] = [];
  const matter: [string, unknown][] = [];
  const deviceSpecific: [string, unknown][] = [];

  for (const [k, v] of Object.entries(meta)) {
    if (ALREADY_SHOWN_FIELDS.has(k)) continue;
    if (v === undefined || v === null) continue;

    const kLower = k.toLowerCase();
    if (ELECTRICAL_FIELDS.has(kLower)) {
      electrical.push([k, v]);
    } else if (MATTER_FIELDS.has(k)) {
      matter.push([k, v]);
    } else {
      deviceSpecific.push([k, v]);
    }
  }

  const hasAny = electrical.length + matter.length + deviceSpecific.length > 0;

  // Human-readable label overrides
  const labelMap: Record<string, string> = {
    voltage: 'Voltage', current: 'Current', power: 'Power',
    power_factor: 'Power Factor', frequency: 'Frequency',
    energy_usage: 'Energy Usage', energy_kwh: 'Energy (kWh)',
    rated_current: 'Rated Current', rated_voltage: 'Rated Voltage',
    rated_power: 'Rated Power',
    endpoint: 'Endpoint ID', matter_device_type: 'Matter Type',
    source: 'Source', cluster: 'Cluster',
    State: 'EVSE State', SupplyState: 'Supply State', FaultState: 'Fault State',
    ChargingEnabledUntil: 'Charge Until', MinimumChargeCurrent: 'Min Current',
    MaximumChargeCurrent: 'Max Current', UserMaximumChargeCurrent: 'User Max Current',
    SessionDuration: 'Session Duration', SessionEnergyCharged: 'Session Energy',
    StateOfCharge: 'State of Charge', chargingTargetSchedules: 'Schedules',
    IdentifyTriggered: 'Identify',
    temperature: 'Temperature', target_temperature: 'Target Temp',
    door_state: 'Door State', cooling_status: 'Cooling Status',
    lock_state: 'Lock State', auto_lock: 'Auto Lock', auto_lock_delay: 'Auto Lock Delay',
    brightness: 'Brightness', color_temperature: 'Colour Temp',
    recording: 'Recording', motion_detection: 'Motion Detection', night_vision: 'Night Vision',
    motion_detected: 'Motion Detected',
    wash_mode: 'Wash Mode', spin_speed: 'Spin Speed', remaining_time: 'Remaining',
    running: 'Running', cycle: 'Cycle',
    capacity_kwh: 'Capacity', charge_level_percent: 'Charge Level',
    charge_rate_kw: 'Charge Rate', discharge_rate_kw: 'Discharge Rate',
    efficiency: 'Efficiency', peak_power: 'Peak Power',
    sunlight_intensity: 'Sunlight Intensity',
    trip_status: 'Trip Status', power_draw: 'Power Draw',
    HVBATVoltage: 'HV Battery Voltage', HVSoC: 'HV SoC',
    AuxBatVoltage: 'Aux Battery', AvgSpeed: 'Avg Speed',
    operating_mode: 'Operating Mode',
    rgb: 'RGB Colour',
    mode: 'Mode', fan_speed: 'Fan Speed',
    outdoor_temperature: 'Outdoor Temp',
    timer_seconds: 'Timer', power_level: 'Power Level',
    state: 'State', bandwidth: 'Bandwidth', clients: 'Clients',
    runtime_seconds: 'Runtime', mist_level: 'Mist Level',
  };

  function friendlyLabel(k: string): string {
    return labelMap[k] ?? k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function valueColor(k: string, v: unknown): string {
    if (k === 'State' || k === 'SupplyState') {
      const s = String(v);
      if (s.includes('Enabled') || s.includes('Charging')) return '#00FF9D';
      if (s.includes('Disabled')) return '#64748B';
      if (s.includes('Fault') || s.includes('Error')) return '#FF4D6D';
    }
    if (k === 'FaultState') return String(v) === 'NoError' ? '#00FF9D' : '#FF4D6D';
    if (k === 'lock_state') return String(v) === 'locked' ? '#3B82F6' : '#FFC857';
    if (k === 'recording' || k === 'motion_detection' || k === 'night_vision') return v ? '#00FF9D' : '#64748B';
    if (k === 'trip_status') return String(v) === 'normal' ? '#00FF9D' : '#FF4D6D';
    if (k === 'running') return v ? '#00FF9D' : '#64748B';
    if (typeof v === 'number') return '#F8FAFC';
    return '#94A3B8';
  }

  return (
    <div>
      <h3 style={{
        fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px',
        color: '#64748B', marginBottom: '16px',
      }}>Sensor Values & Meta</h3>

      {!hasAny ? (
        <div style={{
          background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.05)',
          fontSize: '12px', color: '#475569', fontStyle: 'italic', marginBottom: '12px',
        }}>
          No additional sensor data for this device type.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '12px' }}>

          {electrical.length > 0 && (
            <div>
              <SectionHeader title="Electrical" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {electrical.map(([k, v]) => (
                  <MetaCard key={k} label={friendlyLabel(k)} value={formatMetaValue(k, v)} color={valueColor(k, v)} />
                ))}
              </div>
            </div>
          )}

          {matter.length > 0 && (
            <div>
              <SectionHeader title="Protocol / Matter" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {matter.map(([k, v]) => (
                  <MetaCard key={k} label={friendlyLabel(k)} value={formatMetaValue(k, v)} color={valueColor(k, v)} />
                ))}
              </div>
            </div>
          )}

          {deviceSpecific.length > 0 && (
            <div>
              <SectionHeader title="Device" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {deviceSpecific.map(([k, v]) => (
                  <MetaCard key={k} label={friendlyLabel(k)} value={formatMetaValue(k, v)} color={valueColor(k, v)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Collapsed raw JSON for debugging */}
      <div style={{ marginBottom: '16px' }}>
        <button
          onClick={() => setRawOpen(o => !o)}
          style={{
            background: 'transparent', border: 'none', padding: '6px 0',
            color: '#475569', fontSize: '11px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          <span style={{
            display: 'inline-block', transition: 'transform 0.2s',
            transform: rawOpen ? 'rotate(90deg)' : 'rotate(0deg)',
          }}>▶</span>
          Raw metadata
        </button>
        {rawOpen && (
          <div style={{
            marginTop: '8px',
            background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.05)',
            fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: '#64748B',
            maxHeight: '180px', overflowY: 'auto',
          }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(meta, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* Download button — unchanged */}
      <button
        onClick={() => {
          const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(liveDevice, null, 2));
          const a = document.createElement('a');
          a.setAttribute('href', dataStr);
          a.setAttribute('download', `device_${deviceName.replace(/ /g, '_')}_logs.json`);
          document.body.appendChild(a);
          a.click();
          a.remove();
        }}
        style={{
          width: '100%', padding: '12px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px', color: '#F8FAFC',
          fontSize: '13px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          transition: 'all 0.2s',
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
        onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
      >
        <Download size={16} />
        Download Device JSON Logs
      </button>
    </div>
  );
}

export default function DevicePanel({ device, onClose }: DevicePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Subscribe to live device in Zustand store for 0ms real-time sync
  const storeDevice = useDeviceStore((s) => s.devices.find((d) => d.id === device?.id));
  const liveDevice = storeDevice || device;

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (liveDevice && isDeviceConnected(liveDevice) && (liveDevice?.type === 'energy_solar' || liveDevice?.type === 'solar_panel' || liveDevice?.type === 'solar_pv')) {
      const fetchSolar = async () => {
        try {
          const [voltage, current, power, freq, pf, label] = (await Promise.all([
            api.getSolarVoltage(liveDevice.id).catch(() => ({})),
            api.getSolarCurrent(liveDevice.id).catch(() => ({})),
            api.getSolarPowerOutput(liveDevice.id).catch(() => ({})),
            api.getGridFrequency(liveDevice.id).catch(() => ({})),
            api.getPowerFactor(liveDevice.id).catch(() => ({})),
            api.getSolarUserLabel(liveDevice.id).catch(() => ({}))
          ])) as any[];
          
          const currentDevice = useDeviceStore.getState().devices.find(d => d.id === liveDevice.id);
          const currentMeta = (currentDevice?.metadata || {}) as any;

          useDeviceStore.getState().updateDevice(liveDevice.id, {
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
  }, [liveDevice?.id, liveDevice?.type, liveDevice?.status, liveDevice?.connectivity]);

  // Fetch EV Vehicle telemetry when panel opens
  useEffect(() => {
    if (liveDevice && isDeviceConnected(liveDevice) && liveDevice?.type === 'ev_vehicle') {
      const evEndpoint = (liveDevice.metadata?.endpoint as number) ?? 1;
      const fetchEVVehicle = async () => {
        try {
          const [hvBat, hvSoc, auxBat, avgSpd] = (await Promise.all([
            api.getEVVehicleHVBatVoltage(liveDevice.id, evEndpoint).catch(() => ({})),
            api.getEVVehicleHVSoC(liveDevice.id, evEndpoint).catch(() => ({})),
            api.getEVVehicleAuxBatVoltage(liveDevice.id, evEndpoint).catch(() => ({})),
            api.getEVVehicleAvgSpeed(liveDevice.id, evEndpoint).catch(() => ({})),
          ])) as any[];

          const currentDevice = useDeviceStore.getState().devices.find(d => d.id === liveDevice.id);
          const currentMeta = (currentDevice?.metadata || {}) as any;

          useDeviceStore.getState().updateDevice(liveDevice.id, {
            metadata: {
              ...currentMeta,
              HVBATVoltage: hvBat.HVBATVoltage ?? currentMeta?.HVBATVoltage,
              HVSoC: hvSoc.HVSoC ?? currentMeta?.HVSoC,
              AuxBatVoltage: auxBat.AuxBatVoltage ?? currentMeta?.AuxBatVoltage,
              AvgSpeed: avgSpd.AvgSpeed ?? currentMeta?.AvgSpeed,
            }
          });
        } catch (err) {
          console.error("Failed to fetch EV Vehicle telemetry", err);
        }
      };
      fetchEVVehicle();
    }
  }, [liveDevice?.id, liveDevice?.type, liveDevice?.status, liveDevice?.connectivity]);

  if (!liveDevice) return null;

  const config = DEVICE_TYPE_CONFIG[liveDevice.type] || { emoji: '📱', label: liveDevice.type, color: '#94A3B8' };
  const isConnected = isDeviceConnected(liveDevice);
  const isOn = isConnected && liveDevice.power_state === 'on';
  const meta = (liveDevice.metadata || {}) as any;

  const handleToggleConnection = async () => {
    const newConnectivity = isConnected ? 'disconnected' : 'connected';
    const newStatus = isConnected ? 'offline' : 'online';
    const newPower = isConnected ? 'off' : liveDevice.power_state;

    useDeviceStore.getState().updateDevice(liveDevice.id, {
      connectivity: newConnectivity,
      status: newStatus,
      power_state: newPower,
    });

    try {
      await api.updateDevice(liveDevice.id, {
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
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#F8FAFC', margin: 0 }}>{liveDevice.name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                <span className={`status-dot ${isConnected ? liveDevice.status : 'offline'}`} style={{ width: '8px', height: '8px' }} />
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
                  {(() => {
                    const isPhysical = liveDevice.metadata?.is_physical === true || liveDevice.metadata?.source === 'mqtt' || liveDevice.metadata?.source === 'matter';
                    return isPhysical ? 'Device Disconnected — Operations Disabled' : 'Device Disconnected — Simulation Disabled';
                  })()}
                </div>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px', lineHeight: 1.5 }}>
                This device is currently not connected to the network. <strong>{(() => {
                    const isPhysical = liveDevice.metadata?.is_physical === true || liveDevice.metadata?.source === 'mqtt' || liveDevice.metadata?.source === 'matter';
                    return isPhysical ? 'Device is inactive' : 'Simulation is not required';
                  })()}</strong> and all operations (power toggle, device control, and automated actions) are disabled until the device is reconnected.
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
                  {liveDevice.type === 'energy_solar' || liveDevice.type === 'solar_panel' || liveDevice.type === 'solar_pv' ? 'Power Generation' : 'Device Power'}
                </div>
                <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                  {!isConnected 
                    ? 'Operations disabled while disconnected' 
                    : (liveDevice.type === 'energy_solar' || liveDevice.type === 'solar_panel' || liveDevice.type === 'solar_pv' ? 'Real-time solar array output' : 'Toggle power state')}
                </div>
              </div>
            </div>
            <DeviceToggle device={liveDevice} color={config.color} />
          </div>

          {/* Specific Controls */}
          <div>
            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748B', marginBottom: '16px' }}>Device Controls</h3>
            <DeviceControls device={liveDevice} color={config.color} />
          </div>

          {/* Telemetry / Status */}
          <div>
            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748B', marginBottom: '16px' }}>Real-time Telemetry</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Activity size={14} color="#3B82F6" />
                  <span style={{ fontSize: '12px', color: '#94A3B8' }}>Device Status</span>
                </div>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: 600, 
                  color: isConnected ? '#00FF9D' : '#94A3B8',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isConnected ? '#00FF9D' : '#64748B' }} />
                  {isConnected ? 'Active' : 'Inactive'}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Radio size={14} color={isConnected ? "#10B981" : "#EF4444"} />
                  <span style={{ fontSize: '12px', color: '#94A3B8' }}>Connectivity</span>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#F8FAFC', textTransform: 'capitalize' }}>
                  {isConnected ? (liveDevice.connectivity || 'connected') : 'disconnected'}
                </div>
              </div>

              {isConnected && (
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Activity size={14} color="#3B82F6" />
                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>Efficiency</span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: '#F8FAFC', fontFamily: "'JetBrains Mono', monospace" }}>{liveDevice.efficiency_percent || 90}%</div>
                </div>
              )}

              {liveDevice.type === 'energy_evse' && isConnected && (
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

              {(liveDevice.type === 'energy_solar' || liveDevice.type === 'solar_panel' || liveDevice.type === 'solar_pv') && isConnected && (
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
                                api.setSolarUserLabel(liveDevice.id, meta.LabelList?.[0]?.label || "name", newLabel);
                              }
                            }}
                            style={{ background: 'transparent', border: 'none', color: '#3B82F6', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline', padding: 0 }}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                      <button 
                        onClick={() => api.identifySolar(liveDevice.id)}
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

              {liveDevice.type === 'ev_vehicle' && isConnected && (
                <>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Zap size={14} color="#6366F1" />
                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>HV Battery Voltage</span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#F8FAFC', fontFamily: "'JetBrains Mono', monospace" }}>
                      {meta.HVBATVoltage != null ? meta.HVBATVoltage + ' V' : '—'}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Gauge size={14} color="#10B981" />
                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>HV State of Charge</span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#6366F1', fontFamily: "'JetBrains Mono', monospace" }}>
                      {meta.HVSoC != null ? meta.HVSoC + ' %' : '—'}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Zap size={14} color="#F59E0B" />
                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>Aux Battery Voltage</span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#F8FAFC', fontFamily: "'JetBrains Mono', monospace" }}>
                      {meta.AuxBatVoltage != null ? meta.AuxBatVoltage + ' V' : '—'}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Activity size={14} color="#3B82F6" />
                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>Average Speed</span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#F8FAFC', fontFamily: "'JetBrains Mono', monospace" }}>
                      {meta.AvgSpeed != null ? meta.AvgSpeed + ' km/h' : '—'}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Sensor Values & Meta — structured, categorised */}
          <SensorMetaSection
            meta={meta}
            deviceType={liveDevice.type}
            deviceName={liveDevice.name}
            liveDevice={liveDevice}
          />

        </div>
      </motion.div>
    </AnimatePresence>
  );
}
