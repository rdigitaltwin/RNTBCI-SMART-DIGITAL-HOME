'use client';

/**
 * Energy Monitoring — device-first view of existing shunt / internal EPM APIs.
 * Availability is taken from the backend `available` flag (device must be ON).
 */

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity, ChevronDown, ChevronRight, Gauge, PlugZap, RefreshCw,
  Wifi, WifiOff, Zap,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import api, {
  type EpmReading,
  type Measurements,
  type MeteringCatalog,
  type MeteringCatalogDevice,
  type ShuntReading,
} from '@/services/api';
import { useDeviceStore, useEventStore, useWSStore, type Device } from '@/store';
import { DEVICE_TYPE_CONFIG } from '../devices/constants';

const LIVE_WINDOW_MS = 30_000;

/** Category 2 — each has its own Modbus shunt, all feeding the house meter. */
const SHUNT_DEVICE_TYPES = new Set([
  'dishwasher', 'washing_machine', 'solar_pv', 'nebulizer', 'energy_evse',
]);
/** Category 1 — internal EPM, wired straight to the house feed / main grid. */
const GRID_DIRECT_TYPES = new Set([
  'smart_switch', 'smart_light', 'heat_pump', 'water_heater', 'hvac', 'air_conditioner',
]);

type HistoryRange = 'live' | '1h' | '24h' | '7d';

type MonitorRow = {
  key: string;
  kind: 'grid' | 'device';
  deviceId: string | null;
  name: string;
  type: string;
  room: string;
  category: number | null;
  meterType: string;
  meterId: string;
  protocol: string;
  powerState: string | null;
  available: boolean;
  updatedAt: string | null;
  measurements: Measurements | null;
};

function typeMeta(type: string) {
  const key = type.toLowerCase();
  return DEVICE_TYPE_CONFIG[key] || { emoji: '⚡', label: type.replace(/_/g, ' '), color: '#94A3B8' };
}

function isFresh(updatedAt: string | null, available: boolean) {
  if (!available || !updatedAt) return false;
  const ts = Date.parse(updatedAt);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= LIVE_WINDOW_MS;
}

function liveMeasurements(data: ShuntReading | EpmReading | null | undefined): {
  measurements: Measurements | null;
  updatedAt: string | null;
  available: boolean;
} {
  if (!data) return { measurements: null, updatedAt: null, available: false };
  if (!data.available) {
    return { measurements: null, updatedAt: data.updatedAt, available: false };
  }
  const measurements = 'measurements' in data && data.measurements
    ? data.measurements
    : ('epm' in data && data.epm ? data.epm : null);
  return { measurements, updatedAt: data.updatedAt, available: true };
}

function formatPower(watts: number | null | undefined) {
  if (watts == null || !Number.isFinite(watts)) return null;
  if (Math.abs(watts) >= 1000) return `${(watts / 1000).toFixed(2)} kW`;
  return `${watts.toFixed(1)} W`;
}

function formatNumber(value: number | null | undefined, digits: number, unit: string) {
  if (value == null || !Number.isFinite(value)) return null;
  return { display: value.toFixed(digits), unit };
}

function rangeStart(range: HistoryRange) {
  const now = Date.now();
  const spans: Record<HistoryRange, number> = {
    live: 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  };
  return new Date(now - spans[range]).toISOString();
}

function roomFor(device: Device | undefined, rooms: { id: string; name: string }[]) {
  if (!device) return '—';
  if (device.room_name) return device.room_name;
  return rooms.find((r) => r.id === device.room_id)?.name || '—';
}

function normalizeType(type: string | undefined | null) {
  return (type || '').toLowerCase();
}

function catalogCategory(
  entry: MeteringCatalogDevice,
  linkedShunt?: ShuntReading,
): 1 | 2 | 3 | null {
  if (entry.category === 1 || entry.category === 2 || entry.category === 3) {
    return entry.category;
  }
  if (entry.meterType === 'Internal') return 1;
  if (entry.meterType === 'Shunt' || entry.meterId || linkedShunt) return 2;
  if (entry.meterType === 'None') return 3;
  const type = normalizeType(entry.type);
  if (GRID_DIRECT_TYPES.has(type)) return 1;
  if (SHUNT_DEVICE_TYPES.has(type)) return 2;
  return null;
}

