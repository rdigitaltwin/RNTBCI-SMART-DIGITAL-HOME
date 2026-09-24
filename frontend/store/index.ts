/**
 * RNTBCI Smart Home Digital Twin - Zustand State Management
 *
 * Global stores for auth, devices, UI, simulation, and real-time data.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  execution_mode?: string;
  energy_usage_kw: number;
  efficiency_percent: number;
  metadata: Record<string, unknown>;
  position_x: number;
  position_y: number;
  position_z: number;
  turned_on_at: string | null;
  total_energy_kwh: number;
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

const INITIAL_DEMO_DEVICES: Device[] = [
  {
    id: 'solar_panel',
    name: 'Solar Panel Array',
    type: 'solar_pv',
    room_id: 'garage',
    room_name: 'Garage / Exterior',
    status: 'online',
    power_state: 'on',
    connectivity: 'connected',
    execution_mode: 'simulation',
    energy_usage_kw: -4.69,
    efficiency_percent: 95,
    metadata: { efficiency: 22.5, peak_power: 5.0, ActivePower: 4690000, Voltage: 230000, ActiveCurrent: 20391 },
    position_x: 0.2, position_y: 0.85, position_z: -0.3,
    turned_on_at: new Date().toISOString(),
    total_energy_kwh: 15.2,
    last_updated: new Date().toISOString(),
  },
  {
    id: 'ev_charger',
    name: 'EV Charger',
    type: 'energy_evse',
    room_id: 'garage',
    room_name: 'Garage / Exterior',
    status: 'online',
    power_state: 'off',
    connectivity: 'connected',
    execution_mode: 'simulation',
    energy_usage_kw: 0.0,
    efficiency_percent: 92,
    metadata: { Voltage: 0, ActiveCurrent: 0 },
    position_x: -0.8, position_y: 0.2, position_z: 4.2,
    turned_on_at: null,
    total_energy_kwh: 45.0,
    last_updated: new Date().toISOString(),
  },
  {
    id: 'ev_vehicle',
    name: 'EV Vehicle',
    type: 'ev_vehicle',
    room_id: 'garage',
    room_name: 'Garage / Exterior',
    status: 'online',
    power_state: 'on',
    connectivity: 'connected',
    execution_mode: 'simulation',
    energy_usage_kw: 0,
    efficiency_percent: 95,
    metadata: { HVBATVoltage: 0, HVSoC: 0, AuxBatVoltage: 0, AvgSpeed: 0, endpoint: 1 },
    position_x: -0.6, position_y: 0.2, position_z: 4.5,
    turned_on_at: new Date().toISOString(),
    total_energy_kwh: 0,
    last_updated: new Date().toISOString(),
  },
  {
    id: 'mcb',
    name: 'Main Circuit Breaker',
    type: 'mcb',
    room_id: 'garage',
    room_name: 'Garage',
    status: 'online',
    power_state: 'on',
    connectivity: 'connected',
    execution_mode: 'simulation',
    energy_usage_kw: 0.0,
    efficiency_percent: 100,
    metadata: { rated_current: 100, voltage: 230 },
    position_x: -1.3, position_y: 0.25, position_z: -3.2,
    turned_on_at: new Date().toISOString(),
    total_energy_kwh: 0.0,
    last_updated: new Date().toISOString(),
  },
  {
    id: 'hvac',
    name: 'HVAC System',
    type: 'hvac',
    room_id: 'master_bedroom',
    room_name: 'Master Bedroom',
    status: 'online',
    power_state: 'on',
    connectivity: 'connected',
    execution_mode: 'simulation',
    energy_usage_kw: 2.5,
    efficiency_percent: 88,
    metadata: { target_temperature: 21, mode: 'cooling' },
    position_x: 3.8, position_y: 0.35, position_z: -3.0,
    turned_on_at: new Date().toISOString(),
    total_energy_kwh: 28.4,
    last_updated: new Date().toISOString(),
  },
  {
    id: 'smart_light_1',
    name: 'Living Room Light',
    type: 'smart_light',
    room_id: 'living',
    room_name: 'Living Room',
    status: 'online',
    power_state: 'on',
    connectivity: 'connected',
    execution_mode: 'simulation',
    energy_usage_kw: 0.015,
    efficiency_percent: 98,
    metadata: { brightness: 80 },
    position_x: -1.5, position_y: 0.48, position_z: -0.5,
    turned_on_at: new Date().toISOString(),
    total_energy_kwh: 1.2,
    last_updated: new Date().toISOString(),
  },
  {
    id: 'washing_machine',
    name: 'Washing Machine',
    type: 'washing_machine',
    room_id: 'bathroom',
    room_name: 'Bathroom',
    status: 'online',
    power_state: 'off',
    connectivity: 'connected',
    execution_mode: 'simulation',
    energy_usage_kw: 0.0,
    efficiency_percent: 90,
    metadata: {},
    position_x: 0.5, position_y: 0.15, position_z: 0.5,
    turned_on_at: null,
    total_energy_kwh: 8.5,
    last_updated: new Date().toISOString(),
  },
  {
    id: 'bathroom_light',
    name: 'Bathroom Light',
    type: 'smart_light',
    room_id: 'bathroom',
    room_name: 'Bathroom',
    status: 'online',
    power_state: 'off',
    connectivity: 'connected',
    execution_mode: 'simulation',
    energy_usage_kw: 0.015,
    efficiency_percent: 98,
    metadata: { brightness: 100 },
    position_x: 1.0, position_y: 0.48, position_z: 1.5,
    turned_on_at: null,
    total_energy_kwh: 0.8,
    last_updated: new Date().toISOString(),
  },
];

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      devices: INITIAL_DEMO_DEVICES,
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
    }),
    { name: 'rntbci-device-store' }
  )
);

const DEFAULT_DEVICE_KW: Record<string, number> = {
  hvac: 2.5,
  smart_light: 0.015,
  washing_machine: 0.5,
  refrigerator: 0.15,
  dishwasher: 1.5,
  microwave: 1.2,
  water_heater: 1.2,
  camera: 0.01,
  door_lock: 0.003,
  smart_switch: 0.001,
  smart_plug: 0.05,
  mcb: 0,
  smart_meter: 0.005,
  ev_vehicle: 8.25,
};

/**
 * Unified device state toggle function.
 * Updates useDeviceStore, syncs useEnergyStore, calls backend APIs,
 * and maintains optimistic state for simulated / demo devices.
 */
