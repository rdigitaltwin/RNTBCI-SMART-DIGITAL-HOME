'use client';

/**
 * Shunt Meter Integration — Category 1 internal EPM, Category 2 Modbus shunts,
 * GRID001 house feed, Category 3 control-only. Load values only while the device is ON.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Activity, Gauge, PlugZap, Power, RefreshCw, ShieldAlert, Zap } from 'lucide-react';
import api, {
  type EpmReading,
  type Measurements,
  type MeteringCatalog,
  type MeteringCatalogDevice,
  type ShuntReading,
} from '@/services/api';
import { toggleDeviceState, useDeviceStore } from '@/store';
import { MeasurementStrip } from '../devices/components/DeviceMetering';
import { DEVICE_TYPE_CONFIG } from '../devices/constants';

const EMPTY: Measurements = { voltage: 0, current: 0, power: 0 };

function readingsFrom(data: ShuntReading | EpmReading | null | undefined): Measurements {
  if (!data) return EMPTY;
  if ('measurements' in data && data.measurements) return data.measurements;
  if ('epm' in data && data.epm) return data.epm;
  return EMPTY;
}

function typeLabel(type: string) {
  const key = type.toLowerCase();
  return DEVICE_TYPE_CONFIG[key]?.label || type.replace(/_/g, ' ');
}

function typeEmoji(type: string) {
  const key = type.toLowerCase();
  return DEVICE_TYPE_CONFIG[key]?.emoji || '⚡';
}

function CardShell({ children, accent }: { children: ReactNode; accent: string }) {
  return (
    <div
      className="glass-card"
      style={{
        padding: '18px',
        border: `1px solid ${accent}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        minHeight: '210px',
      }}
    >
      {children}
    </div>
  );
}

function LiveBadge({ live }: { live: boolean }) {
  return (
    <span style={{
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.08em',
      color: live ? '#00FF9D' : '#FFC857',
      background: live ? 'rgba(0,255,157,0.12)' : 'rgba(255,200,87,0.12)',
      border: `1px solid ${live ? 'rgba(0,255,157,0.3)' : 'rgba(255,200,87,0.3)'}`,
      borderRadius: '999px',
      padding: '3px 8px',
    }}>
      {live ? 'LOAD LIVE' : 'DEVICE OFF'}
    </span>
  );
}

function MeterCard({
  title,
  subtitle,
  type,
  meterId,
  available,
  measurements,
  deviceId,
  categoryLabel,
  onToggle,
  toggling,
}: {
  title: string;
  subtitle: string;
  type: string;
  meterId: string;
  available: boolean;
  measurements: Measurements;
  deviceId?: string | null;
  categoryLabel: string;
  onToggle?: () => void;
  toggling?: boolean;
}) {
  return (
    <CardShell accent={available ? 'rgba(0, 229, 255, 0.18)' : 'rgba(255, 200, 87, 0.18)'}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '22px' }}>{typeEmoji(type)}</span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>{title}</div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
              {subtitle} · {typeLabel(type)}
            </div>
          </div>
        </div>
        <LiveBadge live={available} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#94A3B8' }}>
          {meterId}
        </span>
        <span style={{ fontSize: '10px', color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {categoryLabel}
        </span>
      </div>

      <MeasurementStrip measurements={measurements} available={available} compact />

      {deviceId && onToggle && (
        <button
          onClick={onToggle}
          disabled={toggling}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '8px',
            borderRadius: '10px',
            background: available ? 'rgba(255, 77, 109, 0.1)' : 'rgba(0, 255, 157, 0.1)',
            border: `1px solid ${available ? 'rgba(255, 77, 109, 0.3)' : 'rgba(0, 255, 157, 0.3)'}`,
            color: available ? '#FF4D6D' : '#00FF9D',
            cursor: toggling ? 'wait' : 'pointer',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          <Power size={13} />
          {toggling ? 'Updating…' : available ? 'Turn OFF' : 'Turn ON to read load'}
        </button>
      )}
    </CardShell>
  );
}

export default function ShuntMeterPage() {
  const devices = useDeviceStore((s) => s.devices);
  const [catalog, setCatalog] = useState<MeteringCatalog | null>(null);
  const [shunts, setShunts] = useState<ShuntReading[]>([]);
  const [epms, setEpms] = useState<Record<string, EpmReading>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [catalogRes, shuntRes] = await Promise.all([
        api.getMeteringCatalog(),
        api.getShuntMeters(),
      ]);
      setCatalog(catalogRes);
      setShunts(Array.isArray(shuntRes) ? shuntRes : []);

      const cat1 = (catalogRes.devices || []).filter((d) => d.category === 1);
      const epmEntries = await Promise.allSettled(
        cat1.map(async (d) => [d.deviceId, await api.getDeviceEpm(d.deviceId)] as const)
      );
      const next: Record<string, EpmReading> = {};
      epmEntries.forEach((entry) => {
        if (entry.status === 'fulfilled') {
          next[entry.value[0]] = entry.value[1];
        }
      });
      setEpms(next);
      setError(null);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metering');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const shuntByMeter = useMemo(() => {
    const map: Record<string, ShuntReading> = {};
    shunts.forEach((s) => { map[s.meterId] = s; });
    return map;
  }, [shunts]);

  const shuntByDevice = useMemo(() => {
    const map: Record<string, ShuntReading> = {};
    shunts.forEach((s) => {
      if (s.deviceId) map[s.deviceId] = s;
    });
    return map;
  }, [shunts]);

  const grid = shuntByMeter.GRID001 || shuntByMeter[catalog?.grid.meterId || 'GRID001'];
  const cat1 = (catalog?.devices || []).filter((d) => d.category === 1);
  const cat2 = (catalog?.devices || []).filter((d) => d.category === 2);
  const cat3 = (catalog?.devices || []).filter((d) => d.category === 3);

  const handleToggle = async (row: MeteringCatalogDevice) => {
    const storeDevice = devices.find((d) => d.id === row.deviceId);
    if (!storeDevice || togglingId) return;
    setTogglingId(row.deviceId);
    try {
      await toggleDeviceState(storeDevice, storeDevice.power_state === 'on' ? 'off' : 'on');
      await fetchAll();
    } finally {
      setTogglingId(null);
    }
  };

  const liveCount = [...cat1, ...cat2].filter((d) => d.available).length + (grid?.available ? 1 : 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <PlugZap size={18} color="#00E5FF" />
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>
              Shunt Meter Integration
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: '#94A3B8', maxWidth: '720px', lineHeight: 1.5 }}>
            Category 1 devices expose an internal EPM. Category 2 loads are read through Modbus shunts
            (SHUNT001–005). GRID001 is the house feed (solar generation is excluded from the grid sum).
            Current and power are only readable while the linked device is ON.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#64748B' }}>
            {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : 'Waiting…'}
          </span>
          <button
            onClick={fetchAll}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 12px', borderRadius: '8px',
              background: 'rgba(0, 229, 255, 0.08)',
              border: '1px solid rgba(0, 229, 255, 0.25)',
              color: '#00E5FF', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
            }}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Live meters', value: String(liveCount), icon: Activity, color: '#00FF9D' },
          { label: 'Cat 1 EPM', value: String(cat1.length), icon: Gauge, color: '#8B5CF6' },
          { label: 'Cat 2 Shunts', value: String(cat2.length), icon: PlugZap, color: '#00E5FF' },
          { label: 'Cat 3 Control', value: String(cat3.length), icon: ShieldAlert, color: '#818CF8' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Icon size={16} color={stat.color} />
              <div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>{stat.label}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '18px', fontWeight: 700, color: stat.color }}>
                  {stat.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{
          background: 'rgba(255, 77, 109, 0.1)',
          border: '1px solid rgba(255, 77, 109, 0.35)',
          color: '#FF4D6D',
          padding: '12px 16px',
          borderRadius: '12px',
          fontSize: '13px',
        }}>
          {error}. Start the backend and apply the shunt-meter migration if this persists.
        </div>
      )}

      {loading && !catalog && (
        <div style={{ color: '#64748B', fontSize: '13px' }}>Loading metering catalog…</div>
      )}

      <section>
        <SectionTitle icon={<Zap size={14} color="#FFC857" />} title="GRID001 — House feed" hint="Always readable. Sum of Category 1 EPM + Category 2 shunts except solar." />
        {grid ? (
          <MeterCard
            title="Grid intake"
            subtitle="Modbus grid shunt"
            type="smart_meter"
            meterId={grid.meterId}
            available={grid.available}
            measurements={readingsFrom(grid)}
            categoryLabel="Grid"
          />
        ) : (
          !error && <EmptyHint text="GRID001 will appear once the metering catalog loads." />
        )}
      </section>

      <section>
        <SectionTitle icon={<PlugZap size={14} color="#00E5FF" />} title="Category 2 — Modbus shunt meters" hint="Dishwasher, washing machine, solar, nebulizer, EVSE." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {cat2.map((row) => {
            const reading = (row.meterId && shuntByMeter[row.meterId]) || shuntByDevice[row.deviceId];
            return (
              <MeterCard
                key={row.deviceId}
                title={row.name}
                subtitle="Shunt"
                type={row.type}
                meterId={row.meterId || reading?.meterId || '—'}
                available={reading?.available ?? row.available}
                measurements={readingsFrom(reading)}
                deviceId={row.deviceId}
                categoryLabel="Category 2"
                onToggle={() => handleToggle(row)}
                toggling={togglingId === row.deviceId}
              />
            );
          })}
          {!loading && cat2.length === 0 && (
            <EmptyHint text="No Category 2 shunt devices in the catalog yet." />
          )}
        </div>
      </section>

      <section>
        <SectionTitle icon={<Gauge size={14} color="#8B5CF6" />} title="Category 1 — Internal EPM" hint="Switch, light, heat pump, water heater. Values live on the device EPM, not a shunt." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {cat1.map((row) => {
            const reading = epms[row.deviceId];
            return (
              <MeterCard
                key={row.deviceId}
                title={row.name}
                subtitle="Internal EPM"
                type={row.type}
                meterId="Internal"
                available={reading?.available ?? row.available}
                measurements={readingsFrom(reading)}
                deviceId={row.deviceId}
                categoryLabel="Category 1"
                onToggle={() => handleToggle(row)}
                toggling={togglingId === row.deviceId}
              />
            );
          })}
          {!loading && cat1.length === 0 && (
            <EmptyHint text="No Category 1 internal-EPM devices in the catalog yet." />
          )}
        </div>
      </section>

      <section>
        <SectionTitle icon={<ShieldAlert size={14} color="#818CF8" />} title="Category 3 — Control only" hint="Door lock, garage door, camera, EV. No voltage, current, or power." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          {cat3.map((row) => (
            <div key={row.deviceId} className="glass-card" style={{ padding: '14px 16px', opacity: 0.85 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>{typeEmoji(row.type)}</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#F8FAFC' }}>{row.name}</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>{typeLabel(row.type)} · no meter</div>
                </div>
              </div>
            </div>
          ))}
          {!loading && cat3.length === 0 && (
            <EmptyHint text="No Category 3 devices listed." />
          )}
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return (
    <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {icon}
        <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>{title}</h2>
      </div>
      <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>{hint}</p>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <div style={{ color: '#64748B', fontSize: '13px', fontStyle: 'italic' }}>{text}</div>;
}
