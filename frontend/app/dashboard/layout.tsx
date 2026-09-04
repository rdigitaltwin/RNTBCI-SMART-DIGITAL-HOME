 
'use client';

/**
 * RNTBCI Smart Home Digital Twin — Dashboard Layout
 *
 * The main application shell with sidebar, top bar, and content area.
 * Features: Iron Man style HUD navigation, real-time status indicators,
 * live event stream footer.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard, Cpu, Zap, Bell, Activity,
  Clock, Film, Settings, LogOut, Menu, X,
  Home, Wifi, WifiOff, ChevronRight,
  Gauge, Play, Pause, SkipForward,
  Shield, PlugZap,
} from 'lucide-react';
import api from '@/services/api';
import wsClient from '@/services/websocket';
import { useAuthStore, useDeviceStore, useUIStore, useEventStore, useSimulationStore, useWSStore } from '@/store';

// =============================================================================
// SIDEBAR NAVIGATION
// =============================================================================

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'devices', label: 'Devices', icon: Cpu, href: '/dashboard/devices' },
  { id: 'digital-twin', label: '3D Digital Twin', icon: Home, href: '/dashboard/twin' },
  { id: 'energy-command', label: 'Energy Command', icon: Shield, href: '/dashboard/energy-command' },
  { id: 'energy', label: 'Energy Analytics', icon: Zap, href: '/dashboard/energy' },
  { id: 'home-power', label: 'Home Power History', icon: Activity, href: '/dashboard/home-power' },
  { id: 'appliance-power', label: 'Appliance Power', icon: Activity, href: '/dashboard/appliance-power' },
  { id: 'events', label: 'Event Stream', icon: Activity, href: '/dashboard/events' },
  { id: 'scenarios', label: 'Scenarios', icon: Film, href: '/dashboard/scenarios' },
  { id: 'timetravel', label: 'Time Travel', icon: Clock, href: '/dashboard/timetravel' },
  { id: 'metrics', label: 'Sim Metrics', icon: Gauge, href: '/dashboard/metrics' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/dashboard/settings' },
];

function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const alerts = useEventStore((s) => s.alerts);
  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged).length;

  return (
    <aside style={{
      width: sidebarOpen ? 'var(--sidebar-width)' : '72px',
      height: '100vh',
      background: 'linear-gradient(180deg, rgba(5, 8, 22, 0.95), rgba(11, 17, 32, 0.9))',
      backdropFilter: 'blur(12px)',
      borderRight: '1px solid rgba(0, 229, 255, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden',
      position: 'relative',
      zIndex: 30,
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid rgba(0, 229, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minHeight: '56px',
      }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          background: 'linear-gradient(135deg, #00E5FF, #3B82F6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 0 15px rgba(0, 229, 255, 0.3)',
        }}>
          <Home size={18} color="#050816" strokeWidth={2.5} />
        </div>
        {sidebarOpen && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '14px', fontWeight: 700, color: '#F8FAFC', whiteSpace: 'nowrap' }}>
              RNTBCI
            </div>
            <div style={{ fontSize: '10px', color: '#64748B', letterSpacing: '0.1em' }}>NEXUS CORE</div>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          style={{
            marginLeft: 'auto', background: 'transparent', border: 'none',
            color: '#94A3B8', cursor: 'pointer', padding: '4px', flexShrink: 0,
          }}
        >
          {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              style={{
                background: isActive ? 'rgba(0, 229, 255, 0.08)' : 'transparent',
                border: isActive ? '1px solid rgba(0, 229, 255, 0.2)' : '1px solid transparent',
                width: '100%',
                textAlign: 'left',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                paddingLeft: sidebarOpen ? '16px' : '0',
              }}
            >
              <Icon size={18} style={{ flexShrink: 0, color: isActive ? '#00E5FF' : '#94A3B8' }} />
              {sidebarOpen && (
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Simulation Controls */}
      <div style={{
        padding: '12px',
        borderTop: '1px solid rgba(0, 229, 255, 0.08)',
      }}>
        {sidebarOpen && (
          <div style={{ marginBottom: '8px', fontSize: '10px', color: '#64748B', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Simulation
          </div>
        )}
        <SimulationMiniControls compact={!sidebarOpen} />
      </div>

      {/* Neon edge effect */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: '1px',
        background: 'linear-gradient(180deg, transparent, rgba(0, 229, 255, 0.3), transparent)',
        pointerEvents: 'none',
      }} />
    </aside>
  );
}

