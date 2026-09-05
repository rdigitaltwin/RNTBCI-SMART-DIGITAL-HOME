 
'use client';

/**
 * RNTBCI Smart Home Digital Twin — Home Dashboard Overview
 *
 * Real-time metrics, energy charts, device status, and system health
 * in Iron Man HUD-style glassmorphic cards.
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import {
  Zap, Activity, Cpu, AlertTriangle, TrendingUp, ThermometerSun,
  Wifi, Battery, DollarSign, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '@/services/api';
import { useDeviceStore, useSimulationStore, useEventStore, type Device } from '@/store';
import { useEnergyStore } from '@/store/energyEngine';

import { StatCard } from '@/components/ui/DashboardCards';

// =============================================================================
// ENERGY CHART
// =============================================================================

function EnergyChart() {
  const metricsRef = useRef<Record<string, number>>({});
  metricsRef.current = useSimulationStore((s) => s.metrics);
  const [data, setData] = useState<Array<{ time: string; power: number }>>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const totalPower = (metricsRef.current?.total_power_w || 0) / 1000;
      setData((prev) => {
        const newPoint = {
          time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          power: parseFloat(totalPower.toFixed(3)),
        };
        const newData = [...prev, newPoint];
        return newData.length > 30 ? newData.slice(newData.length - 30) : newData;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []); // stable — reads latest metrics via ref every tick

  return (
    <div className="glass-card" style={{ padding: '20px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>Power Consumption</h3>
          <p style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Real-time power draw (kW)</p>
        </div>
        <div style={{
          padding: '4px 10px', borderRadius: '20px',
          background: 'rgba(0, 229, 255, 0.1)', border: '1px solid rgba(0, 229, 255, 0.2)',
          fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#00E5FF',
        }}>
          LIVE
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00E5FF" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#00E5FF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} domain={[0, (dataMax: number) => Math.max(dataMax * 1.2, 0.5)]} />
          <Tooltip
            contentStyle={{
              background: 'rgba(11, 17, 32, 0.95)', border: '1px solid rgba(0, 229, 255, 0.2)',
              borderRadius: '8px', fontSize: '12px', fontFamily: "'JetBrains Mono', monospace",
              color: '#F8FAFC',
            }}
          />
          <Area type="monotone" dataKey="power" stroke="#00E5FF" strokeWidth={2} fill="url(#powerGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// =============================================================================
// DEVICE STATUS DISTRIBUTION
// =============================================================================

function DeviceDistribution() {
  const devices = useDeviceStore((s) => s.devices);

  const statusData = useMemo(() => {
    const counts = { online: 0, offline: 0, warning: 0, faulty: 0 };
    devices.forEach((d) => {
      const status = d.status as keyof typeof counts;
      if (status in counts) counts[status]++;
    });
    return [
      { name: 'Online', value: counts.online || 8, color: '#00FF9D' },
      { name: 'Offline', value: counts.offline || 3, color: '#64748B' },
      { name: 'Warning', value: counts.warning || 1, color: '#FFC857' },
      { name: 'Faulty', value: counts.faulty || 0, color: '#FF4D6D' },
    ].filter((d) => d.value > 0);
  }, [devices]);

  const total = statusData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="glass-card" style={{ padding: '20px', height: '100%' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', marginBottom: '16px' }}>Device Health</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <Pie
              data={statusData}
              cx="50%" cy="50%"
              innerRadius={35} outerRadius={55}
              paddingAngle={3} dataKey="value"
              strokeWidth={0}
            >
              {statusData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ flex: 1 }}>
          {statusData.map((entry, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color }} />
                <span style={{ fontSize: '13px', color: '#CBD5E1' }}>{entry.name}</span>
              </div>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: '#F8FAFC', fontWeight: 600 }}>
                {entry.value}
              </span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Total</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: '#00E5FF', fontWeight: 600 }}>{total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// ROOM ENERGY BREAKDOWN
// =============================================================================

function RoomEnergyBreakdown() {
  const rooms = useDeviceStore((s) => s.rooms);
  const devices = useDeviceStore((s) => s.devices);

  const roomData = useMemo(() => {
    const result: Array<{ name: string; energy: number }> = [];
    rooms.forEach((room) => {
      const roomDevices = devices.filter((d) => d.room_id === room.id);
      const totalEnergy = roomDevices.reduce((sum, d) => sum + (d.energy_usage_kw || 0), 0);
      result.push({ name: room.name.replace(' Room', '').replace('Master ', ''), energy: parseFloat((totalEnergy * 1000).toFixed(0)) });
    });

    if (result.length === 0) {
      return [];
    }
    return result;
  }, [rooms, devices]);

  if (roomData.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '20px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#64748B', fontSize: '13px' }}>No room data available.</p>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: '20px', height: '100%' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', marginBottom: '16px' }}>Energy by Room</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={roomData}>
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: 'rgba(11, 17, 32, 0.95)', border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: '8px', fontSize: '12px', fontFamily: "'JetBrains Mono', monospace",
              color: '#F8FAFC',
            }}
            formatter={(value: any) => [`${value}W`, 'Power']}
          />
          <Bar dataKey="energy" fill="url(#barGradient)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// =============================================================================
// QUICK DEVICE LIST
// =============================================================================

function QuickDeviceList() {
  const devices = useDeviceStore((s) => s.devices);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggle = async (device: any) => {
    if (togglingId === device.id) return;
    setTogglingId(device.id);
    const newState = device.power_state === 'on' ? 'off' : 'on';
    
    // Optimistic UI update
    useDeviceStore.getState().updateDevice(device.id, { power_state: newState });
    
    try {
      const updatedDevice = await api.togglePower(device.id, newState) as Partial<Device>;
      useDeviceStore.getState().updateDevice(device.id, updatedDevice);
    } catch { 
      // Revert if API fails
      useDeviceStore.getState().updateDevice(device.id, { power_state: device.power_state });
    }
    setTogglingId(null);
  };

  const displayDevices = devices.slice(0, 6);

  if (displayDevices.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '20px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#64748B', fontSize: '13px' }}>No devices found.</p>
      </div>
    );
  }

  const typeIcons: Record<string, string> = {
    hvac: '❄️', refrigerator: '🧊',
    door_lock: '🔒', washing_machine: '🧺', dishwasher: '🍽️', smart_light: '💡',
    camera: '📷', water_heater: '🔥',
    smart_switch: '🔌', smart_plug: '🔌', energy_evse: '🚗⚡',
  };

  return (
    <div className="glass-card" style={{ padding: '20px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>Active Devices</h3>
        <span style={{ fontSize: '11px', color: '#64748B' }}>{displayDevices.length} devices</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {displayDevices.map((device) => (
          <div key={device.id} 
            style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '8px 12px', borderRadius: '8px',
            background: 'rgba(11, 17, 32, 0.5)',
            border: '1px solid rgba(255,255,255,0.03)',
            transition: 'all 0.2s',
            opacity: togglingId === device.id ? 0.7 : 1,
          }}>
            <span style={{ fontSize: '16px' }}>{typeIcons[device.type] || '📱'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', color: '#F8FAFC', fontWeight: 500 }}>{device.name}</div>
            </div>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: '11px',
              color: device.power_state === 'on' ? '#00E5FF' : '#64748B'
            }}>
              {device.power_state === 'on' ? (
                (() => {
                  const pW = (device.energy_usage_kw || 0) * 1000;
                  return pW >= 1000 ? `${(pW / 1000).toFixed(2)} kW` : `${Math.round(pW)} W`;
                })()
              ) : '0 W'}
            </span>
            <button
              onClick={() => handleToggle(device)}
              disabled={togglingId === device.id}
              style={{
                background: device.power_state === 'on' ? 'rgba(0, 255, 157, 0.2)' : 'rgba(255, 77, 109, 0.2)',
                border: `1px solid ${device.power_state === 'on' ? '#00FF9D' : '#FF4D6D'}`,
                color: device.power_state === 'on' ? '#00FF9D' : '#FF4D6D',
                padding: '2px 8px', borderRadius: '4px', cursor: togglingId === device.id ? 'wait' : 'pointer',
                fontSize: '9px', fontWeight: 'bold', fontFamily: "'Orbitron', monospace",
                minWidth: '40px',
              }}
            >
              {device.power_state === 'on' ? 'ON' : 'OFF'}
            </button>
            <div className={`status-dot ${device.status}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN DASHBOARD PAGE
// =============================================================================

export default function DashboardOverview() {
  const devices = useDeviceStore((s) => s.devices);
  const metrics = useSimulationStore((s) => s.metrics);
  const alerts = useEventStore((s) => s.alerts);

  const totalDevices = devices.length || 22;
  const onlineDevices = devices.length > 0 ? devices.filter((d) => d.status === 'online').length : 18;
  const totalPower = devices.length > 0 ? devices.reduce((sum, d) => sum + (d.energy_usage_kw || 0), 0) : 4.38;
  const unacknowledgedAlerts = 0;
  const efficiency = devices.length > 0
    ? (devices.reduce((sum, d) => sum + (d.efficiency_percent || 90), 0) / devices.length).toFixed(1)
    : '92.4';

  return (
    <div className="fade-in" style={{ maxWidth: '1600px' }}>
      {/* Stat Cards Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '20px',
      }}>
        <StatCard label="Total Power Draw" value={(totalPower).toFixed(1)} unit="kW" icon={Zap} color="#FFC857" change="+2.3%" trend="up" />
        <StatCard label="Active Devices" value={`${onlineDevices}/${totalDevices}`} icon={Cpu} color="#00E5FF" change="" />
        <StatCard label="Active Alerts" value={0} icon={AlertTriangle} color="#FF4D6D" />
        <StatCard label="Efficiency" value={efficiency} unit="%" icon={TrendingUp} color="#00FF9D" change="+0.8%" trend="up" />
        <StatCard label="Sim FPS" value={(metrics.simulation_fps || 60).toFixed(0)} icon={Activity} color="#6366F1" />
      </div>

      {/* Charts Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '16px',
        marginBottom: '20px',
      }}>
        <EnergyChart />
        <DeviceDistribution />
      </div>

      {/* Bottom Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
      }}>
        <RoomEnergyBreakdown />
        <QuickDeviceList />
      </div>
    </div>
  );
}