export async function toggleDeviceState(device: Device, targetNewState?: 'on' | 'off'): Promise<void> {
  const currentState = device.power_state === 'on' ? 'on' : 'off';
  const newState = targetNewState || (currentState === 'on' ? 'off' : 'on');
  const deviceStore = useDeviceStore.getState();

  const isEvse = device.type === 'energy_evse';
  const isSolar = device.type === 'solar_pv' || device.type === 'solar_panel' || device.type === 'energy_solar';

  const patch: Partial<Device> = { power_state: newState };
  const currentDevice = deviceStore.devices.find((d) => d.id === device.id) || device;
  const currentMeta = currentDevice.metadata || {};

  if (isEvse) {
    if (newState === 'on') {
      patch.energy_usage_kw = 7.4;
      patch.metadata = { ...currentMeta, Voltage: 230000, ActiveCurrent: 32174, ActivePower: 7400000 };
    } else {
      patch.energy_usage_kw = 0;
      patch.metadata = { ...currentMeta, Voltage: 0, ActiveCurrent: 0, ActivePower: 0 };
    }
  } else if (isSolar) {
    if (newState === 'on') {
      patch.energy_usage_kw = -4.69;
      patch.metadata = { ...currentMeta, ActivePower: 4690000, Voltage: 230000, ActiveCurrent: 20391 };
    } else {
      patch.energy_usage_kw = 0;
      patch.metadata = { ...currentMeta, ActivePower: 0, Voltage: 0, ActiveCurrent: 0 };
    }
  } else if (device.type === 'ev_vehicle') {
    if (newState === 'on') {
      patch.energy_usage_kw = DEFAULT_DEVICE_KW.ev_vehicle;
      patch.metadata = {
        ...currentMeta,
        HVBATVoltage: currentMeta.HVBATVoltage || 398,
        HVSoC: currentMeta.HVSoC || 80,
        AuxBatVoltage: currentMeta.AuxBatVoltage || 12.8,
        AvgSpeed: currentMeta.AvgSpeed || 55,
      };
    } else {
      patch.energy_usage_kw = 0;
    }
  } else {
    if (newState === 'on') {
      const storedPower = Number(currentMeta.rated_power) || DEFAULT_DEVICE_KW[device.type] || currentDevice.energy_usage_kw || 0.015;
      patch.energy_usage_kw = storedPower;
    } else {
      const activePower = currentDevice.energy_usage_kw || DEFAULT_DEVICE_KW[device.type];
      if (activePower && activePower > 0) {
        patch.metadata = { ...currentMeta, rated_power: activePower };
      }
      patch.energy_usage_kw = 0;
    }
  }

  // 1. Optimistic UI update in global device store
  deviceStore.updateDevice(device.id, patch);

  // 2. Sync with local energyEngine store if available
  try {
    const { useEnergyStore } = await import('@/store/energyEngine');
    const energyStore = useEnergyStore.getState();
    const energyDevice = Object.values(energyStore.devices).find((e) => {
      if (!e) return false;
      const dName = (device.name || '').toLowerCase();
      const eName = (e.name || '').toLowerCase();
      if (dName && eName && (dName === eName || dName.includes(eName) || eName.includes(dName))) return true;
      if (e.type === device.type) return true;
      return false;
    });

    if (energyDevice && energyDevice.powerState !== newState) {
      energyStore.toggleDevice(energyDevice.id, true);
    }
    if (isEvse || device.type === 'ev_vehicle') {
      const updatedDevices = useDeviceStore.getState().devices;
      const evChargerDef = updatedDevices.find((d) => d.type === 'energy_evse');
      const evVehicleDef = updatedDevices.find((d) => d.type === 'ev_vehicle');
      if (evChargerDef && evVehicleDef) {
        const isChargerOn = evChargerDef.power_state === 'on';
        const isVehicleOn = evVehicleDef.power_state === 'on';
        if (isChargerOn && isVehicleOn) {
          energyStore.setEVChargerState('charging');
        } else if (isChargerOn && !isVehicleOn) {
          energyStore.setEVChargerState('paused');
        } else {
          energyStore.setEVChargerState('disconnected');
        }
      } else if (isEvse) {
        energyStore.setEVChargerState(newState === 'on' ? 'paused' : 'disconnected');
      }
    }
  } catch (e) {
    console.warn('Energy engine sync skipped', e);
  }

  // 3. Backend API Sync
  try {
    const { default: api } = await import('@/services/api');
    if (isSolar) {
      const status = newState.toUpperCase();
      try {
        const updated = await api.toggleState(device.id, status);
        if (updated && typeof updated === 'object') {
          // Reconcile with authoritative backend response
          deviceStore.updateDevice(device.id, updated as Partial<Device>);
        }
      } catch {
        // Rollback optimistic state on failure
        deviceStore.updateDevice(device.id, { power_state: currentState });
      }
    } else {
      const status = newState.toUpperCase();
      const updated = await api.toggleState(device.id, status)
        .catch(() => api.togglePower(device.id, newState))
        .catch(() => null);
      if (updated && typeof updated === 'object' && ('power_state' in updated || 'status' in updated)) {
        const updatedPowerState = (updated as any).power_state;
        if (!updatedPowerState || updatedPowerState === newState) {
          deviceStore.updateDevice(device.id, updated as Partial<Device>);
        }
      }
    }
  } catch (err: any) {
    console.warn(`Device ${device.id} API sync failed, maintaining optimistic state.`, err);
  }
}

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