// =============================================================================
// SIMULATION MINI CONTROLS (Sidebar)
// =============================================================================

function SimulationMiniControls({ compact }: { compact: boolean }) {
  const { running, paused, speed } = useSimulationStore();

  const handleToggle = async () => {
    try {
      await api.controlSimulation(paused ? 'play' : 'pause');
      useSimulationStore.getState().setSimulation({ running, paused: !paused, speed });
    } catch (e) { /* API not connected */ }
  };

  const handleSpeedChange = async () => {
    const speeds = [1, 2, 5, 10];
    const nextIdx = (speeds.indexOf(speed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    try {
      await api.controlSimulation('change_speed', nextSpeed);
      useSimulationStore.getState().setSpeed(nextSpeed);
    } catch (e) { /* API not connected */ }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: compact ? 'center' : 'flex-start' }}>
      <button
        onClick={handleToggle}
        style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: paused ? 'rgba(0, 255, 157, 0.1)' : 'rgba(0, 229, 255, 0.1)',
          border: `1px solid ${paused ? 'rgba(0, 255, 157, 0.3)' : 'rgba(0, 229, 255, 0.3)'}`,
          color: paused ? '#00FF9D' : '#00E5FF',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title={paused ? 'Resume Simulation' : 'Pause Simulation'}
      >
        {paused ? <Play size={14} /> : <Pause size={14} />}
      </button>
      {!compact && (
        <>
          <button
            onClick={handleSpeedChange}
            style={{
              height: '32px', borderRadius: '8px', padding: '0 10px',
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: '#6366F1', cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace", fontSize: '11px',
              fontWeight: 600,
            }}
          >
            ×{speed}
          </button>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: running && !paused ? '#00FF9D' : '#64748B',
            boxShadow: running && !paused ? '0 0 8px rgba(0, 255, 157, 0.5)' : 'none',
          }} />
        </>
      )}
    </div>
  );
}

// =============================================================================
// TOP BAR
// =============================================================================

function TopBar() {
  const wsConnected = useWSStore((s) => s.connected);
  const alerts = useEventStore((s) => s.alerts);
  const metrics = useSimulationStore((s) => s.metrics);
  const devices = useDeviceStore((s) => s.devices);
  const totalPower = devices.reduce((sum, d) => sum + (d.energy_usage_kw || 0), 0);
  const unacked = alerts.filter((a) => !a.acknowledged).length;
  const pathname = usePathname();

  const pageTitle = NAV_ITEMS.find(
    (n) => n.href === pathname || (n.href !== '/dashboard' && pathname?.startsWith(n.href))
  )?.label || 'Dashboard';

  return (
    <header style={{
      height: 'var(--topbar-height)',
      background: 'rgba(5, 8, 22, 0.9)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(0, 229, 255, 0.08)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: '16px',
      zIndex: 20,
      flexShrink: 0,
    }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        <span style={{ fontSize: '12px', color: '#64748B' }}>NEXUS</span>
        <ChevronRight size={14} color="#64748B" />
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>{pageTitle}</span>
      </div>

      {/* Status indicators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Power */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Zap size={14} color="#FFC857" />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#FFC857' }}>
            {totalPower.toFixed(1)}kW
          </span>
        </div>

        {/* Connection */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {wsConnected ? <Wifi size={14} color="#00FF9D" /> : <WifiOff size={14} color="#FF4D6D" />}
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: wsConnected ? '#00FF9D' : '#FF4D6D' }}>
            {wsConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>

        {/* Alerts */}
        <button style={{
          position: 'relative', background: 'transparent', border: 'none',
          color: unacked > 0 ? '#FFC857' : '#64748B', cursor: 'pointer', padding: '4px',
        }}>
          <Bell size={18} />
          {unacked > 0 && (
            <span style={{
              position: 'absolute', top: '-2px', right: '-2px', width: '16px', height: '16px',
              borderRadius: '50%', background: '#FF4D6D', color: '#FFF',
              fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 8px rgba(255, 77, 109, 0.5)',
            }}>
              {unacked}
            </span>
          )}
        </button>

        {/* Time */}
        <LiveClock />
      </div>
    </header>
  );
}

function LiveClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#94A3B8',
      letterSpacing: '0.05em', minWidth: '65px',
    }}>
      {time}
    </span>
  );
}

