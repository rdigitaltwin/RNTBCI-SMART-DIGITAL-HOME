'use client';

/**
 * RNTBCI Smart Home Digital Twin — Event Stream Page
 *
 * Terminal-style event log with filtering, severity coloring,
 * and real-time updates via WebSocket.
 */

import { useEffect, useState, useMemo } from 'react';
import { Activity, Filter, Search, Download, AlertTriangle, Info, XCircle, AlertOctagon } from 'lucide-react';
import { useEventStore, type DeviceEvent } from '@/store';
import api from '@/services/api';

const SEVERITY_CONFIG: Record<string, { color: string; icon: any; bg: string }> = {
  info: { color: '#00E5FF', icon: Info, bg: 'rgba(0, 229, 255, 0.08)' },
  warning: { color: '#FFC857', icon: AlertTriangle, bg: 'rgba(255, 200, 87, 0.08)' },
  error: { color: '#FF4D6D', icon: XCircle, bg: 'rgba(255, 77, 109, 0.08)' },
  critical: { color: '#FF0040', icon: AlertOctagon, bg: 'rgba(255, 0, 64, 0.08)' },
};

export default function EventsPage() {
  const storeEvents = useEventStore((s) => s.events);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [events, setEvents] = useState<DeviceEvent[]>([]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await api.getEvents({ page: 1 });
        const data = res as { events?: DeviceEvent[] };
        if (data.events) setEvents(data.events);
      } catch {
        // Generate demo events
        const demoEvents: DeviceEvent[] = Array.from({ length: 30 }, (_, i) => ({
          id: String(i),
          device_id: '',
          device_name: ['Living Room AC', 'Refrigerator', 'WiFi Router', 'Door Lock', 'Security Camera'][i % 5],
          event_type: ['state_change', 'temperature_reached', 'motion_detected', 'filter_check', 'power_toggle'][i % 5],
          severity: ['info', 'info', 'warning', 'info', 'warning'][i % 5],
          message: [
            'Target temperature reached',
            'Compressor cycle completed',
            'Unusual bandwidth spike detected',
            'Auto-locked after timeout',
            'Motion detected in garage',
          ][i % 5],
          timestamp: new Date(Date.now() - i * 120000).toISOString(),
        }));
        setEvents(demoEvents);
      }
    };
    fetchEvents();
  }, []);

  // Merge store events with fetched events
  const allEvents = useMemo(() => {
    const merged = [...storeEvents, ...events];
    const unique = Array.from(new Map(merged.map((e) => [e.id, e])).values());
    return unique.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [storeEvents, events]);

  const filteredEvents = useMemo(() => {
    let result = allEvents;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((e) =>
        e.message.toLowerCase().includes(q) ||
        (e.device_name || '').toLowerCase().includes(q) ||
        e.event_type.includes(q)
      );
    }
    if (severityFilter !== 'all') result = result.filter((e) => e.severity === severityFilter);
    return result;
  }, [allEvents, search, severityFilter]);

  return (
    <div className="fade-in" style={{ maxWidth: '1400px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#F8FAFC' }}>Event Stream</h2>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>{filteredEvents.length} events</p>
        </div>
        <button className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 14px', borderRadius: '8px',
          background: 'rgba(11, 17, 32, 0.5)', border: '1px solid rgba(0, 229, 255, 0.1)',
          flex: 1, maxWidth: '350px',
        }}>
          <Search size={14} color="#64748B" />
          <input
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: '#F8FAFC', fontSize: '13px', width: '100%' }}
          />
        </div>
        {['all', 'info', 'warning', 'error', 'critical'].map((sev) => (
          <button
            key={sev}
            onClick={() => setSeverityFilter(sev)}
            style={{
              padding: '8px 14px', borderRadius: '8px', cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600,
              textTransform: 'uppercase',
              background: severityFilter === sev ? (SEVERITY_CONFIG[sev]?.bg || 'rgba(0, 229, 255, 0.1)') : 'transparent',
              border: `1px solid ${severityFilter === sev ? (SEVERITY_CONFIG[sev]?.color || '#00E5FF') + '40' : 'rgba(255,255,255,0.06)'}`,
              color: severityFilter === sev ? (SEVERITY_CONFIG[sev]?.color || '#00E5FF') : '#64748B',
              transition: 'all 0.2s',
            }}
          >
            {sev}
          </button>
        ))}
      </div>

      {/* Event List */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div className="event-stream" style={{ maxHeight: 'calc(100vh - 380px)', padding: '8px 0' }}>
          {filteredEvents.map((event, i) => {
            const config = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.info;
            const Icon = config.icon;
            return (
              <div
                key={event.id || i}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)',
                  transition: 'background 0.2s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = config.bg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Icon size={14} color={config.color} style={{ flexShrink: 0 }} />
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '11px',
                  color: '#64748B', minWidth: '65px', flexShrink: 0,
                }}>
                  {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                </span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '10px',
                  color: config.color, minWidth: '60px', textTransform: 'uppercase',
                  fontWeight: 600, flexShrink: 0,
                }}>
                  {event.severity}
                </span>
                <span style={{ fontSize: '13px', color: '#F8FAFC', fontWeight: 500, minWidth: '150px', flexShrink: 0 }}>
                  {event.device_name || 'System'}
                </span>
                <span style={{ fontSize: '12px', color: '#CBD5E1', flex: 1 }}>
                  {event.message}
                </span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '10px',
                  color: '#64748B', padding: '2px 8px', borderRadius: '4px',
                  background: 'rgba(255,255,255,0.03)', flexShrink: 0,
                }}>
                  {event.event_type.replace(/_/g, ' ')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
