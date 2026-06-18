/**
 * RNTBCI Smart Home Digital Twin - Zustand State Management
 *
 * Global stores for auth, devices, UI, simulation, and real-time data.
 */

import { create } from 'zustand';

// =============================================================================
// TYPES
// =============================================================================

export interface User {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
}

export interface Device {
  id: string;
  name: string;
  type: string;
  room_id: string;
  room_name?: string;
  status: string;
  power_state: string;
  connectivity: string;
  energy_usage_kw: number;
  efficiency_percent: number;
  metadata: Record<string, unknown>;
  position_x: number;
  position_y: number;
  position_z: number;
  last_updated: string;
}

export interface Room {
  id: string;
  name: string;
  type: string;
  floor: number;
  position_x: number;
  position_y: number;
  position_z: number;
  width: number;
  depth: number;
  height: number;
}

export interface DeviceEvent {
  id: string;
  device_id: string;
  device_name?: string;
  event_type: string;
  severity: string;
  message: string;
  timestamp: string;
}

export interface Alert {
  id: string;
  device_id?: string;
  device_name?: string;
  type: string;
  severity: string;
  message: string;
  acknowledged: boolean;
  timestamp: string;
}

// =============================================================================
// AUTH STORE
// =============================================================================

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  setAuth: (user, accessToken, refreshToken) =>
    set({ user, accessToken, refreshToken, isAuthenticated: true }),
  clearAuth: () =>
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
  updateUser: (updates) =>
    set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),
}));

// =============================================================================
// DEVICE STORE
// =============================================================================

interface DeviceState {
  devices: Device[];
  rooms: Room[];
  selectedDevice: Device | null;
  setDevices: (devices: Device[]) => void;
  setRooms: (rooms: Room[]) => void;
  selectDevice: (device: Device | null) => void;
  updateDevice: (id: string, updates: Partial<Device>) => void;
  addDevice: (device: Device) => void;
  removeDevice: (id: string) => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  devices: [],
  rooms: [],
  selectedDevice: null,
  setDevices: (devices) => set({ devices }),
  setRooms: (rooms) => set({ rooms }),
  selectDevice: (device) => set({ selectedDevice: device }),
  updateDevice: (id, updates) =>
    set((state) => ({
      devices: state.devices.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      selectedDevice: state.selectedDevice?.id === id
        ? { ...state.selectedDevice, ...updates }
        : state.selectedDevice,
    })),
  addDevice: (device) => set((state) => ({ devices: [...state.devices, device] })),
  removeDevice: (id) =>
    set((state) => ({
      devices: state.devices.filter((d) => d.id !== id),
      selectedDevice: state.selectedDevice?.id === id ? null : state.selectedDevice,
    })),
}));

// =============================================================================
// UI STORE
// =============================================================================

interface UIState {
  sidebarOpen: boolean;
  contextPanelOpen: boolean;
  activeView: string;
  theme: 'dark' | 'cyberpunk';
  toggleSidebar: () => void;
  toggleContextPanel: () => void;
  setActiveView: (view: string) => void;
  setTheme: (theme: 'dark' | 'cyberpunk') => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  contextPanelOpen: true,
  activeView: 'dashboard',
  theme: 'cyberpunk',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleContextPanel: () => set((s) => ({ contextPanelOpen: !s.contextPanelOpen })),
  setActiveView: (view) => set({ activeView: view }),
  setTheme: (theme) => set({ theme }),
}));

// =============================================================================
// EVENT STORE
// =============================================================================

interface EventState {
  events: DeviceEvent[];
  alerts: Alert[];
  addEvent: (event: DeviceEvent) => void;
  setEvents: (events: DeviceEvent[]) => void;
  setAlerts: (alerts: Alert[]) => void;
  acknowledgeAlert: (id: string) => void;
}

export const useEventStore = create<EventState>((set) => ({
  events: [],
  alerts: [],
  addEvent: (event) =>
    set((state) => ({
      events: [event, ...state.events].slice(0, 500), // Keep last 500
    })),
  setEvents: (events) => set({ events }),
  setAlerts: (alerts) => set({ alerts }),
  acknowledgeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    })),
}));

// =============================================================================
// SIMULATION STORE
// =============================================================================

interface SimulationState {
  running: boolean;
  paused: boolean;
  speed: number;
  replayMode: boolean;
  metrics: Record<string, number>;
  setSimulation: (data: { running: boolean; paused: boolean; speed: number }) => void;
  setReplayMode: (mode: boolean) => void;
  setMetrics: (metrics: Record<string, number>) => void;
  setSpeed: (speed: number) => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  running: true,
  paused: false,
  speed: 1,
  replayMode: false,
  metrics: {},
  setSimulation: (data) => set(data),
  setReplayMode: (mode) => set({ replayMode: mode }),
  setMetrics: (metrics) => set({ metrics }),
  setSpeed: (speed) => set({ speed }),
}));

// =============================================================================
// WEBSOCKET STORE
// =============================================================================

interface WSState {
  connected: boolean;
  connectionId: string | null;
  lastMessage: unknown;
  setConnected: (connected: boolean, connectionId?: string) => void;
  setLastMessage: (message: unknown) => void;
}

export const useWSStore = create<WSState>((set) => ({
  connected: false,
  connectionId: null,
  lastMessage: null,
  setConnected: (connected, connectionId) => set({ connected, connectionId: connectionId || null }),
  setLastMessage: (message) => set({ lastMessage: message }),
}));
