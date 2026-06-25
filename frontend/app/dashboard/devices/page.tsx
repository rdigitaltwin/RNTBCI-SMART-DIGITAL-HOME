'use client';

/**
 * RNTBCI Smart Home Digital Twin — Device Inventory Page
 *
 * Full device grid with filtering, search, and Iron Man-style device cards.
 * Each card shows real-time power, status, and device-specific metadata.
 */

import { useEffect, useState, useMemo } from 'react';
import {
  Search, Filter, Power, Zap, Thermometer, Wifi, Lock,
  Eye, ChevronDown, ToggleLeft, ToggleRight, RefreshCw, Plus, X,
} from 'lucide-react';
import api from '@/services/api';
import { useDeviceStore, type Device } from '@/store';

// =============================================================================
// DEVICE TYPE CONFIG
// =============================================================================

const DEVICE_TYPE_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  smart_light: { emoji: '💡', label: 'Smart Light', color: '#FFC857' },
  smart_switch: { emoji: '🔌', label: 'Smart Switch', color: '#94A3B8' },
  smart_plug: { emoji: '🔌', label: 'Smart Plug', color: '#8B5CF6' },
  door_lock: { emoji: '🔒', label: 'Door Lock', color: '#3B82F6' },
  garage_door: { emoji: '🚗', label: 'Garage Door', color: '#6366F1' },
  hvac: { emoji: '❄️', label: 'HVAC', color: '#00B4D8' },
  washing_machine: { emoji: '🧺', label: 'Washing Machine', color: '#06B6D4' },
  dishwasher: { emoji: '🍽️', label: 'Dishwasher', color: '#14B8A6' },
  refrigerator: { emoji: '🧊', label: 'Refrigerator', color: '#22D3EE' },
  water_heater: { emoji: '🔥', label: 'Water Heater', color: '#F97316' },
  nebulizer: { emoji: '💨', label: 'Nebulizer', color: '#A78BFA' },
  router: { emoji: '📡', label: 'Router', color: '#10B981' },
  camera: { emoji: '📷', label: 'Camera', color: '#EF4444' },
  smart_tv: { emoji: '📺', label: 'Smart TV', color: '#EC4899' },
};

// =============================================================================
// DEVICE CARD
// =============================================================================

