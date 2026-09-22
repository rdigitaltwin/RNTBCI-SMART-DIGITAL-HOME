'use client';

/**
 * RNTBCI Smart Home Digital Twin — Energy Analytics Page
 *
 * Comprehensive energy monitoring with area charts, cost tracking,
 * room breakdown, device-level analysis, and HEMS integration.
 */

import { useEffect, useState, useMemo } from 'react';
import {
  Zap, IndianRupee, TrendingUp, TrendingDown, Battery, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Clock, Download
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Legend, ComposedChart,
} from 'recharts';
import { useDeviceStore, useSimulationStore } from '@/store';
import { api } from '@/services/api';

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
    off_peak: { label: 'Off-Peak', rate: '₹0.08/kWh', color: '#00FF9D', icon: '🌙' },
    mid_peak: { label: 'Mid-Peak', rate: '₹0.12/kWh', color: '#FFC857', icon: '☀️' },
    on_peak: { label: 'On-Peak', rate: '₹0.18/kWh', color: '#FF4D6D', icon: '🔥' },
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
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const devices = useDeviceStore((s) => s.devices);
  const metrics = useSimulationStore((s) => s.metrics);
  const [liveMap, setLiveMap] = useState<any[]>([]);

  // Track Live Map Data
  useEffect(() => {
    const interval = setInterval(() => {
      if (!metrics || Object.keys(metrics).length === 0) return;

      const now = new Date().toLocaleTimeString('en-US', { hour12: false });
      const gridImport = metrics.grid_import_kw || 0;
      const gridExport = metrics.grid_export_kw || 0;
      const solar = metrics.solar_generation_kw || 0;
      const batCharge = metrics.battery_charge_kw || 0;
      const batDischarge = metrics.battery_discharge_kw || 0;
      const evDischarge = metrics.ev_discharge_kw || 0;
      // Net load from grid perspective — solar reduces grid draw, not adds to it
      const load = Math.max(0, gridImport - gridExport);

      setLiveMap(prev => {
        const newData = {
          time: now,
          gridImport,
          gridExport,
          solar,
          batteryCharge: batCharge,
          batteryDischarge: batDischarge,
          evDischarge,
          load: Math.max(0, Number(load.toFixed(4))),
          batterySoc: metrics.battery_soc_pct || 0,
        };
        return [...prev, newData].slice(-30);
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [metrics]);

  // Fetch real data from backend
  useEffect(() => {
    async function fetchEnergy() {
      try {
        const res: any = await api.getEnergySummary(period);
        if (res.hourly_data) {
          const formattedHourly = res.hourly_data.map((d: any) => {
            const date = new Date(d.hour);
            return {
              time: date.toLocaleTimeString('en-US', { hour: '2-digit', hour12: false }),
              power: Number(d.total_power || 0),
              cost: Number(d.total_cost || 0),
              peak: Number(d.total_power || 0) > 4 ? Number(d.total_power) * 1.2 : null
            };
          });
          setHourlyData(formattedHourly);
        }
        
        // For weekly comparison (using room breakdown as placeholder for real data)
        if (res.room_breakdown) {
          const formattedWeekly = res.room_breakdown.map((r: any) => ({
            day: r.room,
            consumption: Number(r.total_power_kw || 0),
            cost: Number(r.total_cost_usd || 0),
            average: Number(r.avg_power_kw || 0)
          }));
          setWeeklyData(formattedWeekly);
        }
      } catch (err) {
        console.error("Failed to fetch energy data:", err);
      }
    }
    fetchEnergy();
  }, [period]);

  // Aggregate current metrics
  const totalPower = devices.reduce((sum, d) => sum + (d.energy_usage_kw || 0), 0) || 0;
  const dailyCost = (totalPower * 24 * 0.12).toFixed(2);
  const monthlyEstimate = (parseFloat(dailyCost) * 30).toFixed(2);

  const tooltipStyle = {
    background: 'rgba(11, 17, 32, 0.95)', border: '1px solid rgba(0, 229, 255, 0.2)',
    borderRadius: '8px', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#F8FAFC',
  };

  const handleDownload = () => {
    // Generate IST Timestamp (hour:min:sec)
    const istTime = new Date().toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const csvContent = [
      ['Device Name', 'Power State', 'Power Consumption (kW)', 'Timestamp (IST)'],
      ...devices.map(d => [
        d.name,
        d.power_state?.toUpperCase() || 'UNKNOWN',
        d.energy_usage_kw || 0,
        istTime
      ]),
      ['TOTAL', '', totalPower.toFixed(2), istTime]
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `real_power_data_${istTime.replace(/:/g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fade-in" style={{ maxWidth: '1600px' }}>
      {/* Header and Metrics */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#F8FAFC' }}>Energy Analytics</h2>
        <button
          onClick={handleDownload}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 16px', borderRadius: '8px',
            background: 'rgba(0, 229, 255, 0.1)', border: '1px solid rgba(0, 229, 255, 0.3)',
            color: '#00E5FF', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(0, 229, 255, 0.2)')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(0, 229, 255, 0.1)')}
        >
          <Download size={16} /> Download CSV
        </button>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <MetricCard label="Current Draw" value={totalPower.toFixed(2)} unit="kW" icon={Zap} color="#FFC857" trend={{ value: '+3.2%', direction: 'up' }} />
        <MetricCard label="Today's Cost" value={`₹${dailyCost}`} icon={IndianRupee} color="#00E5FF" subtitle="Based on current rate" />
        <MetricCard label="Monthly Est." value={`₹${monthlyEstimate}`} icon={TrendingUp} color="#6366F1" trend={{ value: '-5.1%', direction: 'down' }} />
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
      
      {/* Real-Time Battery Power Mapping */}
      <div className="glass-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>Live Battery Power Map</h3>
          <div style={{ display: 'flex', gap: '12px', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>
             <span style={{ color: '#00E5FF' }}>■ Grid Import</span>
             <span style={{ color: '#FFC857' }}>■ Solar</span>
             <span style={{ color: '#6366F1' }}>■ Battery SoC (%)</span>
             <span style={{ color: '#00FF9D' }}>■ Battery Discharging</span>
             <span style={{ color: '#FF4D6D' }}>■ Load</span>
          </div>
        </div>
        <ResponsiveContainer minWidth={10} minHeight={10} width="100%" height={300}>
          <ComposedChart data={liveMap}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} label={{ value: 'kW', angle: -90, position: 'insideLeft', fill: '#64748B', fontSize: 10 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} domain={[0, 100]} label={{ value: 'SoC %', angle: 90, position: 'insideRight', fill: '#64748B', fontSize: 10 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area yAxisId="left" type="monotone" dataKey="load" stroke="#FF4D6D" fill="#FF4D6D" fillOpacity={0.1} />
            <Area yAxisId="left" type="monotone" dataKey="gridImport" stroke="#00E5FF" fill="#00E5FF" fillOpacity={0.2} />
            <Area yAxisId="left" type="monotone" dataKey="solar" stroke="#FFC857" fill="#FFC857" fillOpacity={0.3} />
            <Area yAxisId="left" type="monotone" dataKey="batteryDischarge" stroke="#00FF9D" fill="#00FF9D" fillOpacity={0.4} />
            <Line yAxisId="right" type="monotone" dataKey="batterySoc" stroke="#6366F1" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {/* Power consumption over time */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', marginBottom: '16px' }}>Power Consumption (24h)</h3>
          <ResponsiveContainer minWidth={10} minHeight={10} width="100%" height={250}>
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
          <ResponsiveContainer minWidth={10} minHeight={10} width="100%" height={250}>
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
        <ResponsiveContainer minWidth={10} minHeight={10} width="100%" height={200}>
          <AreaChart data={hourlyData}>
            <defs>
              <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`₹${Number(v).toFixed(3)}`, 'Cost']} />
            <Area type="monotone" dataKey="cost" stroke="#10B981" strokeWidth={2} fill="url(#costGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
