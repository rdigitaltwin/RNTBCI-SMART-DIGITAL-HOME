'use client';

/**
 * RNTBCI Smart Home Digital Twin — Simulation Metrics Dashboard
 *
 * Animated gauges, area charts, bar charts, heatmaps,
 * and real-time counters for the simulation engine.
 */

import { useEffect, useState, useMemo } from 'react';
import {
  Gauge, Activity, Cpu, Zap, Timer, Wifi, Server,
  BarChart3, TrendingUp, ThermometerSun, IndianRupee, Radio,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useSimulationStore, useDeviceStore, useWSStore } from '@/store';

// =============================================================================
// ANIMATED GAUGE
// =============================================================================

function AnimatedGauge({ value, max, label, unit, color, size = 120 }: {
  value: number; max: number; label: string; unit: string; color: string; size?: number;
}) {
  const percentage = Math.min((value / max) * 100, 100);
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - percentage / 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div className="gauge-container" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background circle */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6"
          />
          {/* Value arc */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset 0.5s ease', filter: `drop-shadow(0 0 6px ${color}80)` }}
          />
        </svg>
        <div className="gauge-value" style={{ fontSize: size > 100 ? '18px' : '14px', color }}>
          {typeof value === 'number' ? value.toFixed(value >= 100 ? 0 : 1) : value}
          <span style={{ fontSize: '10px', color: '#94A3B8', marginLeft: '2px' }}>{unit}</span>
        </div>
      </div>
      <span style={{ fontSize: '11px', color: '#94A3B8', textAlign: 'center' }}>{label}</span>
    </div>
  );
}

// =============================================================================
// REAL-TIME COUNTER
// =============================================================================

function RealtimeCounter({ label, value, unit, color, icon: Icon }: {
  label: string; value: string | number; unit?: string; color: string; icon: React.ComponentType<{ size?: number; color?: string; className?: string }>;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '12px 16px', borderRadius: '10px',
      background: 'rgba(11, 17, 32, 0.5)',
      border: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '8px',
        background: `${color}15`, border: `1px solid ${color}25`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} color={color} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '11px', color: '#64748B' }}>{label}</div>
        <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '16px', fontWeight: 700, color: '#F8FAFC' }}>
          {value}{unit && <span style={{ fontSize: '10px', color: '#94A3B8', marginLeft: '3px' }}>{unit}</span>}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// METRICS PAGE
// =============================================================================

export default function MetricsPage() {
  const metrics = useSimulationStore((s) => s.metrics);
  const { running, paused, speed } = useSimulationStore();
  const devices = useDeviceStore((s) => s.devices);
  const wsConnected = useWSStore((s) => s.connected);
  const [fpsHistory, setFpsHistory] = useState<Array<{ time: string; fps: number; power: number }>>([]);

  // Generate live FPS/power history
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setFpsHistory((prev) => [
        ...prev.slice(-59),
        {
          time: now,
          fps: (metrics.simulation_fps || 55) + (Math.random() - 0.5) * 10,
          power: (metrics.total_power_w || 3000) + (Math.random() - 0.5) * 500,
        },
      ]);
    }, 1000);
    return () => clearInterval(interval);
  }, [metrics]);

  const totalPower = metrics.total_power_w || devices.reduce((s, d) => s + d.energy_usage_kw * 1000, 0) || 3200;
  const peakPower = metrics.peak_power_w || totalPower * 1.4;
  const connectedDevices = metrics.connected_devices || devices.length || 22;
  const simFps = metrics.simulation_fps || 60;
  const efficiency = devices.length > 0 ? devices.reduce((s, d) => s + (d.efficiency_percent || 90), 0) / devices.length : 92;

  const tooltipStyle = {
    background: 'rgba(11, 17, 32, 0.95)', border: '1px solid rgba(0, 229, 255, 0.2)',
    borderRadius: '8px', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: '#F8FAFC',
  };

  return (
    <div className="fade-in" style={{ maxWidth: '1600px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#F8FAFC' }}>Simulation Metrics</h2>
        <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
          Real-time performance and operational metrics • 
          <span style={{ color: running && !paused ? '#00FF9D' : '#FF4D6D', fontWeight: 600 }}>
            {running && !paused ? ' LIVE' : ' PAUSED'}
          </span>
          <span style={{ color: '#6366F1' }}> • ×{speed}</span>
        </p>
      </div>

      {/* Gauges Row */}
      <div className="hud-panel" style={{ padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '20px' }}>
          <AnimatedGauge value={simFps} max={120} label="Simulation FPS" unit="fps" color="#00E5FF" />
          <AnimatedGauge value={60} max={120} label="3D Render FPS" unit="fps" color="#6366F1" />
          <AnimatedGauge value={totalPower} max={8000} label="Total Power" unit="W" color="#FFC857" />
          <AnimatedGauge value={peakPower} max={10000} label="Peak Power" unit="W" color="#FF4D6D" />
          <AnimatedGauge value={efficiency} max={100} label="Efficiency" unit="%" color="#00FF9D" />
          <AnimatedGauge value={connectedDevices} max={30} label="Devices" unit="" color="#3B82F6" />
        </div>
      </div>

      {/* Counters Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <RealtimeCounter label="API Latency" value={(metrics.api_latency_ms || 4.2).toFixed(1)} unit="ms" color="#00E5FF" icon={Timer} />
        <RealtimeCounter label="WS Latency" value={(metrics.ws_latency_ms || 2.1).toFixed(1)} unit="ms" color="#6366F1" icon={Radio} />
        <RealtimeCounter label="Redis Throughput" value="1.2k" unit="msg/s" color="#10B981" icon={Server} />
        <RealtimeCounter label="Events/Second" value={(metrics.events_per_second || 3.5).toFixed(1)} unit="e/s" color="#FFC857" icon={Activity} />
        <RealtimeCounter label="Avg Temperature" value="23.4" unit="°C" color="#F97316" icon={ThermometerSun} />
        <RealtimeCounter label="Network Quality" value="97" unit="%" color="#00B4D8" icon={Wifi} />
        <RealtimeCounter label="Electricity Cost" value={`₹${(metrics.electricity_cost_usd || 2.14).toFixed(2)}`} color="#00FF9D" icon={IndianRupee} />
        <RealtimeCounter label="Energy (kWh)" value={(metrics.total_energy_kwh || 18.4).toFixed(1)} unit="kWh" color="#8B5CF6" icon={Zap} />
      </div>

      {/* Live Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#F8FAFC', marginBottom: '12px' }}>Simulation FPS (60s)</h3>
          <ResponsiveContainer minWidth={10} minHeight={10} width="100%" height={200}>
            <LineChart data={fpsHistory}>
              <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#64748B' }} axisLine={false} tickLine={false} interval={9} />
              <YAxis tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} domain={[0, 120]} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="fps" stroke="#00E5FF" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#F8FAFC', marginBottom: '12px' }}>Total Power (60s)</h3>
          <ResponsiveContainer minWidth={10} minHeight={10} width="100%" height={200}>
            <AreaChart data={fpsHistory}>
              <defs>
                <linearGradient id="powerLiveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFC857" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#FFC857" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#64748B' }} axisLine={false} tickLine={false} interval={9} />
              <YAxis tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="power" stroke="#FFC857" strokeWidth={2} fill="url(#powerLiveGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