function DeviceCard({ device }: { device: Device }) {
  const [toggling, setToggling] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const config = DEVICE_TYPE_CONFIG[device.type] || { emoji: '📱', label: device.type, color: '#94A3B8' };
  const isOn = device.power_state === 'on';
  const meta = device.metadata || {};

  const handlePowerToggle = async () => {
    setToggling(true);
    try {
      const newState = isOn ? 'off' : 'on';
      await api.togglePower(device.id, newState);
      useDeviceStore.getState().updateDevice(device.id, { power_state: newState });
    } catch { /* API not connected */ }
    setToggling(false);
  };

  const handleControl = async (command: string, params: Record<string, unknown> = {}) => {
    // Optimistic UI update
    const currentMeta = device.metadata || {};
    const newMeta = { ...currentMeta, ...params };
    useDeviceStore.getState().updateDevice(device.id, { metadata: newMeta });
    
    try {
      await api.controlDevice(device.id, command, params);
    } catch {
      // API not connected
    }
  };

  const getDeviceInfo = () => {
    switch (device.type) {
      case 'hvac':
        return `${(meta.temperature as number)?.toFixed(1) || '—'}°C → ${meta.target_temperature || '—'}°C • ${meta.fan_speed || 'auto'}`;
      case 'refrigerator':
        return `${(meta.temperature as number)?.toFixed(1) || '—'}°C • ${meta.cooling_status || 'standby'}`;
      case 'router':
        return `↓${meta.download_speed || '—'} ↑${meta.upload_speed || '—'} Mbps • ${meta.connected_clients || 0} clients`;
      case 'smart_light':
        return `Brightness: ${meta.brightness || 0}% • ${(meta.color_temperature as number) || 4000}K`;
      case 'water_heater':
        return `${(meta.temperature as number)?.toFixed(1) || '—'}°C → ${meta.target_temperature || '—'}°C`;
      case 'door_lock':
        return `${meta.lock_state || 'unknown'} • Auto-lock: ${meta.auto_lock ? 'ON' : 'OFF'}`;
      case 'camera':
        return `Recording: ${meta.recording ? 'ON' : 'OFF'} • Night: ${meta.night_vision ? 'ON' : 'OFF'}`;
      case 'smart_tv':
        return `Volume: ${meta.volume || 0} • Source: ${meta.input_source || 'hdmi1'}`;
      case 'washing_machine':
        return meta.running ? `Running • ${meta.remaining_time || 0}s remaining` : 'Idle';
      case 'garage_door':
        return `Position: ${meta.position || 'closed'}`;
      default:
        return isOn ? 'Active' : 'Standby';
    }
  };

  return (
    <div className={`device-card ${device.status}`} style={{ position: 'relative' }}>
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
        <div className={`status-dot ${device.status}`} />
      </div>

      {/* Device Info */}
      <div style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: '11px',
        color: '#94A3B8', marginBottom: '16px', lineHeight: 1.5,
        minHeight: '32px',
      }}>
        {getDeviceInfo()}
      </div>

      {/* Power & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Zap size={14} color={isOn ? '#FFC857' : '#64748B'} />
          <span style={{
            fontFamily: "'Orbitron', monospace", fontSize: '16px', fontWeight: 700,
            color: isOn ? '#F8FAFC' : '#64748B',
          }}>
            {isOn ? `${(device.energy_usage_kw * 1000).toFixed(0)}` : '0'}
          </span>
          <span style={{ fontSize: '11px', color: '#64748B' }}>W</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            onClick={() => setExpanded(!expanded)} 
            style={{ 
              background: 'none', border: '1px solid rgba(255,255,255,0.1)', 
              borderRadius: '14px', width: '28px', height: '28px', 
              color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', 
              cursor: 'pointer', transition: 'all 0.3s',
              background: expanded ? 'rgba(255,255,255,0.05)' : 'transparent'
            }}
          >
            <ChevronDown size={14} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
          </button>
          
          <button
            onClick={handlePowerToggle}
            disabled={toggling}
            style={{
              width: '48px', height: '28px', borderRadius: '14px',
              background: isOn
                ? `linear-gradient(135deg, ${config.color}, ${config.color}CC)`
                : 'rgba(100, 116, 139, 0.2)',
              border: `1px solid ${isOn ? config.color + '50' : 'rgba(100, 116, 139, 0.3)'}`,
              cursor: 'pointer', position: 'relative',
              transition: 'all 0.3s',
              boxShadow: isOn ? `0 0 12px ${config.color}40` : 'none',
              opacity: toggling ? 0.5 : 1,
            }}
          >
            <div style={{
              width: '22px', height: '22px', borderRadius: '50%',
              background: '#FFF', position: 'absolute', top: '2px',
              left: isOn ? '23px' : '2px',
              transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          </button>
        </div>
      </div>

      {/* Advanced Controls Dropdown */}
      {expanded && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', animation: 'fadeIn 0.2s ease-out' }}>
          {device.type === 'smart_light' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>Brightness</span>
                  <span style={{ fontSize: '11px', color: '#F8FAFC' }}>{meta.brightness as number || 0}%</span>
                </div>
                <input type="range" min="0" max="100" value={meta.brightness as number || 0} onChange={(e) => handleControl('set_brightness', { brightness: parseInt(e.target.value) })} style={{ width: '100%', accentColor: config.color }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>Color Temp</span>
                  <span style={{ fontSize: '11px', color: '#F8FAFC' }}>{meta.color_temperature as number || 4000}K</span>
                </div>
                <input type="range" min="2700" max="6500" step="100" value={meta.color_temperature as number || 4000} onChange={(e) => handleControl('set_color_temp', { color_temperature: parseInt(e.target.value) })} style={{ width: '100%', accentColor: config.color }} />
              </div>
            </div>
          )}

          {device.type === 'hvac' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>Target Temp</span>
                  <span style={{ fontSize: '11px', color: '#F8FAFC' }}>{meta.target_temperature as number || 22}°C</span>
                </div>
                <input type="range" min="16" max="30" step="0.5" value={meta.target_temperature as number || 22} onChange={(e) => handleControl('set_temperature', { target_temperature: parseFloat(e.target.value) })} style={{ width: '100%', accentColor: config.color }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <select value={meta.mode as string || 'cooling'} onChange={(e) => handleControl('set_mode', { mode: e.target.value })} style={{ width: '100%', padding: '6px', borderRadius: '6px', background: 'rgba(11, 17, 32, 0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#F8FAFC', fontSize: '11px', outline: 'none' }}>
                  <option value="cooling">Cooling</option>
                  <option value="heating">Heating</option>
                  <option value="auto">Auto</option>
                  <option value="fan_only">Fan Only</option>
                </select>
                <select value={meta.fan_speed as string || 'auto'} onChange={(e) => handleControl('set_fan', { fan_speed: e.target.value })} style={{ width: '100%', padding: '6px', borderRadius: '6px', background: 'rgba(11, 17, 32, 0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#F8FAFC', fontSize: '11px', outline: 'none' }}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="auto">Auto</option>
                </select>
              </div>
            </div>
          )}

          {device.type === 'door_lock' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>Lock State</span>
                <button onClick={() => handleControl(meta.lock_state === 'locked' ? 'unlock' : 'lock', { lock_state: meta.lock_state === 'locked' ? 'unlocked' : 'locked' })} style={{ padding: '6px 12px', borderRadius: '6px', background: meta.lock_state === 'locked' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)', border: `1px solid ${meta.lock_state === 'locked' ? '#3B82F6' : '#EF4444'}`, color: meta.lock_state === 'locked' ? '#3B82F6' : '#EF4444', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                  {meta.lock_state === 'locked' ? 'LOCKED' : 'UNLOCKED'}
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>Auto-Lock</span>
                <button onClick={() => handleControl('set_auto_lock', { auto_lock: !meta.auto_lock })} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  {meta.auto_lock ? <ToggleRight size={24} color={config.color} /> : <ToggleLeft size={24} color="#64748B" />}
                </button>
              </div>
            </div>
          )}

          {device.type === 'camera' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>Recording</span>
                <button onClick={() => handleControl('set_recording', { recording: !meta.recording })} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  {meta.recording ? <ToggleRight size={24} color={config.color} /> : <ToggleLeft size={24} color="#64748B" />}
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>Night Vision</span>
                <button onClick={() => handleControl('set_night_vision', { night_vision: !meta.night_vision })} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  {meta.night_vision ? <ToggleRight size={24} color={config.color} /> : <ToggleLeft size={24} color="#64748B" />}
                </button>
              </div>
            </div>
          )}

          {device.type === 'washing_machine' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>Cycle Mode</span>
                <select value={meta.wash_mode as string || 'normal'} onChange={(e) => handleControl('set_wash_mode', { wash_mode: e.target.value })} style={{ width: '120px', padding: '6px', borderRadius: '6px', background: 'rgba(11, 17, 32, 0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#F8FAFC', fontSize: '11px', outline: 'none' }}>
                  <option value="normal">Normal</option>
                  <option value="quick">Quick Wash</option>
                  <option value="heavy">Heavy Duty</option>
                  <option value="delicate">Delicate</option>
                </select>
              </div>
            </div>
          )}
          
          {!['smart_light', 'hvac', 'door_lock', 'camera', 'washing_machine'].includes(device.type) && (
            <div style={{ textAlign: 'center', color: '#64748B', fontSize: '12px', padding: '8px' }}>
              No advanced controls available for this device type.
            </div>
          )}
        </div>
      )}

      {/* Efficiency bar */}
      <div style={{ marginTop: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '10px', color: '#64748B' }}>Efficiency</span>
          <span style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8' }}>
            {device.efficiency_percent?.toFixed(0) || 90}%
          </span>
        </div>
        <div style={{
          width: '100%', height: '3px', borderRadius: '2px',
          background: 'rgba(255,255,255,0.05)',
        }}>
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

