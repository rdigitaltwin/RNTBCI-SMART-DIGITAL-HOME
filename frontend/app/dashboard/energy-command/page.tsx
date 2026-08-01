'use client';

/**
 * RNTBCI Smart Home Digital Twin — Energy Command Center
 *
 * Enterprise energy dashboard showing:
 * - Current Load gauge with color zones
 * - Configured Capacity, Voltage, Current, Power Factor
 * - Peak Load, Remaining Capacity
 * - Energy Today, Estimated Monthly
 * - Running/Offline/Total Devices
 * - EV Charging Power, MCB Status
 * - Home Configuration Panel
 * - MCB Control Panel
 * - EV Charger Panel
 * - Real-time Charts & Analytics
 * - Event Log
 * - Alert System
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Zap, Activity, Cpu, AlertTriangle, Gauge, Battery, Settings2,
  Power, TrendingUp, Thermometer, PlugZap, Shield, Clock, ChevronDown,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts';
import { useEnergyStore, selectRunningDevices, selectDeviceCountsByStatus, selectRoomConsumption, selectActiveAlerts } from '@/store/energyEngine';
import { formatPower, formatEnergy, DEVICE_STATUS_COLORS } from '@/lib/applianceDatabase';
import { HOME_PROFILES, LOAD_LEVEL_COLORS, LOAD_LEVEL_LABELS, type HomeProfileType } from '@/lib/homeCapacity';
import { StatCard } from '@/components/ui/DashboardCards';

// =============================================================================
// LOAD GAUGE COMPONENT
// =============================================================================

function LoadGauge() {
  const metrics = useEnergyStore((s) => s.metrics);
  const mcb = useEnergyStore((s) => s.mcb);
  const loadColor = LOAD_LEVEL_COLORS[metrics.loadLevel];

  const gaugePercentage = Math.min(metrics.loadPercentage, 120);
  const radius = 80;
  const strokeWidth = 12;
  const circumference = Math.PI * radius; // semi-circle
  const offset = circumference - (gaugePercentage / 120) * circumference;

  return (
    <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', marginBottom: '16px' }}>
        System Load
      </h3>

      <div style={{ position: 'relative', width: '200px', height: '120px', margin: '0 auto' }}>
        <svg width="200" height="120" viewBox="0 0 200 120">
          {/* Background arc */}
          <path
            d="M 10 110 A 90 90 0 0 1 190 110"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Green zone (0-70%) */}
          <path
            d="M 10 110 A 90 90 0 0 1 190 110"
            fill="none"
            stroke={loadColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.5s ease' }}
          />
          {/* Zone markers */}
          {[70, 90, 100].map((pct) => {
            const angle = (pct / 120) * Math.PI;
            const x = 100 - 90 * Math.cos(angle);
            const y = 110 - 90 * Math.sin(angle);
            return (
              <line key={pct} x1={x} y1={y}
                x2={100 - 78 * Math.cos(angle)} y2={110 - 78 * Math.sin(angle)}
                stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            );
          })}
        </svg>

        {/* Center value */}
        <div style={{
          position: 'absolute',
          bottom: '5px',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: "'Orbitron', monospace",
            fontSize: '28px',
            fontWeight: 800,
            color: loadColor,
            textShadow: `0 0 20px ${loadColor}40`,
            transition: 'color 0.5s',
          }}>
            {metrics.loadPercentage.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Load value */}
      <div style={{ marginTop: '8px' }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '18px',
          fontWeight: 700,
          color: '#F8FAFC',
        }}>
          {formatPower(metrics.currentLoad)}
        </span>
        <span style={{ fontSize: '12px', color: '#64748B', marginLeft: '8px' }}>
          / {formatPower(metrics.availableCapacity + metrics.currentLoad)}
        </span>
      </div>

      {/* Status label */}
      <div style={{
        marginTop: '8px',
        padding: '4px 12px',
        borderRadius: '12px',
        display: 'inline-block',
        background: `${loadColor}15`,
        border: `1px solid ${loadColor}30`,
        fontSize: '10px',
        fontWeight: 600,
        color: loadColor,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {LOAD_LEVEL_LABELS[metrics.loadLevel]}
      </div>

      {/* MCB indicator */}
      {mcb.state === 'tripped' && (
        <div style={{
          marginTop: '10px',
          padding: '6px 12px',
          borderRadius: '8px',
          background: 'rgba(255, 77, 109, 0.15)',
          border: '1px solid rgba(255, 77, 109, 0.3)',
          fontSize: '11px',
          color: '#FF4D6D',
          fontWeight: 700,
          animation: 'statusPulse 1s infinite',
        }}>
          ⚡ MCB TRIPPED — POWER CUT
        </div>
      )}
    </div>
  );
}

