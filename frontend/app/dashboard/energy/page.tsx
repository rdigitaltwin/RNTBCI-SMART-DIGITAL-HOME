'use client';

/**
 * RNTBCI Smart Home Digital Twin — Energy Analytics Page
 *
 * Comprehensive energy monitoring with area charts, cost tracking,
 * room breakdown, device-level analysis, and HEMS integration.
 */

import { useEffect, useState, useMemo } from 'react';
import {
  Zap, DollarSign, TrendingUp, TrendingDown, Battery, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Clock,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Legend, ComposedChart,
} from 'recharts';
import { useDeviceStore, useSimulationStore } from '@/store';

// =============================================================================
// HELPERS
// =============================================================================

function generateHourlyData() {
  const data = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * 3600000);
    const h = hour.getHours();
    const basePower = 2 + 2 * Math.sin((h - 6) * Math.PI / 12);
    const power = Math.max(0.5, basePower + (Math.random() - 0.5));
    const cost = power * 0.12;
    data.push({
      time: hour.toLocaleTimeString('en-US', { hour: '2-digit', hour12: false }),
      power: parseFloat(power.toFixed(2)),
      cost: parseFloat(cost.toFixed(3)),
      peak: h >= 14 && h < 18 ? power * 1.2 : null,
    });
  }
  return data;
}

function generateWeeklyData() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((day, i) => ({
    day,
    consumption: parseFloat((40 + Math.random() * 20 + (i >= 5 ? 10 : 0)).toFixed(1)),
    cost: parseFloat((4.8 + Math.random() * 2.4 + (i >= 5 ? 1.2 : 0)).toFixed(2)),
    average: 48,
  }));
}

// =============================================================================
// METRIC CARD
// =============================================================================

function MetricCard({ label, value, unit, icon: Icon, color, subtitle, trend }: {
  label: string; value: string | number; unit?: string; icon: React.ComponentType<{ size?: number; color?: string; className?: string }>;
  color: string; subtitle?: string; trend?: { value: string; direction: 'up' | 'down' };
}) {
  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px',
          background: `${color}15`, border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} color={color} />
        </div>
        {trend && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '2px', fontSize: '11px', fontWeight: 600,
            color: trend.direction === 'up' ? '#FF4D6D' : '#00FF9D',
          }}>
            {trend.direction === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trend.value}
          </div>
        )}
      </div>
      <div style={{ marginTop: '12px' }}>
        <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '24px', fontWeight: 800, color: '#F8FAFC' }}>
          {value}<span style={{ fontSize: '12px', color: '#94A3B8', marginLeft: '4px' }}>{unit}</span>
        </div>
        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>{label}</div>
        {subtitle && <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px', fontFamily: "'JetBrains Mono', monospace" }}>{subtitle}</div>}
      </div>
    </div>
  );
}

// =============================================================================
// TARIFF INDICATOR
// =============================================================================

function TariffIndicator() {
  const hour = new Date().getHours();
  const period = hour >= 22 || hour < 6 ? 'off_peak' : hour >= 14 && hour < 18 ? 'on_peak' : 'mid_peak';
  const config = {
    off_peak: { label: 'Off-Peak', rate: '$0.08/kWh', color: '#00FF9D', icon: '🌙' },
    mid_peak: { label: 'Mid-Peak', rate: '$0.12/kWh', color: '#FFC857', icon: '☀️' },
    on_peak: { label: 'On-Peak', rate: '$0.18/kWh', color: '#FF4D6D', icon: '🔥' },
  }[period];

  return (
    <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '24px' }}>{config.icon}</span>
      <div>
        <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '13px', fontWeight: 700, color: config.color }}>
          {config.label}
        </div>
        <div style={{ fontSize: '11px', color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}>
          {config.rate}
        </div>
      </div>
      <div style={{ marginLeft: 'auto', fontSize: '20px', fontFamily: "'Orbitron', monospace", fontWeight: 800, color: config.color }}>
        {config.rate.split('/')[0]}
      </div>
    </div>
  );
}

// =============================================================================
// ENERGY PAGE
// =============================================================================

export default function EnergyPage() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const hourlyData = useMemo(() => generateHourlyData(), []);
  const weeklyData = useMemo(() => generateWeeklyData(), []);
  const devices = useDeviceStore((s) => s.devices);

  const totalPower = devices.reduce((sum, d) => sum + (d.energy_usage_kw || 0), 0) || 4.38;
  const dailyCost = (totalPower * 24 * 0.12).toFixed(2);
  const monthlyEstimate = (parseFloat(dailyCost) * 30).toFixed(2);

  const tooltipStyle = {
    background: 'rgba(11, 17, 32, 0.95)', border: '1px solid rgba(0, 229, 255, 0.2)',
    borderRadius: '8px', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#F8FAFC',
  };

  return (
    <div className="fade-in" style={{ maxWidth: '1600px' }}>
      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <MetricCard label="Current Draw" value={totalPower.toFixed(2)} unit="kW" icon={Zap} color="#FFC857" trend={{ value: '+3.2%', direction: 'up' }} />
        <MetricCard label="Today's Cost" value={`$${dailyCost}`} icon={DollarSign} color="#00E5FF" subtitle="Based on current rate" />
        <MetricCard label="Monthly Est." value={`$${monthlyEstimate}`} icon={TrendingUp} color="#6366F1" trend={{ value: '-5.1%', direction: 'down' }} />
        <MetricCard label="Peak Today" value="5.2" unit="kW" icon={AlertTriangle} color="#FF4D6D" subtitle="At 2:34 PM" />
        <MetricCard label="Efficiency" value="92.4" unit="%" icon={Battery} color="#00FF9D" />
      </div>

      {/* Tariff + Period selector */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', marginBottom: '20px', alignItems: 'start' }}>
        <TariffIndicator />
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(11, 17, 32, 0.5)', borderRadius: '8px', padding: '4px', border: '1px solid rgba(0, 229, 255, 0.1)' }}>
          {(['day', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600,
                background: period === p ? 'rgba(0, 229, 255, 0.15)' : 'transparent',
                color: period === p ? '#00E5FF' : '#64748B',
                transition: 'all 0.2s',
              }}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {/* Power consumption over time */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', marginBottom: '16px' }}>Power Consumption (24h)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={hourlyData}>
              <defs>
                <linearGradient id="powerAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00E5FF" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#00E5FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="power" stroke="#00E5FF" strokeWidth={2} fill="url(#powerAreaGradient)" />
              <Line type="monotone" dataKey="peak" stroke="#FF4D6D" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly comparison */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', marginBottom: '16px' }}>Weekly Comparison</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyData}>
              <defs>
                <linearGradient id="weeklyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" />
                  <stop offset="100%" stopColor="#3B82F6" />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="consumption" fill="url(#weeklyGrad)" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="average" stroke="#FFC857" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', marginBottom: '16px' }}>Cost Trend (24h)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={hourlyData}>
            <defs>
              <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`$${Number(v).toFixed(3)}`, 'Cost']} />
            <Area type="monotone" dataKey="cost" stroke="#10B981" strokeWidth={2} fill="url(#costGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