// =============================================================================
// DEVICE ONBOARDING MODAL
// =============================================================================

function DeviceOnboardingModal({ isOpen, onClose, onAdd }: { isOpen: boolean; onClose: () => void; onAdd: (d: any) => void }) {
  const rooms = useDeviceStore((s) => s.rooms);
  const [formData, setFormData] = useState({
    name: '',
    type: 'smart_light',
    room_id: '',
    position_x: 0,
    position_y: 0,
    position_z: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize room_id if rooms are loaded
  useEffect(() => {
    if (rooms.length > 0 && !formData.room_id) {
      setFormData(prev => ({ ...prev, room_id: rooms[0].id }));
    }
  }, [rooms, formData.room_id]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.name.trim()) {
      setError('Device name is required');
      return;
    }
    setLoading(true);
    try {
      const res = await api.createDevice({
        ...formData,
        metadata: {},
      });
      onAdd(res);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create device');
    }
    setLoading(false);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(5, 8, 22, 0.8)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, animation: 'fadeIn 0.2s ease-out'
    }}>
      <div className="glass-card" style={{
        width: '100%', maxWidth: '500px', padding: '24px',
        border: '1px solid rgba(0, 229, 255, 0.3)',
        boxShadow: '0 0 32px rgba(0, 229, 255, 0.1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#F8FAFC' }}>Register New Device</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(255, 77, 109, 0.1)', border: '1px solid #FF4D6D', color: '#FF4D6D', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Device Name</label>
            <input 
              type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. Master Bedroom AC"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(11, 17, 32, 0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#F8FAFC', fontSize: '14px', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Device Type</label>
              <select 
                value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(11, 17, 32, 0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#F8FAFC', fontSize: '14px', outline: 'none', appearance: 'none' }}
              >
                {Object.keys(DEVICE_TYPE_CONFIG).map(type => (
                  <option key={type} value={type} style={{ background: '#0B1120' }}>
                    {DEVICE_TYPE_CONFIG[type].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Room</label>
              <select 
                value={formData.room_id} onChange={(e) => setFormData({...formData, room_id: e.target.value})}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(11, 17, 32, 0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#F8FAFC', fontSize: '14px', outline: 'none', appearance: 'none' }}
              >
                {rooms.map(room => (
                  <option key={room.id} value={room.id} style={{ background: '#0B1120' }}>
                    {room.name}
                  </option>
                ))}
                {rooms.length === 0 && <option value="" disabled>No rooms available</option>}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Position (X, Y, Z)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <input type="number" step="0.1" value={formData.position_x} onChange={(e) => setFormData({...formData, position_x: parseFloat(e.target.value) || 0})} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(11, 17, 32, 0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#F8FAFC', fontSize: '14px', outline: 'none' }} />
              <input type="number" step="0.1" value={formData.position_y} onChange={(e) => setFormData({...formData, position_y: parseFloat(e.target.value) || 0})} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(11, 17, 32, 0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#F8FAFC', fontSize: '14px', outline: 'none' }} />
              <input type="number" step="0.1" value={formData.position_z} onChange={(e) => setFormData({...formData, position_z: parseFloat(e.target.value) || 0})} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(11, 17, 32, 0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#F8FAFC', fontSize: '14px', outline: 'none' }} />
            </div>
          </div>

          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 16px', borderRadius: '8px', background: 'transparent', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
              Cancel
            </button>
            <button type="submit" disabled={loading || !formData.room_id} style={{ padding: '10px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #00E5FF, #00B4D8)', color: '#050816', border: 'none', cursor: loading || !formData.room_id ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600, opacity: loading || !formData.room_id ? 0.7 : 1 }}>
              {loading ? 'Registering...' : 'Register Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// DEVICES PAGE
// =============================================================================

export default function DevicesPage() {
  const devices = useDeviceStore((s) => s.devices);
  const addDevice = useDeviceStore((s) => s.addDevice);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await api.getDevices();
      const data = res as { devices?: Device[] } | Device[];
      useDeviceStore.getState().setDevices(
        (Array.isArray(data) ? data : data.devices || []) as Device[]
      );
    } catch { /* API not connected */ }
    setLoading(false);
  };

  useEffect(() => { fetchDevices(); }, []);

  const filteredDevices = useMemo(() => {
    let result = devices;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((d) => d.name.toLowerCase().includes(q) || d.type.includes(q));
    }
    if (typeFilter !== 'all') result = result.filter((d) => d.type === typeFilter);
    if (statusFilter !== 'all') result = result.filter((d) => d.status === statusFilter);
    return result;
  }, [devices, search, typeFilter, statusFilter]);

  const types = ['all', ...Object.keys(DEVICE_TYPE_CONFIG)];
  const statuses = ['all', 'online', 'offline', 'warning', 'faulty'];

  // Fallback devices if API not connected
  const displayDevices = filteredDevices.length > 0 ? filteredDevices : [
    { id: '1', name: 'Living Room AC', type: 'hvac', status: 'online', power_state: 'on', energy_usage_kw: 2.1, efficiency_percent: 94, metadata: { temperature: 23.5, target_temperature: 22, mode: 'cooling', fan_speed: 'medium' }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
    { id: '2', name: 'Refrigerator', type: 'refrigerator', status: 'online', power_state: 'on', energy_usage_kw: 0.08, efficiency_percent: 91, metadata: { temperature: 3.8, cooling_status: 'active', door_state: 'closed' }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
    { id: '3', name: 'Smart TV 65"', type: 'smart_tv', status: 'online', power_state: 'on', energy_usage_kw: 0.12, efficiency_percent: 88, metadata: { volume: 35, input_source: 'hdmi1' }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
    { id: '4', name: 'WiFi Router', type: 'router', status: 'online', power_state: 'on', energy_usage_kw: 0.012, efficiency_percent: 97, metadata: { download_speed: 95, upload_speed: 45, connected_clients: 8 }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
    { id: '5', name: 'Front Door Lock', type: 'door_lock', status: 'online', power_state: 'on', energy_usage_kw: 0.003, efficiency_percent: 99, metadata: { lock_state: 'locked', auto_lock: true }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
    { id: '6', name: 'Washing Machine', type: 'washing_machine', status: 'online', power_state: 'off', energy_usage_kw: 0, efficiency_percent: 85, metadata: { running: false }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
    { id: '7', name: 'Kitchen Light', type: 'smart_light', status: 'online', power_state: 'on', energy_usage_kw: 0.015, efficiency_percent: 95, metadata: { brightness: 100, color_temperature: 5500 }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
    { id: '8', name: 'Water Heater', type: 'water_heater', status: 'online', power_state: 'on', energy_usage_kw: 1.2, efficiency_percent: 82, metadata: { temperature: 48, target_temperature: 50 }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
    { id: '9', name: 'Security Camera', type: 'camera', status: 'online', power_state: 'on', energy_usage_kw: 0.015, efficiency_percent: 96, metadata: { recording: true, night_vision: false, motion_detection: true }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
    { id: '10', name: 'Garage Door', type: 'garage_door', status: 'online', power_state: 'on', energy_usage_kw: 0.005, efficiency_percent: 90, metadata: { position: 'closed' }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
  ] as Device[];

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#F8FAFC' }}>Device Inventory</h2>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
            {filteredDevices.length || displayDevices.length} devices • {displayDevices.filter((d) => d.power_state === 'on').length} active
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #00E5FF, #00B4D8)', color: '#050816', padding: '8px 16px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={16} />
            Add Device
          </button>
          <button onClick={fetchDevices} disabled={loading} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 14px', borderRadius: '8px',
          background: 'rgba(11, 17, 32, 0.5)', border: '1px solid rgba(0, 229, 255, 0.1)',
          flex: '1', minWidth: '200px', maxWidth: '400px',
        }}>
          <Search size={14} color="#64748B" />
          <input
            type="text"
            placeholder="Search devices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: '#F8FAFC', fontSize: '13px', width: '100%',
              fontFamily: "'Inter', sans-serif",
            }}
          />
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: '8px',
            background: 'rgba(11, 17, 32, 0.7)', border: '1px solid rgba(0, 229, 255, 0.1)',
            color: '#F8FAFC', fontSize: '13px', cursor: 'pointer',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {types.map((t) => (
            <option key={t} value={t} style={{ background: '#0B1120' }}>
              {t === 'all' ? 'All Types' : DEVICE_TYPE_CONFIG[t]?.label || t}
            </option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: '8px',
            background: 'rgba(11, 17, 32, 0.7)', border: '1px solid rgba(0, 229, 255, 0.1)',
            color: '#F8FAFC', fontSize: '13px', cursor: 'pointer',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {statuses.map((s) => (
            <option key={s} value={s} style={{ background: '#0B1120' }}>
              {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Device Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '16px',
      }}>
        {displayDevices.map((device) => (
          <DeviceCard key={device.id} device={device} />
        ))}
      </div>

      <DeviceOnboardingModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onAdd={(device) => addDevice(device)} 
      />
    </div>
  );
}