// =============================================================================
// HOME CONFIGURATION PANEL
// =============================================================================

function HomeConfigPanel() {
  const homeConfig = useEnergyStore((s) => s.homeConfig);
  const setHomeProfile = useEnergyStore((s) => s.setHomeProfile);
  const setContractedPower = useEnergyStore((s) => s.setContractedPower);
  const profile = HOME_PROFILES[homeConfig.profile];

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Settings2 size={16} color="#00E5FF" />
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>Home Configuration</h3>
      </div>

      {/* Profile selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {(Object.keys(HOME_PROFILES) as HomeProfileType[]).map((key) => {
          const p = HOME_PROFILES[key];
          const isActive = homeConfig.profile === key;
          return (
            <button
              key={key}
              onClick={() => setHomeProfile(key)}
              style={{
                flex: 1,
                padding: '10px 8px',
                borderRadius: '10px',
                background: isActive ? `${p.color}15` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isActive ? `${p.color}40` : 'rgba(255,255,255,0.08)'}`,
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '18px', marginBottom: '4px' }}>{p.icon}</div>
              <div style={{
                fontSize: '10px',
                fontWeight: isActive ? 700 : 400,
                color: isActive ? p.color : '#94A3B8',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {p.name.split(' ')[0]}
              </div>
            </button>
          );
        })}
      </div>

      {/* Power slider */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', color: '#64748B' }}>Contracted Power</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#00E5FF', fontFamily: "'JetBrains Mono', monospace" }}>
            {homeConfig.contractedPower} kVA
          </span>
        </div>
        <input
          type="range"
          min={profile.contractedPowerMin}
          max={profile.contractedPowerMax}
          step={1}
          value={homeConfig.contractedPower}
          onChange={(e) => setContractedPower(Number(e.target.value))}
          style={{
            width: '100%',
            accentColor: profile.color,
            height: '4px',
            cursor: 'pointer',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#64748B' }}>
          <span>{profile.contractedPowerMin} kVA</span>
          <span>{profile.contractedPowerMax} kVA</span>
        </div>
      </div>

      {/* Quick info */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '10px',
      }}>
        <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
          <div style={{ color: '#64748B' }}>Voltage</div>
          <div style={{ color: '#F8FAFC', fontWeight: 600 }}>{homeConfig.voltage}V</div>
        </div>
        <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
          <div style={{ color: '#64748B' }}>Max Current</div>
          <div style={{ color: '#F8FAFC', fontWeight: 600 }}>{homeConfig.currentRating}A</div>
        </div>
        <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
          <div style={{ color: '#64748B' }}>Max Capacity</div>
          <div style={{ color: '#00E5FF', fontWeight: 600 }}>{formatPower(homeConfig.maxCapacityWatts)}</div>
        </div>
        <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
          <div style={{ color: '#64748B' }}>Power Factor</div>
          <div style={{ color: '#F8FAFC', fontWeight: 600 }}>{homeConfig.powerFactor}</div>
        </div>
      </div>

      {/* Supported devices */}
      <div style={{ marginTop: '12px' }}>
        <div style={{ fontSize: '10px', color: '#64748B', marginBottom: '6px' }}>Supported:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {profile.supportedDevices.map((d, i) => (
            <span key={i} style={{
              fontSize: '9px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(255,255,255,0.05)',
              color: '#94A3B8',
            }}>
              {d}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MCB CONTROL PANEL
// =============================================================================

function MCBControlPanel() {
  const mcb = useEnergyStore((s) => s.mcb);
  const metrics = useEnergyStore((s) => s.metrics);
  const resetMCB = useEnergyStore((s) => s.resetMCB);
  const turnOffOverloadedDevices = useEnergyStore((s) => s.turnOffOverloadedDevices);
  const devices = useEnergyStore((s) => s.devices);
  const setContractedPower = useEnergyStore((s) => s.setContractedPower);
  const homeConfig = useEnergyStore((s) => s.homeConfig);

  const stateColors = { on: '#00FF9D', tripped: '#FF4D6D', off: '#64748B' };
  const color = stateColors[mcb.state];

  const responsibleDeviceNames = mcb.responsibleDevices
    .map((id) => devices[id]?.name)
    .filter(Boolean)
    .slice(0, 5);

  return (
    <div className="glass-card" style={{
      padding: '20px',
      borderColor: mcb.state === 'tripped' ? 'rgba(255, 77, 109, 0.3)' : undefined,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Shield size={16} color={color} />
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>MCB Control</h3>
        <div style={{
          marginLeft: 'auto',
          padding: '3px 10px',
          borderRadius: '12px',
          background: `${color}15`,
          border: `1px solid ${color}30`,
          fontSize: '10px',
          fontWeight: 700,
          color,
          fontFamily: "'Orbitron', monospace",
        }}>
          {mcb.state.toUpperCase()}
        </div>
      </div>

      {/* Load bar */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '10px' }}>
          <span style={{ color: '#64748B' }}>Load vs Capacity</span>
          <span style={{ color: LOAD_LEVEL_COLORS[metrics.loadLevel], fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
            {metrics.loadPercentage.toFixed(1)}%
          </span>
        </div>
        <div style={{
          width: '100%', height: '8px', borderRadius: '4px',
          background: 'rgba(255,255,255,0.05)', overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.min(metrics.loadPercentage, 100)}%`,
            height: '100%',
            borderRadius: '4px',
            background: `linear-gradient(90deg, #00FF9D, ${LOAD_LEVEL_COLORS[metrics.loadLevel]})`,
            transition: 'width 0.5s, background 0.5s',
          }} />
        </div>
      </div>

      {/* Trip info */}
      {mcb.state === 'tripped' && (
        <div style={{
          padding: '12px',
          borderRadius: '10px',
          background: 'rgba(255, 77, 109, 0.08)',
          border: '1px solid rgba(255, 77, 109, 0.15)',
          marginBottom: '14px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '10px',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <div>
              <span style={{ color: '#64748B' }}>Exceeded by</span>
              <div style={{ color: '#FF4D6D', fontWeight: 700 }}>+{formatPower(mcb.exceededBy)}</div>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Trip time</span>
              <div style={{ color: '#FFC857' }}>
                {mcb.tripTime ? new Date(mcb.tripTime).toLocaleTimeString() : '—'}
              </div>
            </div>
          </div>
          {responsibleDeviceNames.length > 0 && (
            <div>
              <span style={{ color: '#64748B' }}>Responsible:</span>
              <div style={{ color: '#FF8C8C', marginTop: '4px' }}>
                {responsibleDeviceNames.join(' • ')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={() => resetMCB()}
          disabled={mcb.state !== 'tripped'}
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: '8px',
            background: mcb.state === 'tripped' ? 'rgba(0, 255, 157, 0.1)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${mcb.state === 'tripped' ? 'rgba(0, 255, 157, 0.3)' : 'rgba(255,255,255,0.08)'}`,
            color: mcb.state === 'tripped' ? '#00FF9D' : '#64748B',
            cursor: mcb.state === 'tripped' ? 'pointer' : 'not-allowed',
            fontSize: '10px',
            fontWeight: 600,
            fontFamily: "'Orbitron', monospace",
          }}
        >
          Reset MCB
        </button>
        <button
          onClick={() => turnOffOverloadedDevices()}
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: '8px',
            background: 'rgba(255, 200, 87, 0.1)',
            border: '1px solid rgba(255, 200, 87, 0.3)',
            color: '#FFC857',
            cursor: 'pointer',
            fontSize: '10px',
            fontWeight: 600,
            fontFamily: "'Orbitron', monospace",
          }}
        >
          Shed Load
        </button>
        <button
          onClick={() => setContractedPower(homeConfig.contractedPower + 3)}
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: '8px',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            color: '#6366F1',
            cursor: 'pointer',
            fontSize: '10px',
            fontWeight: 600,
            fontFamily: "'Orbitron', monospace",
          }}
        >
          +3 kVA
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// EV CHARGER PANEL
// =============================================================================

function EVChargerPanel() {
  const evCharger = useEnergyStore((s) => s.evCharger);
  const setEVChargerState = useEnergyStore((s) => s.setEVChargerState);
  const setEVChargingPower = useEnergyStore((s) => s.setEVChargingPower);
  const setEVBatteryLevel = useEnergyStore((s) => s.setEVBatteryLevel);

  const stateColors = {
    charging: '#00FF9D',
    paused: '#FFC857',
    completed: '#3B82F6',
    disconnected: '#64748B',
  };
  const color = stateColors[evCharger.state];

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <PlugZap size={16} color={color} />
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>EV Charger</h3>
        <div style={{
          marginLeft: 'auto',
          padding: '3px 10px',
          borderRadius: '12px',
          background: `${color}15`,
          border: `1px solid ${color}30`,
          fontSize: '10px',
          fontWeight: 700,
          color,
          fontFamily: "'Orbitron', monospace",
        }}>
          {evCharger.state.toUpperCase()}
        </div>
      </div>

      {/* Battery level */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '10px' }}>
          <span style={{ color: '#64748B' }}>Battery Level</span>
          <span style={{ color: '#00E5FF', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
            {evCharger.batteryLevel.toFixed(1)}%
          </span>
        </div>
        <div style={{
          width: '100%', height: '8px', borderRadius: '4px',
          background: 'rgba(255,255,255,0.05)', overflow: 'hidden',
        }}>
          <div style={{
            width: `${evCharger.batteryLevel}%`,
            height: '100%',
            borderRadius: '4px',
            background: evCharger.batteryLevel > 80 ? '#00FF9D' : evCharger.batteryLevel > 30 ? '#FFC857' : '#FF4D6D',
            transition: 'width 0.5s',
          }} />
        </div>
      </div>

      {/* Power slider */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '10px' }}>
          <span style={{ color: '#64748B' }}>Charging Power</span>
          <span style={{ color: '#F8FAFC', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
            {formatPower(evCharger.targetPower)}
          </span>
        </div>
        <input
          type="range"
          min={6000}
          max={11000}
          step={100}
          value={evCharger.targetPower}
          onChange={(e) => setEVChargingPower(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#10B981', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#64748B' }}>
          <span>6 kW</span>
          <span>11 kW</span>
        </div>
      </div>

      {/* Control buttons */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {evCharger.state === 'disconnected' && (
          <button onClick={() => { setEVBatteryLevel(20); setEVChargerState('charging'); }} style={{
            flex: 1, padding: '8px', borderRadius: '8px',
            background: 'rgba(0, 255, 157, 0.1)', border: '1px solid rgba(0, 255, 157, 0.3)',
            color: '#00FF9D', cursor: 'pointer', fontSize: '10px', fontWeight: 600,
            fontFamily: "'Orbitron', monospace",
          }}>
            Connect & Charge
          </button>
        )}
        {evCharger.state === 'charging' && (
          <button onClick={() => setEVChargerState('paused')} style={{
            flex: 1, padding: '8px', borderRadius: '8px',
            background: 'rgba(255, 200, 87, 0.1)', border: '1px solid rgba(255, 200, 87, 0.3)',
            color: '#FFC857', cursor: 'pointer', fontSize: '10px', fontWeight: 600,
            fontFamily: "'Orbitron', monospace",
          }}>
            Pause
          </button>
        )}
        {evCharger.state === 'paused' && (
          <button onClick={() => setEVChargerState('charging')} style={{
            flex: 1, padding: '8px', borderRadius: '8px',
            background: 'rgba(0, 255, 157, 0.1)', border: '1px solid rgba(0, 255, 157, 0.3)',
            color: '#00FF9D', cursor: 'pointer', fontSize: '10px', fontWeight: 600,
            fontFamily: "'Orbitron', monospace",
          }}>
            Resume
          </button>
        )}
        {evCharger.state !== 'disconnected' && (
          <button onClick={() => setEVChargerState('disconnected')} style={{
            flex: 1, padding: '8px', borderRadius: '8px',
            background: 'rgba(255, 77, 109, 0.1)', border: '1px solid rgba(255, 77, 109, 0.3)',
            color: '#FF4D6D', cursor: 'pointer', fontSize: '10px', fontWeight: 600,
            fontFamily: "'Orbitron', monospace",
          }}>
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// DEVICE LIST WITH POWER CONTROLS
// =============================================================================

function DeviceControlList() {
  const devices = useEnergyStore((s) => s.devices);
  const deviceOrder = useEnergyStore((s) => s.deviceOrder);
  const toggleDevice = useEnergyStore((s) => s.toggleDevice);
  const mcbState = useEnergyStore((s) => s.mcb.state);

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>All Appliances</h3>
        <span style={{ fontSize: '10px', color: '#64748B' }}>
          {Object.values(devices).filter(d => d.powerState === 'on').length} running
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '400px', overflowY: 'auto' }}>
        {deviceOrder.map((id) => {
          const device = devices[id];
          if (!device) return null;
          const isOn = device.powerState === 'on';
          const statusColor = DEVICE_STATUS_COLORS[device.status];

          return (
            <div key={id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '8px',
              background: isOn ? 'rgba(0, 255, 157, 0.03)' : 'rgba(255,255,255,0.01)',
              border: `1px solid ${isOn ? 'rgba(0, 255, 157, 0.08)' : 'rgba(255,255,255,0.03)'}`,
              transition: 'all 0.2s',
            }}>
              <span style={{ fontSize: '14px', flexShrink: 0 }}>{device.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: '#F8FAFC', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {device.name}
                </div>
                <div style={{ fontSize: '9px', color: '#64748B' }}>{device.room}</div>
              </div>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10px',
                color: isOn ? '#00E5FF' : '#64748B',
                minWidth: '55px',
                textAlign: 'right',
              }}>
                {isOn ? formatPower(device.currentConsumption) : '0 W'}
              </span>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
              <button
                onClick={() => toggleDevice(id)}
                disabled={mcbState === 'tripped' && !isOn}
                style={{
                  background: isOn ? 'rgba(0, 255, 157, 0.15)' : 'rgba(255, 77, 109, 0.15)',
                  border: `1px solid ${isOn ? '#00FF9D' : '#FF4D6D'}`,
                  color: isOn ? '#00FF9D' : '#FF4D6D',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  cursor: (mcbState === 'tripped' && !isOn) ? 'not-allowed' : 'pointer',
                  fontSize: '9px',
                  fontWeight: 700,
                  fontFamily: "'Orbitron', monospace",
                  minWidth: '35px',
                  opacity: (mcbState === 'tripped' && !isOn) ? 0.4 : 1,
                }}
              >
                {isOn ? 'ON' : 'OFF'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// LOAD HISTORY CHART
// =============================================================================

function LoadHistoryChart() {
  const loadHistory = useEnergyStore((s) => s.loadHistory);
  const metrics = useEnergyStore((s) => s.metrics);
  const homeConfig = useEnergyStore((s) => s.homeConfig);
  const loadColor = LOAD_LEVEL_COLORS[metrics.loadLevel];

  const chartData = useMemo(() => {
    return loadHistory.slice(-60).map((entry) => ({
      time: new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      load: Math.round(entry.load),
      capacity: homeConfig.maxCapacityWatts,
    }));
  }, [loadHistory, homeConfig.maxCapacityWatts]);

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>Load History</h3>
          <p style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>Real-time power draw (W)</p>
        </div>
        <div style={{
          padding: '4px 10px', borderRadius: '20px',
          background: `${loadColor}15`, border: `1px solid ${loadColor}30`,
          fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: loadColor,
        }}>
          LIVE
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="loadGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={loadColor} stopOpacity={0.4} />
              <stop offset="100%" stopColor={loadColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: 'rgba(11, 17, 32, 0.95)', border: '1px solid rgba(0, 229, 255, 0.2)',
              borderRadius: '8px', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#F8FAFC',
            }}
            formatter={(value: any) => [`${formatPower(Number(value) || 0)}`, 'Load']}
          />
          <Area type="monotone" dataKey="capacity" stroke="#FF4D6D" strokeWidth={1} strokeDasharray="4 4" fill="none" name="Capacity" />
          <Area type="monotone" dataKey="load" stroke={loadColor} strokeWidth={2} fill="url(#loadGradient)" name="Load" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// =============================================================================
// ROOM CONSUMPTION CHART
// =============================================================================

function RoomConsumptionChart() {
  const devices = useEnergyStore((s) => s.devices);

  const roomData = useMemo(() => {
    const rooms: Record<string, number> = {};
    Object.values(devices).forEach((d) => {
      rooms[d.room] = (rooms[d.room] || 0) + d.currentConsumption;
    });
    return Object.entries(rooms)
      .map(([name, power]) => ({ name: name.replace('Kitchen/Living', 'Kitchen/Living'), power: Math.round(power) }))
      .sort((a, b) => b.power - a.power);
  }, [devices]);

  const COLORS = ['#00E5FF', '#6366F1', '#00FF9D', '#FFC857', '#FF4D6D', '#8B5CF6'];

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', marginBottom: '16px' }}>Room Consumption</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <Pie data={roomData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="power" strokeWidth={0}>
              {roomData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ flex: 1 }}>
          {roomData.map((entry, i) => (
            <div key={entry.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                <span style={{ fontSize: '11px', color: '#CBD5E1' }}>{entry.name}</span>
              </div>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#F8FAFC', fontWeight: 600 }}>
                {formatPower(entry.power)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// EVENT LOG (COMPACT)
// =============================================================================

function CompactEventLog() {
  const events = useEnergyStore((s) => s.events).slice(0, 20);

  const severityColors: Record<string, string> = {
    info: '#00E5FF',
    warning: '#FFC857',
    error: '#FF4D6D',
    critical: '#FF0040',
  };

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Clock size={14} color="#00E5FF" />
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>Event Log</h3>
        <span style={{ fontSize: '10px', color: '#64748B', marginLeft: 'auto' }}>{events.length} events</span>
      </div>
      <div style={{ maxHeight: '300px', overflowY: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>
        {events.length === 0 ? (
          <div style={{ color: '#64748B', fontStyle: 'italic', padding: '8px 0' }}>No events yet. Toggle devices to generate events.</div>
        ) : (
          events.map((event) => (
            <div key={event.id} style={{
              display: 'flex', gap: '8px', padding: '4px 0',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
            }}>
              <span style={{ color: '#64748B', fontSize: '9px', flexShrink: 0 }}>
                {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false })}
              </span>
              <span style={{
                color: severityColors[event.severity] || '#00E5FF',
                fontWeight: 600,
                fontSize: '9px',
                flexShrink: 0,
                minWidth: '45px',
              }}>
                [{event.severity.toUpperCase().slice(0, 4)}]
              </span>
              <span style={{ color: '#CBD5E1', fontSize: '9px' }}>{event.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// =============================================================================
// ALERT TOASTS
// =============================================================================

function AlertToasts() {
  const alerts = useEnergyStore((s) => s.alerts);
  const dismissAlert = useEnergyStore((s) => s.dismissAlert);
  const activeAlerts = alerts.filter((a) => !a.dismissed).slice(0, 3);

  if (activeAlerts.length === 0) return null;

  const severityColors: Record<string, string> = {
    warning: '#FFC857',
    error: '#FF4D6D',
    critical: '#FF0040',
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '160px',
      right: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      zIndex: 50,
      maxWidth: '360px',
    }}>
      {activeAlerts.map((alert) => {
        const color = severityColors[alert.severity] || '#FFC857';
        return (
          <div key={alert.id} style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'rgba(11, 17, 32, 0.95)',
            border: `1px solid ${color}40`,
            backdropFilter: 'blur(12px)',
            boxShadow: `0 4px 20px rgba(0,0,0,0.3), 0 0 20px ${color}10`,
            animation: 'slideInRight 0.3s ease-out',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color, fontFamily: "'Orbitron', monospace" }}>
                  {alert.title}
                </div>
                <div style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '4px', lineHeight: 1.4 }}>
                  {alert.message}
                </div>
              </div>
              <button
                onClick={() => dismissAlert(alert.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '2px',
                  fontSize: '14px',
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function EnergyCommandCenter() {
  const metrics = useEnergyStore((s) => s.metrics);
  const devices = useEnergyStore((s) => s.devices);
  const evCharger = useEnergyStore((s) => s.evCharger);
  const initializeDevices = useEnergyStore((s) => s.initializeDevices);
  const tick = useEnergyStore((s) => s.tick);
  const deviceOrder = useEnergyStore((s) => s.deviceOrder);

  // Initialize and tick
  useEffect(() => {
    if (deviceOrder.length === 0) initializeDevices();
  }, [initializeDevices, deviceOrder.length]);

  useEffect(() => {
    const interval = setInterval(() => tick(), 1000);
    return () => clearInterval(interval);
  }, [tick]);

  const totalDevices = Object.keys(devices).length;
  const runningDevices = Object.values(devices).filter((d) => d.powerState === 'on').length;
  const offlineDevices = Object.values(devices).filter((d) => d.status === 'offline' || d.status === 'disconnected').length;

  return (
    <div className="fade-in" style={{ maxWidth: '1600px' }}>
      {/* Top Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <StatCard label="Current Load" value={formatPower(metrics.currentLoad)} icon={Zap} color={LOAD_LEVEL_COLORS[metrics.loadLevel]} />
        <StatCard label="Voltage" value={metrics.voltage.toString()} unit="V" icon={Activity} color="#00E5FF" />
        <StatCard label="Current" value={metrics.current.toFixed(1)} unit="A" icon={Gauge} color="#6366F1" />
        <StatCard label="Peak Load" value={formatPower(metrics.peakLoad)} icon={TrendingUp} color="#FFC857" />
        <StatCard label="Remaining" value={formatPower(metrics.availableCapacity)} icon={Battery} color="#00FF9D" />
        <StatCard label="Energy Today" value={formatEnergy(metrics.energyToday)} icon={Zap} color="#3B82F6" />
        <StatCard label="Running" value={`${runningDevices}/${totalDevices}`} icon={Cpu} color="#00E5FF" />
        <StatCard label="Est. Monthly" value={`${metrics.estimatedMonthlyKWh.toFixed(0)}`} unit="kWh" icon={TrendingUp} color="#8B5CF6" />
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <LoadGauge />
        <MCBControlPanel />
        <EVChargerPanel />
      </div>

      {/* Config + Devices */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <HomeConfigPanel />
        <DeviceControlList />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <LoadHistoryChart />
        <RoomConsumptionChart />
      </div>

      {/* Event Log */}
      <CompactEventLog />

      {/* Alert Toasts */}
      <AlertToasts />
    </div>
  );
}
