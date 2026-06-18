'use client';

/**
 * RNTBCI Smart Home Digital Twin — Home Dashboard Overview
 *
 * Real-time metrics, energy charts, device status, and system health
 * in Iron Man HUD-style glassmorphic cards.
 */

import { useEffect, useState, useMemo } from 'react';
import {
  Zap, Activity, Cpu, AlertTriangle, TrendingUp, ThermometerSun,
  Wifi, Battery, DollarSign, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '@/services/api';
import { useDeviceStore, useSimulationStore, useEventStore } from '@/store';

// =============================================================================
// STAT CARD
// =============================================================================

function StatCard({ label, value, unit, icon: Icon, color, change, trend }: {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ComponentType<{ size?: number; color?: string; className?: string }>;
  color: string;
  change?: string;
  trend?: 'up' | 'down';
}) {
  return (
    <div className="glass-card" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
      {/* Glow accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px',
          background: `${color}15`, border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} color={color} />
        </div>
        {change && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '2px',
            fontSize: '12px', fontWeight: 600,
            color: trend === 'up' ? '#00FF9D' : '#FF4D6D',
          }}>
            {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {change}
          </div>
        )}
      </div>

      <div style={{
        fontFamily: "'Orbitron', monospace", fontSize: '28px', fontWeight: 800,
        color: '#F8FAFC', lineHeight: 1,
      }}>
        {value}
        {unit && <span style={{ fontSize: '14px', color: '#94A3B8', marginLeft: '4px', fontWeight: 500 }}>{unit}</span>}
      </div>
      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px', letterSpacing: '0.05em' }}>
        {label}
      </div>
    </div>
  );
}

// =============================================================================
// ENERGY CHART
// =============================================================================

function EnergyChart() {
  const [data, setData] = useState<Array<{ time: string; power: number }>>([]);

  useEffect(() => {
    // Generate initial data
    const now = Date.now();
    const initial = Array.from({ length: 30 }, (_, i) => ({
      time: new Date(now - (29 - i) * 60000).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      power: 2 + Math.sin(i * 0.3) * 1.5 + Math.random() * 0.5,
    }));
    setData(initial);

    const interval = setInterval(() => {
      setData((prev) => {
        const last = prev[prev.length - 1];
        const lastPower = last?.power || 2;
        const newPower = Math.max(0.5, lastPower + (Math.random() - 0.5) * 0.3);
        return [
          ...prev.slice(1),
          {
            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
            power: parseFloat(newPower.toFixed(2)),
          },
        ];
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

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
          <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
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
      return [
        { name: 'Living', energy: 2200 }, { name: 'Kitchen', energy: 1800 },
        { name: 'Bedroom', energy: 1500 }, { name: 'Utility', energy: 900 },
        { name: 'Garage', energy: 400 }, { name: 'Bathroom', energy: 1200 },
        { name: 'Hallway', energy: 200 },
      ];
    }
    return result;
  }, [rooms, devices]);

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
    try {
      await api.togglePower(device.id, newState);
      useDeviceStore.getState().updateDevice(device.id, { power_state: newState });
    } catch { /* Ignore */ }
    setTogglingId(null);
  };

  const displayDevices = devices.length > 0 ? devices.slice(0, 6) : [
    { id: '1', name: 'Living Room AC', type: 'hvac', status: 'online', power_state: 'on', energy_usage_kw: 2.1 },
    { id: '2', name: 'Refrigerator', type: 'refrigerator', status: 'online', power_state: 'on', energy_usage_kw: 0.08 },
    { id: '3', name: 'Smart TV 65"', type: 'smart_tv', status: 'online', power_state: 'on', energy_usage_kw: 0.12 },
    { id: '4', name: 'WiFi Router', type: 'router', status: 'online', power_state: 'on', energy_usage_kw: 0.012 },
    { id: '5', name: 'Front Door Lock', type: 'door_lock', status: 'online', power_state: 'on', energy_usage_kw: 0.003 },
    { id: '6', name: 'Washing Machine', type: 'washing_machine', status: 'offline', power_state: 'off', energy_usage_kw: 0 },
  ] as Array<{ id: string; name: string; type: string; status: string; power_state: string; energy_usage_kw: number }>;

  const typeIcons: Record<string, string> = {
    hvac: '❄️', refrigerator: '🧊', smart_tv: '📺', router: '📡',
    door_lock: '🔒', washing_machine: '🧺', dishwasher: '🍽️', smart_light: '💡',
    camera: '📷', water_heater: '🔥', nebulizer: '💨', garage_door: '🚗',
    smart_switch: '🔌', smart_plug: '🔌',
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
              color: device.power_state === 'on' ? '#00E5FF' : '#64748B',
            }}>
              {device.power_state === 'on' ? `${(device.energy_usage_kw * 1000).toFixed(0)}W` : '0W'}
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
  const onlineDevices = devices.filter((d) => d.status === 'online').length || 18;
  const totalPower = devices.reduce((sum, d) => sum + (d.energy_usage_kw || 0), 0) || 4.38;
  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged).length || 3;
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
        <StatCard label="Active Alerts" value={unacknowledgedAlerts} icon={AlertTriangle} color="#FF4D6D" />
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
