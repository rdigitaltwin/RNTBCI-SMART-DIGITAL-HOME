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

import DeviceCard from './components/DeviceCard';
import DevicePanel from './components/DevicePanel';
import { DEVICE_TYPE_CONFIG } from './constants';
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
      const room = rooms[0];
      setFormData(prev => ({ 
        ...prev, 
        room_id: room.id,
        position_x: room.position_x,
        position_y: room.position_y,
        position_z: room.position_z
      }));
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
                value={formData.room_id} 
                onChange={(e) => {
                  const roomId = e.target.value;
                  const room = rooms.find(r => r.id === roomId);
                  setFormData(prev => ({
                    ...prev, 
                    room_id: roomId,
                    ...(room ? { 
                      position_x: room.position_x, 
                      position_y: room.position_y, 
                      position_z: room.position_z 
                    } : {})
                  }));
                }}
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
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

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
    { id: '00000000-0000-0000-0000-000000000001', name: 'Living Room AC', type: 'hvac', status: 'online', power_state: 'on', energy_usage_kw: 2.1, efficiency_percent: 94, metadata: { temperature: 23.5, target_temperature: 22, mode: 'cooling', fan_speed: 'medium' }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
    { id: '00000000-0000-0000-0000-000000000002', name: 'Refrigerator', type: 'refrigerator', status: 'online', power_state: 'on', energy_usage_kw: 0.08, efficiency_percent: 91, metadata: { temperature: 3.8, cooling_status: 'active', door_state: 'closed' }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
    { id: '00000000-0000-0000-0000-000000000003', name: 'Smart TV 65"', type: 'smart_tv', status: 'online', power_state: 'on', energy_usage_kw: 0.12, efficiency_percent: 88, metadata: { volume: 35, input_source: 'hdmi1' }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
    { id: '00000000-0000-0000-0000-000000000004', name: 'WiFi Router', type: 'router', status: 'online', power_state: 'on', energy_usage_kw: 0.012, efficiency_percent: 97, metadata: { download_speed: 95, upload_speed: 45, connected_clients: 8 }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
    { id: '00000000-0000-0000-0000-000000000005', name: 'Front Door Lock', type: 'door_lock', status: 'online', power_state: 'on', energy_usage_kw: 0.003, efficiency_percent: 99, metadata: { lock_state: 'locked', auto_lock: true }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
    { id: '00000000-0000-0000-0000-000000000006', name: 'Washing Machine', type: 'washing_machine', status: 'online', power_state: 'off', energy_usage_kw: 0, efficiency_percent: 85, metadata: { running: false }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
    { id: '00000000-0000-0000-0000-000000000007', name: 'Kitchen Light', type: 'smart_light', status: 'online', power_state: 'on', energy_usage_kw: 0.015, efficiency_percent: 95, metadata: { brightness: 100, color_temperature: 5500 }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
    { id: '00000000-0000-0000-0000-000000000008', name: 'Water Heater', type: 'water_heater', status: 'online', power_state: 'on', energy_usage_kw: 1.2, efficiency_percent: 82, metadata: { temperature: 48, target_temperature: 50 }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
    { id: '00000000-0000-0000-0000-000000000009', name: 'Security Camera', type: 'camera', status: 'online', power_state: 'on', energy_usage_kw: 0.015, efficiency_percent: 96, metadata: { recording: true, night_vision: false, motion_detection: true }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
    { id: '00000000-0000-0000-0000-000000000010', name: 'Garage Door', type: 'garage_door', status: 'online', power_state: 'on', energy_usage_kw: 0.005, efficiency_percent: 90, metadata: { position: 'closed' }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
    { id: '00000000-0000-0000-0000-000000000011', name: 'EV Charger', type: 'energy_evse', status: 'online', power_state: 'on', energy_usage_kw: 7.2, efficiency_percent: 98, metadata: { matter_device_type: '0x050C', state: 'Charging' }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
    { id: '00000000-0000-0000-0000-000000000012', name: 'Solar Array', type: 'solar_panel', status: 'online', power_state: 'on', energy_usage_kw: -8.0, efficiency_percent: 100, metadata: { matter_device_type: '0x050D' }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
    { id: '00000000-0000-0000-0000-000000000013', name: 'Home Battery', type: 'battery_storage', status: 'online', power_state: 'on', energy_usage_kw: -2.0, efficiency_percent: 95, metadata: { matter_device_type: '0x050E', soc: 85 }, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
    { id: '00000000-0000-0000-0000-000000000014', name: 'Main Circuit Breaker', type: 'mcb', status: 'online', power_state: 'on', energy_usage_kw: 0, efficiency_percent: 100, metadata: {}, position_x: 0, position_y: 0, position_z: 0, room_id: '', connectivity: 'connected', last_updated: '' },
  ] as unknown as Device[];

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

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '16px',
      }}>
        {displayDevices.map((device) => (
          <DeviceCard key={device.id} device={device} onClick={() => setSelectedDevice(device)} />
        ))}
      </div>

      <DeviceOnboardingModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onAdd={(device) => addDevice(device)} 
      />

      <DevicePanel 
        device={selectedDevice} 
        onClose={() => setSelectedDevice(null)} 
      />
    </div>
  );
}