export default function EnergyMonitoringPage() {
  return (
    <Suspense fallback={<div style={{ color: '#64748B', fontSize: '13px' }}>Loading energy monitoring…</div>}>
      <EnergyMonitoringView />
    </Suspense>
  );
}

function EnergyMonitoringView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const devices = useDeviceStore((s) => s.devices);
  const rooms = useDeviceStore((s) => s.rooms);
  const wsConnected = useWSStore((s) => s.connected);
  const events = useEventStore((s) => s.events);

  const [catalog, setCatalog] = useState<MeteringCatalog | null>(null);
  const [shunts, setShunts] = useState<ShuntReading[]>([]);
  const [epms, setEpms] = useState<Record<string, EpmReading>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [historyRange, setHistoryRange] = useState<HistoryRange>('live');
  const [history, setHistory] = useState<Array<{ time: string; kw: number }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [gridOpen, setGridOpen] = useState(true);

  const fetchMetering = useCallback(async () => {
    try {
      const [catalogRes, shuntRes] = await Promise.all([
        api.getMeteringCatalog(),
        api.getShuntMeters(),
      ]);
      setCatalog(catalogRes);
      const shuntList = Array.isArray(shuntRes) ? shuntRes : [];
      setShunts(shuntList);
      const shuntByDeviceId: Record<string, ShuntReading> = {};
      shuntList.forEach((s) => { if (s.deviceId) shuntByDeviceId[s.deviceId] = s; });

      const catalogCat1 = (catalogRes.devices || []).filter(
        (d) => catalogCategory(d, shuntByDeviceId[d.deviceId]) === 1
      );
      const storeCat1 = useDeviceStore.getState().devices.filter(
        (d) => GRID_DIRECT_TYPES.has(normalizeType(d.type))
      );
      const cat1Ids = Array.from(new Set([
        ...catalogCat1.map((d) => d.deviceId),
        ...storeCat1.map((d) => d.id),
      ]));
      const epmEntries = await Promise.allSettled(
        cat1Ids.map(async (id) => [id, await api.getDeviceEpm(id)] as const)
      );
      const next: Record<string, EpmReading> = {};
      epmEntries.forEach((entry) => {
        if (entry.status === 'fulfilled') next[entry.value[0]] = entry.value[1];
      });
      setEpms(next);
      setError(null);
      setSyncedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach metering');
    } finally {
      setLoading(false);
    }
  }, []);

  const powerSignature = devices
    .map((d) => `${d.id}:${d.power_state}`)
    .sort()
    .join('|');

  useEffect(() => {
    fetchMetering();
    const interval = setInterval(fetchMetering, 5000);
    return () => clearInterval(interval);
  }, [fetchMetering, powerSignature]);

  const shuntByMeter = useMemo(() => {
    const map: Record<string, ShuntReading> = {};
    shunts.forEach((s) => { map[s.meterId] = s; });
    return map;
  }, [shunts]);

  const shuntByDevice = useMemo(() => {
    const map: Record<string, ShuntReading> = {};
    shunts.forEach((s) => { if (s.deviceId) map[s.deviceId] = s; });
    return map;
  }, [shunts]);

  const rowFromCatalog = (entry: MeteringCatalogDevice, category: 1 | 2): MonitorRow => {
    const storeDevice = devices.find((d) => d.id === entry.deviceId);
    const reading = category === 1
      ? epms[entry.deviceId]
      : ((entry.meterId && shuntByMeter[entry.meterId]) || shuntByDevice[entry.deviceId]);
    const live = liveMeasurements(reading);
    const available = reading ? live.available : entry.available;
    return {
      key: entry.deviceId,
      kind: 'device',
      deviceId: entry.deviceId,
      name: storeDevice?.name || entry.name,
      type: storeDevice?.type || entry.type,
      room: roomFor(storeDevice, rooms),
      category,
      meterType: entry.meterType || (category === 1 ? 'Internal' : 'Shunt'),
      meterId: entry.meterId || (category === 1 ? 'Internal EPM' : reading && 'meterId' in reading ? reading.meterId : '—'),
      protocol: category === 1 ? 'Internal EPM' : 'Modbus',
      powerState: storeDevice?.power_state || entry.devicePowerState,
      available,
      updatedAt: live.updatedAt,
      measurements: available ? live.measurements : null,
    };
  };

  const rows: MonitorRow[] = useMemo(() => {
    const list: MonitorRow[] = [];
    const seen = new Set<string>();
    const gridReading = shuntByMeter[catalog?.grid.meterId || 'GRID001'] || shuntByMeter.GRID001;
    const gridLive = liveMeasurements(gridReading);
    if (catalog?.grid || gridReading) {
      list.push({
        key: 'grid',
        kind: 'grid',
        deviceId: null,
        name: 'House feed',
        type: 'smart_meter',
        room: 'Grid',
        category: 2,
        meterType: 'Shunt',
        meterId: gridReading?.meterId || catalog?.grid.meterId || 'GRID001',
        protocol: 'Modbus',
        powerState: 'on',
        available: gridLive.available || catalog?.grid.available === true,
        updatedAt: gridLive.updatedAt,
        measurements: gridLive.measurements,
      });
    }

    (catalog?.devices || []).forEach((entry) => {
      const category = catalogCategory(entry, shuntByDevice[entry.deviceId]);
      if (category !== 1 && category !== 2) return;
      seen.add(entry.deviceId);
      list.push(rowFromCatalog(entry, category));
    });

    shunts.forEach((shunt) => {
      if (shunt.role === 'grid' || !shunt.deviceId || seen.has(shunt.deviceId)) return;
      const storeDevice = devices.find((d) => d.id === shunt.deviceId);
      const live = liveMeasurements(shunt);
      seen.add(shunt.deviceId);
      list.push({
        key: shunt.deviceId,
        kind: 'device',
        deviceId: shunt.deviceId,
        name: storeDevice?.name || shunt.deviceName || shunt.meterId,
        type: storeDevice?.type || 'smart_meter',
        room: roomFor(storeDevice, rooms),
        category: 2,
        meterType: 'Shunt',
        meterId: shunt.meterId,
        protocol: 'Modbus',
        powerState: storeDevice?.power_state || shunt.devicePowerState || null,
        available: live.available,
        updatedAt: live.updatedAt,
        measurements: live.measurements,
      });
    });

    devices.forEach((device) => {
      if (seen.has(device.id)) return;
      const type = normalizeType(device.type);
      const category = SHUNT_DEVICE_TYPES.has(type) ? 2 : GRID_DIRECT_TYPES.has(type) ? 1 : null;
      if (!category) return;
      const shunt = shuntByDevice[device.id];
      const reading = category === 1 ? epms[device.id] : shunt;
      const live = liveMeasurements(reading);
      seen.add(device.id);
      list.push({
        key: device.id,
        kind: 'device',
        deviceId: device.id,
        name: device.name,
        type: device.type,
        room: roomFor(device, rooms),
        category,
        meterType: category === 1 ? 'Internal' : 'Shunt',
        meterId: category === 1 ? 'Internal EPM' : (shunt?.meterId || '—'),
        protocol: category === 1 ? 'Internal EPM' : 'Modbus',
        powerState: device.power_state,
        available: live.available,
        updatedAt: live.updatedAt,
        measurements: live.measurements,
      });
    });
    return list;
  }, [catalog, devices, rooms, epms, shuntByMeter, shuntByDevice, shunts]);

  useEffect(() => {
    const requested = searchParams.get('device');
    setSelectedKey((current) => {
      if (current && rows.some((r) => r.key === current)) return current;
      if (requested && rows.some((r) => r.deviceId === requested)) return requested;
      const firstLive = rows.find((r) => r.available);
      return firstLive?.key || rows[0]?.key || null;
    });
  }, [rows, searchParams]);

  const selected = rows.find((r) => r.key === selectedKey) || null;

  useEffect(() => {
    if (!selected?.deviceId || !selected.available) {
      setHistory([]);
      setHistoryError(null);
      setHistoryLoading(false);
      return;
    }
    let cancelled = false;
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const res = await api.getDevicePowerHistory({
          device_id: selected.deviceId!,
          start_date: rangeStart(historyRange),
          per_page: historyRange === '7d' ? 2000 : 800,
        }) as { records?: Array<{ timestamp: string; total_power_consumption_kw: number }> };
        if (cancelled) return;
        const records = (res.records || [])
          .slice()
          .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
          .map((r) => {
            const date = new Date(r.timestamp);
            const time = historyRange === '7d'
              ? date.toLocaleDateString([], { month: 'short', day: 'numeric' })
              : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return { time, kw: Number(r.total_power_consumption_kw) };
          })
          .filter((r) => Number.isFinite(r.kw));
        setHistory(records);
        setHistoryError(null);
      } catch (err) {
        if (!cancelled) {
          setHistory([]);
          setHistoryError(err instanceof Error ? err.message : 'History unavailable');
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };
    loadHistory();
    const interval = historyRange === 'live' ? setInterval(loadHistory, 15000) : undefined;
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [selected?.deviceId, selected?.available, historyRange]);

  const openDeviceControls = (deviceId: string) => {
    router.push(`/dashboard/devices?device=${encodeURIComponent(deviceId)}`);
  };

  const storeDevice = selected?.deviceId
    ? devices.find((d) => d.id === selected.deviceId)
    : undefined;
  const energyKwh = selected?.available && storeDevice && Number.isFinite(storeDevice.total_energy_kwh)
    ? storeDevice.total_energy_kwh
    : null;
  const selectedLive = selected ? isFresh(selected.updatedAt, selected.available) : false;

  const grouped = useMemo(() => {
    const cat1 = rows.filter((r) => r.kind === 'device' && r.category === 1);
    const cat2 = rows.filter((r) => r.kind === 'device' && r.category === 2);
    const grid = rows.filter((r) => r.kind === 'grid');
    return { cat1, cat2, grid };
  }, [rows]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Energy Monitoring</h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '6px' }}>
            Monitor connected devices and their real-time electrical consumption.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '11px', fontFamily: "'JetBrains Mono', monospace",
            color: wsConnected ? '#00FF9D' : '#FF4D6D',
            padding: '6px 10px', borderRadius: '999px',
            background: wsConnected ? 'rgba(0,255,157,0.08)' : 'rgba(255,77,109,0.08)',
            border: `1px solid ${wsConnected ? 'rgba(0,255,157,0.25)' : 'rgba(255,77,109,0.25)'}`,
          }}>
            {wsConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {wsConnected ? 'CONNECTED' : 'OFFLINE'}
          </span>
          <span style={{ fontSize: '11px', color: '#64748B', fontFamily: "'JetBrains Mono', monospace" }}>
            {syncedAt ? `Synced ${syncedAt.toLocaleTimeString()}` : 'Waiting'}
          </span>
          <button
            onClick={fetchMetering}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
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
      </header>

      {error && (
        <div style={{
          background: 'rgba(255, 77, 109, 0.08)',
          border: '1px solid rgba(255, 77, 109, 0.28)',
          color: '#FCA5A5',
          padding: '12px 16px',
          borderRadius: '12px',
          fontSize: '13px',
        }}>
          Metering is unreachable. Device controls remain available on the Devices page.
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px',
        alignItems: 'start',
      }}>
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 style={{ fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748B', margin: 0 }}>
            Connected devices
          </h2>
          {loading && rows.length === 0 && (
            <div style={{ color: '#64748B', fontSize: '13px' }}>Loading meters…</div>
          )}
          {grouped.grid.length > 0 && grouped.grid.map((grid) => (
            <HouseFeedCard
              key={grid.key}
              grid={grid}
              childrenRows={grouped.cat1}
              open={gridOpen}
              onToggle={() => setGridOpen((v) => !v)}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
            />
          ))}
          {grouped.grid.length === 0 && grouped.cat1.length > 0 && (
            <DeviceGroup title="Direct to grid" rows={grouped.cat1} selectedKey={selectedKey} onSelect={setSelectedKey} />
          )}
          {grouped.cat2.length > 0 && (
            <DeviceGroup title="Shunt meters" rows={grouped.cat2} selectedKey={selectedKey} onSelect={setSelectedKey} />
          )}
          {!loading && rows.length === 0 && !error && (
            <div style={{ fontSize: '13px', color: '#64748B' }}>No metered devices are configured.</div>
          )}
        </section>

        <section className="glass-card" style={{ padding: '22px', minHeight: rows.length ? '420px' : 'auto' }}>
          {!selected ? (
            <div style={{ color: '#64748B', fontSize: '13px' }}>
              {rows.length === 0 ? 'Meters appear here when the catalog is reachable.' : 'Select a device to inspect its meter.'}
            </div>
          ) : (
            <SelectedMeter
              row={selected}
              live={selectedLive}
              energyKwh={energyKwh}
              infoOpen={infoOpen}
              onToggleInfo={() => setInfoOpen((v) => !v)}
              history={history}
              historyRange={historyRange}
              onRange={setHistoryRange}
              historyLoading={historyLoading}
              historyError={historyError}
              onOpenControls={selected.deviceId ? () => openDeviceControls(selected.deviceId!) : undefined}
            />
          )}
        </section>
      </div>

      <section>
        <button
          onClick={() => setDiagnosticsOpen((v) => !v)}
          style={{
            background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: 0,
          }}
        >
          {diagnosticsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Diagnostics
        </button>
        {diagnosticsOpen && (
          <div className="glass-card" style={{ marginTop: '10px', padding: '14px 16px', maxHeight: '180px', overflowY: 'auto' }}>
            {events.slice(0, 20).length === 0 ? (
              <div style={{ color: '#64748B', fontSize: '12px' }}>No recent events.</div>
            ) : (
              events.slice(0, 20).map((event) => (
                <div key={event.id} style={{ display: 'flex', gap: '10px', fontSize: '12px', padding: '4px 0', color: '#94A3B8' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#64748B', minWidth: '64px' }}>
                    {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                  </span>
                  <span style={{ color: '#CBD5E1' }}>{event.device_name || 'System'}</span>
                  <span>{event.message}</span>
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function HouseFeedCard({
  grid,
  childrenRows,
  open,
  onToggle,
  selectedKey,
  onSelect,
}: {
  grid: MonitorRow;
  childrenRows: MonitorRow[];
  open: boolean;
  onToggle: () => void;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#475569' }}>
        House feed
      </div>
      <div
        style={{
          borderRadius: '14px',
          background: selectedKey === grid.key ? 'rgba(0, 229, 255, 0.08)' : 'rgba(15, 23, 42, 0.55)',
          border: `1px solid ${selectedKey === grid.key ? 'rgba(0, 229, 255, 0.35)' : 'rgba(255,255,255,0.06)'}`,
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <DeviceRowCard
              row={grid}
              selected={false}
              onSelect={() => onSelect(grid.key)}
              embedded
            />
          </div>
          {childrenRows.length > 0 && (
            <button
              aria-label={open ? 'Hide grid-connected devices' : 'Show grid-connected devices'}
              onClick={onToggle}
              style={{
                width: '40px',
                flexShrink: 0,
                background: 'transparent',
                border: 'none',
                borderLeft: '1px solid rgba(255,255,255,0.06)',
                color: '#00E5FF',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
        </div>
        {open && childrenRows.length > 0 && (
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '8px 8px 10px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}>
            <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', padding: '4px 6px 2px' }}>
              Direct to grid
            </div>
            {childrenRows.map((row) => (
              <DeviceRowCard
                key={row.key}
                row={row}
                selected={selectedKey === row.key}
                onSelect={() => onSelect(row.key)}
                nested
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DeviceGroup({
  title,
  rows,
  selectedKey,
  onSelect,
}: {
  title: string;
  rows: MonitorRow[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#475569' }}>{title}</div>
      {rows.map((row) => (
        <DeviceRowCard
          key={row.key}
          row={row}
          selected={selectedKey === row.key}
          onSelect={() => onSelect(row.key)}
        />
      ))}
    </div>
  );
}

function DeviceRowCard({
  row,
  selected,
  onSelect,
  nested = false,
  embedded = false,
}: {
  row: MonitorRow;
  selected: boolean;
  onSelect: () => void;
  nested?: boolean;
  embedded?: boolean;
}) {
  const meta = typeMeta(row.type);
  const power = row.available ? formatPower(row.measurements?.power) : null;

  return (
    <button
      onClick={onSelect}
      style={{
        textAlign: 'left',
        width: '100%',
        padding: nested ? '10px 12px' : '14px',
        borderRadius: embedded ? 0 : (nested ? '10px' : '14px'),
        background: embedded
          ? 'transparent'
          : selected ? 'rgba(0, 229, 255, 0.08)' : (nested ? 'rgba(11, 17, 32, 0.7)' : 'rgba(15, 23, 42, 0.55)'),
        border: embedded
          ? 'none'
          : `1px solid ${selected ? 'rgba(0, 229, 255, 0.35)' : 'rgba(255,255,255,0.06)'}`,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: nested ? '6px' : '8px',
        transition: 'border-color 0.2s ease, background 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', minWidth: 0 }}>
          <span style={{ fontSize: '20px', lineHeight: 1 }}>{meta.emoji}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row.name}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{row.room}</div>
          </div>
        </div>
        {power ? (
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: '#00E5FF', fontWeight: 700 }}>
            {power}
          </div>
        ) : row.kind === 'grid' ? (
          <div style={{ fontSize: '11px', color: '#64748B' }}>—</div>
        ) : null}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#94A3B8' }}>{row.meterId}</span>
        <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {row.kind !== 'grid' && (
            <StatusChip on={row.powerState === 'on'} label={row.powerState === 'on' ? 'ON' : 'OFF'} />
          )}
          <StatusChip on={row.available} label={row.available ? 'METER CONNECTED' : 'UNAVAILABLE'} />
        </span>
      </div>
    </button>
  );
}

function StatusChip({ on, label }: { on: boolean; label: string }) {
  return (
    <span style={{
      fontSize: '9px',
      fontWeight: 700,
      letterSpacing: '0.08em',
      color: on ? '#00FF9D' : '#94A3B8',
      background: on ? 'rgba(0,255,157,0.1)' : 'rgba(148,163,184,0.1)',
      border: `1px solid ${on ? 'rgba(0,255,157,0.28)' : 'rgba(148,163,184,0.2)'}`,
      borderRadius: '999px',
      padding: '3px 7px',
    }}>
      {label}
    </span>
  );
}

function SelectedMeter({
  row,
  live,
  energyKwh,
  infoOpen,
  onToggleInfo,
  history,
  historyRange,
  onRange,
  historyLoading,
  historyError,
  onOpenControls,
}: {
  row: MonitorRow;
  live: boolean;
  energyKwh: number | null;
  infoOpen: boolean;
  onToggleInfo: () => void;
  history: Array<{ time: string; kw: number }>;
  historyRange: HistoryRange;
  onRange: (range: HistoryRange) => void;
  historyLoading: boolean;
  historyError: string | null;
  onOpenControls?: () => void;
}) {
  const meta = typeMeta(row.type);
  const voltage = row.available ? formatNumber(row.measurements?.voltage, 1, 'V') : null;
  const current = row.available ? formatNumber(row.measurements?.current, 3, 'A') : null;
  const power = row.available ? formatNumber(row.measurements?.power, 1, 'W') : null;
  const energy = row.available && energyKwh != null ? formatNumber(energyKwh, 2, 'kWh') : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: `${meta.color}18`, border: `1px solid ${meta.color}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
          }}>
            {meta.emoji}
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 650, color: '#F8FAFC' }}>{row.name}</div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
              {row.room} · {row.meterId}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {live && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '11px', color: '#00E5FF',
              padding: '4px 10px', borderRadius: '999px',
              background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.25)',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00E5FF', boxShadow: '0 0 8px rgba(0,229,255,0.8)' }} />
              LIVE
            </span>
          )}
          {onOpenControls && (
            <button
              onClick={onOpenControls}
              style={{
                padding: '8px 12px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#E2E8F0', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              }}
            >
              Device controls
            </button>
          )}
        </div>
      </div>

      {!row.available ? (
        <div style={{
          padding: '28px 20px',
          borderRadius: '16px',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px dashed rgba(148,163,184,0.25)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '16px', fontWeight: 650, color: '#F8FAFC' }}>Shunt Meter Unavailable</div>
          <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '8px', lineHeight: 1.5 }}>
            {row.powerState === 'on'
              ? 'Meter readings are not available for this device yet.'
              : 'Turn on the associated device to resume energy monitoring.'}
          </div>
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#64748B' }}>
            {row.name} is {row.powerState === 'on' ? 'ON' : 'OFF'}
          </div>
          {onOpenControls && (
            <button
              onClick={onOpenControls}
              style={{
                marginTop: '16px',
                padding: '9px 14px',
                borderRadius: '8px',
                background: 'rgba(0, 229, 255, 0.1)',
                border: '1px solid rgba(0, 229, 255, 0.3)',
                color: '#00E5FF',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              Open device controls
            </button>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            <MetricCell icon={<Zap size={14} color="#00E5FF" />} label="Voltage" value={voltage} />
            <MetricCell icon={<Activity size={14} color="#FFC857" />} label="Current" value={current} />
            <MetricCell icon={<PlugZap size={14} color="#00FF9D" />} label="Active Power" value={
              power && row.measurements?.power != null && Math.abs(row.measurements.power) >= 1000
                ? { display: (row.measurements.power / 1000).toFixed(2), unit: 'kW' }
                : power
            } />
            {energy && <MetricCell icon={<Gauge size={14} color="#818CF8" />} label="Energy" value={energy} />}
          </div>

          {row.deviceId && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748B', margin: 0 }}>
                  Consumption history
                </h3>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['live', '1h', '24h', '7d'] as HistoryRange[]).map((range) => (
                    <button
                      key={range}
                      onClick={() => onRange(range)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        color: historyRange === range ? '#050816' : '#94A3B8',
                        background: historyRange === range ? '#00E5FF' : 'transparent',
                        border: `1px solid ${historyRange === range ? '#00E5FF' : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >
                      {range === 'live' ? 'Live' : range === '1h' ? '1 Hour' : range === '24h' ? '24 Hours' : '7 Days'}
                    </button>
                  ))}
                </div>
              </div>
              {historyLoading && history.length === 0 ? (
                <div style={{ color: '#64748B', fontSize: '12px', padding: '24px 0' }}>Loading history…</div>
              ) : history.length === 0 ? (
                <div style={{ color: '#64748B', fontSize: '12px', padding: '24px 0' }}>
                  {historyError ? 'Historical telemetry is not available for this device.' : 'No historical telemetry for this period.'}
                </div>
              ) : (
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                      <defs>
                        <linearGradient id="kwFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00E5FF" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#00E5FF" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="time" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
                      <YAxis tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                      <Tooltip
                        contentStyle={{ background: '#0B1120', border: '1px solid rgba(0,229,255,0.2)', borderRadius: 8, fontSize: 12 }}
                        formatter={(value) => [`${Number(value).toFixed(3)} kW`, 'Power']}
                      />
                      <Area type="monotone" dataKey="kw" stroke="#00E5FF" fill="url(#kwFill)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div>
        <button
          onClick={onToggleInfo}
          style={{
            background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: 0,
          }}
        >
          {infoOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Meter information
        </button>
        {infoOpen && (
          <div style={{
            marginTop: '10px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '10px',
          }}>
            <InfoCell label="Meter ID" value={row.meterId} />
            <InfoCell label="Associated device" value={row.name} />
            <InfoCell label="Meter category" value={row.category === 1 ? 'Category 1 · Internal EPM' : row.kind === 'grid' ? 'Grid shunt' : 'Category 2 · Modbus shunt'} />
            <InfoCell label="Protocol" value={row.protocol} />
            <InfoCell label="Connection" value={row.available ? 'Connected' : 'Unavailable'} />
            <InfoCell label="Last successful reading" value={row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—'} />
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCell({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: { display: string; unit: string } | null;
}) {
  return (
    <div style={{
      padding: '16px',
      borderRadius: '14px',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      minHeight: '92px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', fontSize: '11px', marginBottom: '8px' }}>
        {icon}
        {label}
      </div>
      {value ? (
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#F8FAFC', fontSize: '24px', lineHeight: 1.1 }}>
          {value.display}
          <span style={{ fontSize: '12px', color: '#64748B', marginLeft: '6px', fontWeight: 500 }}>{value.unit}</span>
        </div>
      ) : (
        <div style={{ color: '#475569', fontSize: '18px' }}>—</div>
      )}
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ fontSize: '10px', color: '#64748B', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '12px', color: '#E2E8F0', fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
    </div>
  );
}
