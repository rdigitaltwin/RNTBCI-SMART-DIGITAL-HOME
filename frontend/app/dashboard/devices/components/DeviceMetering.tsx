'use client';

import { useCallback, useEffect, useState } from 'react';
import { Gauge, PlugZap, Power, ShieldAlert, Zap } from 'lucide-react';
import api, { type EpmReading, type Measurements, type ShuntReading } from '@/services/api';
import { toggleDeviceState, type Device } from '@/store';

function readingsFrom(data: ShuntReading | EpmReading): Measurements {
  if ('measurements' in data && data.measurements) return data.measurements;
  if ('epm' in data && data.epm) return data.epm;
  return { voltage: 0, current: 0, power: 0 };
}

function fmt(value: number, digits = 2) {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

export function MeasurementStrip({
  measurements,
  available,
  compact = false,
}: {
  measurements: Measurements;
  available: boolean;
  compact?: boolean;
}) {
  const cells = [
    { label: 'Voltage', value: `${fmt(measurements.voltage)} V`, live: true, color: '#00E5FF' },
    { label: 'Current', value: available ? `${fmt(measurements.current, 3)} A` : '—', live: available, color: '#FFC857' },
    { label: 'Power', value: available ? `${fmt(measurements.power, 1)} W` : '—', live: available, color: '#00FF9D' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: compact ? '8px' : '12px' }}>
      {cells.map((cell) => (
        <div
          key={cell.label}
          style={{
            background: 'rgba(255,255,255,0.02)',
            padding: compact ? '10px 12px' : '14px 16px',
            borderRadius: '12px',
            border: `1px solid ${cell.live ? 'rgba(0, 229, 255, 0.18)' : 'rgba(255,255,255,0.05)'}`,
            opacity: cell.live ? 1 : 0.55,
          }}
        >
          <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>{cell.label}</div>
          <div
            style={{
              fontSize: compact ? '15px' : '18px',
              fontWeight: 700,
              color: cell.live ? cell.color : '#64748B',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {cell.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DeviceMetering({ device }: { device: Device }) {
  const [reading, setReading] = useState<ShuntReading | EpmReading | null>(null);
  const [category3, setCategory3] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getDeviceMetering(device.id);
      setReading(data);
      setCategory3(false);
      setError(null);
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      const message = err instanceof Error ? err.message : 'Metering unavailable';
      if (status === 404 || /Category 3|not available/i.test(message)) {
        setCategory3(true);
        setReading(null);
        setError(null);
        return;
      }
      setError(message);
    }
  }, [device.id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load, device.power_state]);

  const handleTurnOn = async () => {
    if (toggling) return;
    setToggling(true);
    try {
      await toggleDeviceState(device, 'on');
      await load();
    } finally {
      setToggling(false);
    }
  };

  if (category3) {
    return (
      <div>
        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748B', marginBottom: '12px' }}>
          Metering
        </h3>
        <div style={{
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: '12px',
          padding: '14px 16px',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start',
        }}>
          <ShieldAlert size={16} color="#818CF8" style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: '12px', color: '#CBD5E1', lineHeight: 1.5 }}>
            Category 3 battery / control-only device. No shunt or internal EPM is attached — use the existing control API.
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748B', marginBottom: '12px' }}>
          Metering
        </h3>
        <div style={{
          background: 'rgba(255, 200, 87, 0.08)',
          border: '1px solid rgba(255, 200, 87, 0.25)',
          borderRadius: '12px',
          padding: '14px 16px',
          fontSize: '12px',
          color: '#FCD34D',
          lineHeight: 1.5,
        }}>
          Shunt / EPM API is unreachable ({error}). Load values appear here once the backend metering routes are running.
        </div>
      </div>
    );
  }

  if (!reading) return null;

  const measurements = readingsFrom(reading);
  const meterType = reading.meterType;
  const meterId = 'meterId' in reading ? reading.meterId : 'Internal EPM';
  const available = reading.available;

  return (
    <div>
      <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748B', marginBottom: '12px' }}>
        {meterType === 'Shunt' ? 'Shunt Meter' : 'Internal EPM'}
      </h3>
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {meterType === 'Shunt' ? <PlugZap size={14} color="#00E5FF" /> : <Gauge size={14} color="#8B5CF6" />}
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#94A3B8' }}>
              {meterId}
            </span>
          </div>
          <span style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: available ? '#00FF9D' : '#FFC857',
            background: available ? 'rgba(0,255,157,0.12)' : 'rgba(255,200,87,0.12)',
            border: `1px solid ${available ? 'rgba(0,255,157,0.3)' : 'rgba(255,200,87,0.3)'}`,
            borderRadius: '999px',
            padding: '3px 8px',
          }}>
            {available ? 'LOAD LIVE' : 'DEVICE OFF'}
          </span>
        </div>

        <MeasurementStrip measurements={measurements} available={available} />

        {!available && (
          <button
            onClick={handleTurnOn}
            disabled={toggling}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              borderRadius: '10px',
              background: 'rgba(0, 255, 157, 0.1)',
              border: '1px solid rgba(0, 255, 157, 0.3)',
              color: '#00FF9D',
              cursor: toggling ? 'wait' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Power size={14} />
            {toggling ? 'Turning on…' : 'Turn device ON to read current & power'}
          </button>
        )}

        {available && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748B' }}>
            <Zap size={12} color="#FFC857" />
            Power = voltage × current
          </div>
        )}
      </div>
    </div>
  );
}