// =============================================================================
// LIVE EVENT FOOTER
// =============================================================================

function EventFooter() {
  const events = useEventStore((s) => s.events).slice(0, 50);

  const severityColor: Record<string, string> = {
    info: '#00E5FF',
    warning: '#FFC857',
    error: '#FF4D6D',
    critical: '#FF0040',
  };

  return (
    <div style={{
      height: '140px',
      background: 'rgba(5, 8, 22, 0.95)',
      borderTop: '1px solid rgba(0, 229, 255, 0.08)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 16px', borderBottom: '1px solid rgba(0, 229, 255, 0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={12} color="#00E5FF" />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#00E5FF', letterSpacing: '0.1em' }}>
            LIVE EVENT STREAM
          </span>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: '#00FF9D',
            animation: 'statusPulse 2s ease-in-out infinite',
          }} />
        </div>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: '#64748B' }}>
          {events.length} events
        </span>
      </div>

      {/* Events */}
      <div className="event-stream" style={{ flex: 1, overflowY: 'auto' }}>
        {events.length === 0 ? (
          <div style={{ color: '#64748B', fontStyle: 'italic', padding: '8px' }}>
            Waiting for events...
          </div>
        ) : (
          events.map((event, i) => (
            <div key={event.id || i} style={{ display: 'flex', gap: '8px', padding: '2px 0', lineHeight: '1.5' }}>
              <span className="event-timestamp">
                {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false })}
              </span>
              <span style={{ color: severityColor[event.severity] || '#00E5FF', minWidth: '55px', textTransform: 'uppercase', fontWeight: 600 }}>
                [{event.severity}]
              </span>
              <span className="event-device">{event.device_name || 'System'}</span>
              <span style={{ color: '#94A3B8' }}>→</span>
              <span style={{ color: '#CBD5E1' }}>{event.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// =============================================================================
// DASHBOARD LAYOUT
// =============================================================================

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Initialize data
    const init = async () => {
      try {
        const [devicesRes, roomsRes, alertsRes] = await Promise.allSettled([
          api.getDevices(),
          api.getRooms(),
          api.getAlerts(),
        ]);

        if (devicesRes.status === 'fulfilled') {
          const data = devicesRes.value as { devices?: unknown[] } | unknown[];
          const apiDevices = (Array.isArray(data) ? data : (data as { devices?: unknown[] }).devices || []) as import('@/store').Device[];
          
          const currentStore = useDeviceStore.getState().devices;
          const mergedDevices = [...apiDevices];
          
          ['energy_evse', 'solar_pv'].forEach(type => {
            if (!mergedDevices.some(d => d.type === type)) {
              const demoDevice = currentStore.find(d => d.type === type);
              if (demoDevice) mergedDevices.push(demoDevice);
            }
          });
          
          useDeviceStore.getState().setDevices(mergedDevices);
        }
        if (roomsRes.status === 'fulfilled') {
          useDeviceStore.getState().setRooms(roomsRes.value as import('@/store').Room[]);
        }
        if (alertsRes.status === 'fulfilled') {
          useEventStore.getState().setAlerts(alertsRes.value as import('@/store').Alert[]);
        }
      } catch {
        // Backend may not be running yet - continue with demo mode
      }
    };

    init();

    // Connect WebSocket
    wsClient.connect();

    return () => {
      wsClient.disconnect();
    };
  }, []);

  if (!mounted) return null;

  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      background: 'var(--bg-primary)',
      overflow: 'hidden',
    }}>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar />

        {/* Main content */}
        <main style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px',
          background: 'linear-gradient(180deg, #050816 0%, #0B1120 100%)',
        }}>
          {children}
        </main>

        <EventFooter />
      </div>
    </div>
  );
}
