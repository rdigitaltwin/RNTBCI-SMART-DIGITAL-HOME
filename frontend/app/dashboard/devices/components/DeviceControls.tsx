import { useState } from 'react';
import { WifiOff } from 'lucide-react';
import { type Device, useDeviceStore, useEventStore } from '@/store';
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
   const isOn = device.power_state === 'on';


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
            Operations cannot be performed while device is inactive (disconnected).
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
   const renderEVChargerControls = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
    {/* Start / Stop Charging */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
      <button
        onClick={() => handleControl('start_charging')}
        style={{ padding: '12px', borderRadius: '8px', background: '#10B98120', color: '#10B981', border: 'none', cursor: 'pointer', fontWeight: 600 }}
      >⚡ Start</button>
      <button
        onClick={() => handleControl('stop_charging')}
        style={{ padding: '12px', borderRadius: '8px', background: '#EF444420', color: '#EF4444', border: 'none', cursor: 'pointer', fontWeight: 600 }}
      >⏹ Stop</button>
    </div>

    {/* Charge Limit */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '13px', color: '#94A3B8' }}>Charge Limit</span>
        <span style={{ fontSize: '14px', color: '#F8FAFC' }}>{String(meta.charge_limit ?? 80)}%</span>
      </div>
      <input
        type="range" min="20" max="100" step="5"
        value={(meta.charge_limit as number) ?? 80}
        onChange={(e) => handleControl('set_charge_limit', { charge_limit: parseInt(e.target.value) })}
        style={{ width: '100%', accentColor: color }}
      />
    </div>

    {/* Charging Mode */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span style={{ fontSize: '13px', color: '#94A3B8' }}>Charging Mode</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {(['fast', 'eco', 'scheduled'] as const).map((mode) => (
          <button key={mode} onClick={() => handleControl('set_charging_mode', { mode })}
            style={{ padding: '8px', borderRadius: '8px', background: meta.charging_mode === mode ? `${color}30` : 'rgba(255,255,255,0.05)', color: meta.charging_mode === mode ? color : '#94A3B8', border: 'none', cursor: 'pointer', fontSize: '12px', textTransform: 'capitalize' }}
          >{mode}</button>
        ))}
      </div>
    </div>

    {/* Voltage & Current */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>Voltage</div>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#F8FAFC' }}>{String(meta.voltage ?? 0.0)} V</div>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>Current</div>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#F8FAFC' }}>{String(meta.current ?? 0.0)} A</div>
      </div>
    </div>
  </div>
);


  const renderWashingMachineControls = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
       <button onClick={() => handleControl('start')} style={{ padding: '8px', background: '#10B98120', color: '#10B981', borderRadius: '8px', border: 'none' }}>Start</button>
       <button onClick={() => handleControl('pause')} style={{ padding: '8px', background: '#F59E0B20', color: '#F59E0B', borderRadius: '8px', border: 'none' }}>Pause</button>
       <button onClick={() => handleControl('stop')} style={{ padding: '8px', background: '#EF444420', color: '#EF4444', borderRadius: '8px', border: 'none' }}>Stop</button>
    </div>
  );

  const renderSolarPVControls = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <button
          onClick={() => handleControl('turn_on')}
          style={{ padding: '12px', borderRadius: '8px', background: '#FCD34D20', color: '#FCD34D', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >☀️ Enable Generation</button>
        <button
          onClick={() => handleControl('turn_off')}
          style={{ padding: '12px', borderRadius: '8px', background: '#EF444420', color: '#EF4444', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >⏹ Disable</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>Peak Capacity</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#FCD34D' }}>{meta.peak_power != null ? String(meta.peak_power) + ' kW' : '5.0 kW'}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>Efficiency</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#F8FAFC' }}>{String(meta.efficiency || 22.5)}%</div>
        </div>
      </div>
    </div>
  );

  const evVehicleEndpoint = (device.metadata?.endpoint as number) ?? 1;

  const handleEVVehicleUpdate = async (
    field: string,
    label: string,
    apiGet: (id: string, endpoint: number) => Promise<unknown>,
    apiSet: (id: string, endpoint: number, value: number) => Promise<unknown>,
    metaKey: string,
    unit: string,
  ) => {
    const currentVal = (meta[metaKey] as number) ?? 0;
    const newValStr = window.prompt(`Enter new ${label} (${unit}):`, String(currentVal));
    if (newValStr === null) return;
    const newVal = parseFloat(newValStr);
    if (isNaN(newVal)) return;

    setLoading(true);
    try {
      await apiSet(device.id, evVehicleEndpoint, newVal);
      const currentMeta = useDeviceStore.getState().devices.find(d => d.id === device.id)?.metadata || {};
      useDeviceStore.getState().updateDevice(device.id, {
        metadata: { ...currentMeta, [metaKey]: newVal },
      });
      // Log event
      useEventStore.getState().addEvent({
        id: crypto.randomUUID(),
        device_id: device.id,
        device_name: device.name,
        event_type: 'value_update',
        severity: 'info',
        message: `${device.name}: ${label} updated to ${newVal} ${unit}`,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.error(`Failed to update ${label}:`, e);
    } finally {
      setLoading(false);
    }
  };

  const renderEVVehicleControls = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[
        { label: 'HV Battery Voltage', metaKey: 'HVBATVoltage', unit: 'V', apiGet: api.getEVVehicleHVBatVoltage.bind(api), apiSet: api.setEVVehicleHVBatVoltage.bind(api) },
        { label: 'HV State of Charge', metaKey: 'HVSoC', unit: '%', apiGet: api.getEVVehicleHVSoC.bind(api), apiSet: api.setEVVehicleHVSoC.bind(api) },
        { label: 'Auxiliary Battery Voltage', metaKey: 'AuxBatVoltage', unit: 'V', apiGet: api.getEVVehicleAuxBatVoltage.bind(api), apiSet: api.setEVVehicleAuxBatVoltage.bind(api) },
        { label: 'Average Speed', metaKey: 'AvgSpeed', unit: 'km/h', apiGet: api.getEVVehicleAvgSpeed.bind(api), apiSet: api.setEVVehicleAvgSpeed.bind(api) },
      ].map(({ label, metaKey, unit, apiGet, apiSet }) => (
        <div key={metaKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: isOn ? '#F8FAFC' : '#64748B', fontFamily: "'JetBrains Mono', monospace" }}>
              {isOn ? `${meta[metaKey] ?? 0} ${unit}` : `0 ${unit}`}
            </div>
          </div>
          <button
            onClick={() => handleEVVehicleUpdate(metaKey, label, apiGet, apiSet, metaKey, unit)}
            disabled={!isOn}
            style={{
              padding: '6px 14px', borderRadius: '8px',
              background: isOn ? `${color}20` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isOn ? `${color}40` : 'rgba(255,255,255,0.08)'}`,
              color: isOn ? color : '#64748B',
              cursor: isOn ? 'pointer' : 'not-allowed',
              fontSize: '12px', fontWeight: 600,
            }}
          >
            Update
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s', pointerEvents: loading ? 'none' : 'auto' }}>
      {device.type === 'hvac' && renderACControls()}
      {device.type === 'smart_light' && renderLightControls()}
      {device.type === 'door_lock' && renderDoorLockControls()}
      {device.type === 'washing_machine' && renderWashingMachineControls()}
      {device.type === 'energy_evse' && renderEVChargerControls()}
      {(device.type === 'solar_pv' || device.type === 'solar_panel' || device.type === 'energy_solar') && renderSolarPVControls()}
      {device.type === 'ev_vehicle' && renderEVVehicleControls()}

      {/* Fallback for others if needed */}
      {!['hvac', 'smart_light', 'door_lock', 'washing_machine', 'energy_evse', 'solar_pv', 'solar_panel', 'energy_solar', 'ev_vehicle'
      ].includes(device.type) && (
        <div style={{ fontSize: '13px', color: '#94A3B8', textAlign: 'center', padding: '16px' }}>
          Specific controls for {device.type} are not available.
        </div>
      )}
    </div>
  );
}

