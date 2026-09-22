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
import { DEVICE_TYPE_CONFIG, isDeviceConnected } from './constants';
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
      const apiDevices = (Array.isArray(data) ? data : data.devices || []) as Device[];
      
      if (apiDevices.length > 0) {
        const currentDevices = useDeviceStore.getState().devices;
        const mergedDevices = [...apiDevices];
        
        // Ensure Solar, EV Charger, and EV Vehicle devices are always present for the demo
        ['energy_evse', 'solar_pv', 'ev_vehicle'].forEach(type => {
          if (!mergedDevices.some(d => d.type === type)) {
            const demoDevice = currentDevices.find(d => d.type === type);
            if (demoDevice) {
              mergedDevices.push(demoDevice);
            }
          }
        });
        
        useDeviceStore.getState().setDevices(mergedDevices);
      }
      // If API returns 0 devices or fails, keep the current demo devices
    } catch { 
      /* API not connected, keep existing demo devices */ 
    }
    setLoading(false);
  };

  useEffect(() => { fetchDevices(); }, []);

  const connectedCount = devices.filter((d) => isDeviceConnected(d)).length;
  const disconnectedCount = devices.length - connectedCount;
  const activeCount = devices.filter((d) => isDeviceConnected(d) && d.power_state === 'on').length;

  const filteredDevices = useMemo(() => {
    let result = devices;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((d) => (d.name || '').toLowerCase().includes(q) || (d.type || '').includes(q));
    }
    if (typeFilter !== 'all') result = result.filter((d) => d.type === typeFilter);
    if (statusFilter !== 'all') {
      if (statusFilter === 'connected') {
        result = result.filter((d) => isDeviceConnected(d));
      } else if (statusFilter === 'disconnected') {
        result = result.filter((d) => !isDeviceConnected(d));
      } else {
        result = result.filter((d) => d.status === statusFilter);
      }
    }
    return result;
  }, [devices, search, typeFilter, statusFilter]);

  const types = ['all', ...Object.keys(DEVICE_TYPE_CONFIG)];
  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'connected', label: 'Connected (Active)' },
    { value: 'disconnected', label: 'Disconnected (Inactive)' },
    { value: 'online', label: 'Online' },
    { value: 'offline', label: 'Offline' },
    { value: 'warning', label: 'Warning' },
    { value: 'faulty', label: 'Faulty' },
  ];

  // Use only actual filtered devices
  const displayDevices = filteredDevices;

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#F8FAFC' }}>Device Inventory</h2>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
            {devices.length} devices • <span style={{ color: '#00FF9D' }}>{connectedCount} connected</span> • <span style={{ color: '#94A3B8' }}>{disconnectedCount} disconnected (inactive)</span> • {activeCount} active
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

        {/* Status & Connectivity filter */}
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
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ background: '#0B1120' }}>
              {opt.label}
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

