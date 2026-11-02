'use client';

import { useCallback, useEffect, useState } from 'react';
import { Gauge, PlugZap, ShieldAlert } from 'lucide-react';
import api, { type EpmReading, type Measurements, type ShuntReading } from '@/services/api';
import { type Device } from '@/store';

function readingsFrom(data: ShuntReading | EpmReading): Measurements | null {
  if (!data.available) return null;
  if ('measurements' in data && data.measurements) return data.measurements;
  if ('epm' in data && data.epm) return data.epm;
  return null;
}

function fmt(value: number, digits = 2) {
  if (!Number.isFinite(value)) return null;
  return value.toFixed(digits);
}

export function MeasurementStrip({
  measurements,
  available,
  compact = false,
}: {
  measurements: Measurements | null;
  available: boolean;
  compact?: boolean;
}) {
  if (!available || !measurements) return null;

  const voltage = fmt(measurements.voltage);
  const current = fmt(measurements.current, 3);
  const power = fmt(measurements.power, 1);
  const cells = [
    { label: 'Voltage', value: voltage ? `${voltage} V` : null, color: '#00E5FF' },
    { label: 'Current', value: current ? `${current} A` : null, color: '#FFC857' },
    { label: 'Power', value: power ? `${power} W` : null, color: '#00FF9D' },
  ].filter((cell) => cell.value != null);

  if (cells.length === 0) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cells.length}, 1fr)`, gap: compact ? '8px' : '12px' }}>
      {cells.map((cell) => (
        <div
          key={cell.label}
          style={{
            background: 'rgba(255,255,255,0.02)',
            padding: compact ? '10px 12px' : '14px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(0, 229, 255, 0.18)',
          }}
        >
          <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>{cell.label}</div>
          <div
            style={{
              fontSize: compact ? '15px' : '18px',
              fontWeight: 700,
              color: cell.color,
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
  const [loading, setLoading] = useState(true);

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
    } finally {
      setLoading(false);
    }
  }, [device.id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load, device.power_state]);

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
            Control-only device. Electrical monitoring is not attached.
          </div>
        </div>
      </div>
    );
  }

  if (error) return null;

  if (loading && !reading) return null;
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
            color: available ? '#00FF9D' : '#94A3B8',
            background: available ? 'rgba(0,255,157,0.12)' : 'rgba(148,163,184,0.12)',
            border: `1px solid ${available ? 'rgba(0,255,157,0.3)' : 'rgba(148,163,184,0.25)'}`,
            borderRadius: '999px',
            padding: '3px 8px',
          }}>
            {available ? 'METER CONNECTED' : 'OFF'}
          </span>
        </div>

        {available ? (
          <MeasurementStrip measurements={measurements} available={available} />
        ) : (
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', marginBottom: '4px' }}>
              Shunt Meter Unavailable
            </div>
            <div style={{ fontSize: '12px', color: '#94A3B8', lineHeight: 1.5 }}>
              Turn on the associated device to resume energy monitoring.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
