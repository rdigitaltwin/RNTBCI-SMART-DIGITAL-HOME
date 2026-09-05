/**
 * RNTBCI Smart Home Digital Twin — Energy Engine (Zustand Store)
 *
 * Central real-time energy simulation engine. Manages:
 * - Device power states & consumption tracking
 * - Live load calculations (current, peak, average, available capacity)
 * - MCB (Miniature Circuit Breaker) state machine
 * - EV charger simulation
 * - Home capacity configuration
 * - Event logging with timestamps
 * - Smart alert system
 * - Energy history & analytics data
 *
 * This store is frontend-only and syncs with the existing device store.
 */

import { create } from 'zustand';
import { useSimulationStore } from './index';
import {
  APPLIANCE_DATABASE,
  type ApplianceSpec,
  type DeviceStatusType,
  formatPower,
} from '@/lib/applianceDatabase';
import {
  HOME_PROFILES,
  type HomeProfileType,
  type HomeCapacityConfig,
  type LoadLevel,
  createDefaultConfig,
  calculateMaxCapacity,
  calculateCurrent,
  getLoadPercentage,
  getLoadLevel,
  LOAD_LEVEL_COLORS,
} from '@/lib/homeCapacity';

// =============================================================================
// TYPES
// =============================================================================

export type MCBState = 'on' | 'tripped' | 'off';

export type EVChargerState = 'charging' | 'paused' | 'completed' | 'disconnected';

export interface EnergyDevice {
  id: string;
  applianceId: string;
  name: string;
  type: string;
  category: string;
  room: string;
  powerState: 'on' | 'off';
  status: DeviceStatusType;
  currentConsumption: number;   // Watts (actual draw right now)
  ratedPowerMin: number;
  ratedPowerMax: number;
  defaultPower: number;
  icon: string;
  energyHistory: Array<{ timestamp: number; power: number }>;
  turnedOnAt: number | null;    // timestamp
  totalEnergyWh: number;        // accumulated Wh
}

export interface EnergyMetrics {
  currentLoad: number;        // W
  peakLoad: number;           // W
  averageLoad: number;        // W
  availableCapacity: number;  // W
  energyToday: number;        // Wh
  totalEnergy: number;        // Wh
  voltage: number;            // V
  current: number;            // A
  powerFactor: number;
  estimatedMonthlyKWh: number;
  loadPercentage: number;
  loadLevel: LoadLevel;
}

export interface MCBInfo {
  state: MCBState;
  tripTime: number | null;
  tripCause: string | null;
  configuredCapacity: number;   // W
  loadAtTrip: number;           // W
  exceededBy: number;           // W
  responsibleDevices: string[]; // device IDs
}

export interface EVChargerInfo {
  state: EVChargerState;
  power: number;                // W (current charging power)
  targetPower: number;          // W (configured power)
  batteryCapacityWh: number;    // Wh (e.g. 60000 for 60 kWh)
  batteryLevel: number;         // 0–100%
  chargingStartedAt: number | null;
  estimatedCompletion: number | null;
}

export type EventType =
  | 'device_on'
  | 'device_off'
  | 'power_change'
  | 'mcb_trip'
  | 'mcb_reset'
  | 'config_change'
  | 'ev_charging_start'
  | 'ev_charging_pause'
  | 'ev_charging_complete'
  | 'ev_charging_disconnect'
  | 'capacity_change'
  | 'warning'
  | 'fault'
  | 'overload'
  | 'near_overload';

export interface EnergyEvent {
  id: string;
  type: EventType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: number;
  deviceId?: string;
  deviceName?: string;
  data?: Record<string, unknown>;
}

export type AlertType =
  | 'overload'
  | 'near_overload'
  | 'high_consumption'
  | 'device_fault'
  | 'ev_conflict'
  | 'voltage_issue'
  | 'current_limit'
  | 'mcb_trip';

export interface EnergyAlert {
  id: string;
  type: AlertType;
  severity: 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: number;
  dismissed: boolean;
  deviceId?: string;
}

// =============================================================================
// STORE INTERFACE
// =============================================================================

interface EnergyEngineState {
  // Devices
  devices: Record<string, EnergyDevice>;
  deviceOrder: string[]; // ordered list of device IDs

  // Metrics
  metrics: EnergyMetrics;

  // Home Configuration
  homeConfig: HomeCapacityConfig;

  // MCB
  mcb: MCBInfo;

  // EV Charger
  evCharger: EVChargerInfo;

  // Events
  events: EnergyEvent[];
  maxEvents: number;

  // Alerts
  alerts: EnergyAlert[];

  // Analytics data
  loadHistory: Array<{ timestamp: number; load: number }>;
  hourlyConsumption: Array<{ hour: string; energy: number }>;

  // ─── Actions ───────────────────────────────────────────────────────
  // Initialization
  initializeDevices: () => void;

  // Device control
  toggleDevice: (deviceId: string, skipBackendSync?: boolean) => void;
  setDevicePower: (deviceId: string, power: number) => void;
  setDeviceStatus: (deviceId: string, status: DeviceStatusType) => void;

  // Home configuration
  setHomeProfile: (profile: HomeProfileType) => void;
  setContractedPower: (kva: number) => void;
  setCurrentRating: (amps: number) => void;

  // MCB
  resetMCB: () => void;
  turnOffOverloadedDevices: () => void;

  // EV Charger
  setEVChargerState: (state: EVChargerState) => void;
  setEVChargingPower: (power: number) => void;
  setEVBatteryLevel: (level: number) => void;

  // Alerts
  dismissAlert: (id: string) => void;
  dismissAllAlerts: () => void;

  // Internal
  _recalculateMetrics: () => void;
  _addEvent: (type: EventType, severity: EnergyEvent['severity'], message: string, deviceId?: string, deviceName?: string, data?: Record<string, unknown>) => void;
  _addAlert: (type: AlertType, severity: EnergyAlert['severity'], title: string, message: string, deviceId?: string) => void;
  _checkMCB: () => void;
  _updateLoadHistory: () => void;

  // Tick (called on interval for continuous simulation)
  tick: () => void;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const defaultConfig = createDefaultConfig('medium');

const initialMetrics: EnergyMetrics = {
  currentLoad: 0,
  peakLoad: 0,
  averageLoad: 0,
  availableCapacity: defaultConfig.maxCapacityWatts,
  energyToday: 0,
  totalEnergy: 0,
  voltage: 230,
  current: 0,
  powerFactor: 0.95,
  estimatedMonthlyKWh: 0,
  loadPercentage: 0,
  loadLevel: 'green',
};

const initialMCB: MCBInfo = {
  state: 'on',
  tripTime: null,
  tripCause: null,
  configuredCapacity: defaultConfig.maxCapacityWatts,
  loadAtTrip: 0,
  exceededBy: 0,
  responsibleDevices: [],
};

const initialEVCharger: EVChargerInfo = {
  state: 'disconnected',
  power: 0,
  targetPower: 7400,
  batteryCapacityWh: 60000,
  batteryLevel: 0,
  chargingStartedAt: null,
  estimatedCompletion: null,
};

// =============================================================================
// STORE IMPLEMENTATION
// =============================================================================

export const useEnergyStore = create<EnergyEngineState>((set, get) => ({
  devices: {},
  deviceOrder: [],
  metrics: initialMetrics,
  homeConfig: defaultConfig,
  mcb: initialMCB,
  evCharger: initialEVCharger,
  events: [],
  maxEvents: 500,
  alerts: [],
  loadHistory: [],
  hourlyConsumption: [],

  // ─── Initialization ────────────────────────────────────────────────
  initializeDevices: () => {
    const backendDevices = useDeviceStore.getState().devices;
    const devices: Record<string, EnergyDevice> = {};
    const deviceOrder: string[] = [];

    if (backendDevices.length === 0) {
      console.warn('EnergyEngine: No devices found in backend store, using fallback or waiting.');
    }

    backendDevices.forEach((backendDevice) => {
      // Find spec by type, fallback to a generic if not found
      const spec = APPLIANCE_DATABASE.find(a => a.type === backendDevice.type) || {
        id: backendDevice.id,
        name: backendDevice.name,
        type: backendDevice.type,
        category: 'utility',
        room: backendDevice.room_name || 'unknown',
        ratedPowerMin: 5,
        ratedPowerMax: 50,
        defaultPower: 20,
        icon: '🔌'
      };

      const powerState = backendDevice.power_state as 'on' | 'off';

      const device: EnergyDevice = {
        id: backendDevice.id,
        applianceId: spec.id,
        name: backendDevice.name,
        type: backendDevice.type,
        category: spec.category,
        room: backendDevice.room_name || 'unknown',
        powerState: powerState,
        status: (backendDevice.status as any) || 'standby',
        currentConsumption: powerState === 'on' ? spec.defaultPower : 0,
        ratedPowerMin: spec.ratedPowerMin,
        ratedPowerMax: spec.ratedPowerMax,
        defaultPower: spec.defaultPower,
        icon: spec.icon,
        energyHistory: [],
        turnedOnAt: powerState === 'on' ? Date.now() : null,
        totalEnergyWh: (backendDevice.total_energy_kwh || 0) * 1000,
      };
      devices[backendDevice.id] = device;
      deviceOrder.push(backendDevice.id);
    });

    set({ devices, deviceOrder });
    
    // Restore EV Charger state from localStorage
    try {
      if (typeof window !== 'undefined') {
        const savedRaw = localStorage.getItem('evChargerState');
        if (savedRaw) {
          const savedState = JSON.parse(savedRaw);
          // Calculate missed charging if it was actively charging
          if (savedState.state === 'charging' && savedState.chargingStartedAt) {
            // We use chargingStartedAt but since we only have start time and current level in localstorage,
            // we can just resume from the saved batteryLevel. For a more robust sim, we'd calculate time delta.
            set((s) => ({ evCharger: { ...s.evCharger, ...savedState } }));
          } else {
            set((s) => ({ evCharger: { ...s.evCharger, ...savedState } }));
          }
        }
      }
    } catch (e) {
      console.warn('Failed to restore EV state from local storage', e);
    }

    get()._recalculateMetrics();
    get()._addEvent('config_change', 'info', 'Energy engine initialized from backend devices');
  },

  // ─── Device Control ────────────────────────────────────────────────
  toggleDevice: (deviceId: string, skipBackendSync: boolean = false) => {
    const state = get();
    const device = state.devices[deviceId];
    if (!device) return;

    // Can't turn on if MCB is tripped
    if (state.mcb.state === 'tripped' && device.powerState === 'off') {
      get()._addAlert('mcb_trip', 'error', 'MCB Tripped', 
        `Cannot turn on ${device.name} — MCB is tripped. Reset the MCB first.`, deviceId);
      return;
    }

    const newPowerState = device.powerState === 'on' ? 'off' : 'on';
    const now = Date.now();

    // Calculate energy consumed if turning off
    let additionalEnergy = 0;
    if (newPowerState === 'off' && device.turnedOnAt) {
      const hoursOn = (now - device.turnedOnAt) / 3600000;
      additionalEnergy = device.currentConsumption * hoursOn;
    }

    set((s) => ({
      devices: {
        ...s.devices,
        [deviceId]: {
          ...device,
          powerState: newPowerState,
          status: newPowerState === 'on' ? 'running' : 'standby',
          currentConsumption: newPowerState === 'on' ? device.defaultPower : 0,
          turnedOnAt: newPowerState === 'on' ? now : null,
          totalEnergyWh: device.totalEnergyWh + additionalEnergy,
          energyHistory: [
            ...device.energyHistory.slice(-59),
            { timestamp: now, power: newPowerState === 'on' ? device.defaultPower : 0 },
          ],
        },
      },
    }));

    const eventType = newPowerState === 'on' ? 'device_on' : 'device_off';
    const power = newPowerState === 'on' ? device.defaultPower : 0;
    get()._addEvent(eventType, 'info', 
      `${device.name} turned ${newPowerState.toUpperCase()} (${formatPower(power)})`,
      deviceId, device.name
    );

    get()._recalculateMetrics();
    get()._checkMCB();

    // Sync back to backend if needed
    if (!skipBackendSync) {
      const deviceStore = useDeviceStore.getState();
      const backendDevice = deviceStore.devices.find(d => d.id === deviceId);

      if (backendDevice) {
        // Optimistic UI update for backend
        deviceStore.updateDevice(deviceId, { power_state: newPowerState });
        // Make API call (ignoring await to not block UI)
        import('@/services/api').then(({ default: api }) => {
          api.togglePower(deviceId, newPowerState).catch((err: any) => {
            if (err?.response?.status === 404 && ['energy_evse', 'solar_pv', 'ev_vehicle'].includes(backendDevice.type)) {
              console.warn(`Simulated device ${deviceId} not found in backend, keeping optimistic state.`);
            } else {
              console.error('Failed to sync device to backend', err);
              // Revert on error
              deviceStore.updateDevice(deviceId, { power_state: device.powerState });
            }
          });
        });
      }
    }
  },

  setDevicePower: (deviceId: string, power: number) => {
    const device = get().devices[deviceId];
    if (!device || device.powerState !== 'on') return;

    const clampedPower = Math.max(device.ratedPowerMin, Math.min(device.ratedPowerMax, power));

    set((s) => ({
      devices: {
        ...s.devices,
        [deviceId]: {
          ...device,
          currentConsumption: clampedPower,
          energyHistory: [
            ...device.energyHistory.slice(-59),
            { timestamp: Date.now(), power: clampedPower },
          ],
        },
      },
    }));

    get()._addEvent('power_change', 'info', 
      `${device.name} power changed to ${formatPower(clampedPower)}`,
      deviceId, device.name
    );
    get()._recalculateMetrics();
    get()._checkMCB();
  },

  setDeviceStatus: (deviceId: string, status: DeviceStatusType) => {
    const device = get().devices[deviceId];
    if (!device) return;

    set((s) => ({
      devices: {
        ...s.devices,
        [deviceId]: { ...device, status },
      },
    }));

    if (status === 'fault') {
      get()._addAlert('device_fault', 'error', 'Device Fault',
        `${device.name} has reported a fault condition.`, deviceId);
      get()._addEvent('fault', 'error', `${device.name} fault detected`, deviceId, device.name);
    }
  },

  // ─── Home Configuration ────────────────────────────────────────────
  setHomeProfile: (profile: HomeProfileType) => {
    const config = createDefaultConfig(profile);
    set({
      homeConfig: config,
      mcb: {
        ...get().mcb,
        configuredCapacity: config.maxCapacityWatts,
        state: 'on',
        tripTime: null,
        tripCause: null,
      },
    });
    get()._addEvent('config_change', 'info', 
      `Home profile changed to ${HOME_PROFILES[profile].name} (${config.contractedPower} kVA)`
    );
    get()._recalculateMetrics();
    get()._checkMCB();
  },

  setContractedPower: (kva: number) => {
    const state = get();
    const maxCapacityWatts = calculateMaxCapacity(kva, state.homeConfig.powerFactor);
    set({
      homeConfig: { ...state.homeConfig, contractedPower: kva, maxCapacityWatts },
      mcb: { ...state.mcb, configuredCapacity: maxCapacityWatts },
    });
    get()._addEvent('capacity_change', 'info', 
      `Contracted power changed to ${kva} kVA (${formatPower(maxCapacityWatts)} max)`
    );
    get()._recalculateMetrics();
    get()._checkMCB();
  },

  setCurrentRating: (amps: number) => {
    set((s) => ({
      homeConfig: { ...s.homeConfig, currentRating: amps },
    }));
    get()._addEvent('config_change', 'info', `Current rating changed to ${amps} A`);
  },

  // ─── MCB ───────────────────────────────────────────────────────────
  resetMCB: () => {
    const state = get();
    // Only reset if current load is now under capacity
    if (state.metrics.currentLoad > state.mcb.configuredCapacity) {
      get()._addAlert('overload', 'error', 'Cannot Reset MCB',
        `Current load (${formatPower(state.metrics.currentLoad)}) still exceeds capacity (${formatPower(state.mcb.configuredCapacity)}). Turn off devices first.`
      );
      return;
    }

    set((s) => ({
      mcb: {
        ...s.mcb,
        state: 'on',
        tripTime: null,
        tripCause: null,
        loadAtTrip: 0,
        exceededBy: 0,
        responsibleDevices: [],
      },
    }));

    get()._addEvent('mcb_reset', 'info', 'MCB has been reset — power restored');
  },

  turnOffOverloadedDevices: () => {
    const state = get();
    const onDevices = Object.values(state.devices)
      .filter((d) => d.powerState === 'on')
      .sort((a, b) => b.currentConsumption - a.currentConsumption);

    let currentLoad = state.metrics.currentLoad;
    const capacity = state.mcb.configuredCapacity;
    const turnedOff: string[] = [];

    for (const device of onDevices) {
      if (currentLoad <= capacity * 0.85) break; // Target 85% to have margin
      
      set((s) => ({
        devices: {
          ...s.devices,
          [device.id]: {
            ...device,
            powerState: 'off',
            status: 'standby',
            currentConsumption: 0,
            turnedOnAt: null,
          },
        },
      }));
      currentLoad -= device.currentConsumption;
      turnedOff.push(device.id);

      get()._addEvent('device_off', 'warning', 
        `${device.name} turned OFF to reduce load (${formatPower(device.currentConsumption)})`,
        device.id, device.name
      );
    }

    get()._recalculateMetrics();

    if (turnedOff.length > 0) {
      get()._addEvent('mcb_reset', 'info', 
        `${turnedOff.length} device(s) turned off to reduce load below capacity`
      );
    }
  },

  // ─── EV Charger ────────────────────────────────────────────────────
  setEVChargerState: (evState: EVChargerState) => {
    const state = get();
    const evDevice = Object.values(state.devices).find((d) => d.type === 'energy_evse');
    const evDeviceId = evDevice?.id;
    const now = Date.now();

    if (evState === 'charging') {
      // Check if MCB allows it
      const totalLoad = state.metrics.currentLoad + state.evCharger.targetPower;
      if (totalLoad > state.mcb.configuredCapacity && state.mcb.state === 'on') {
        get()._addAlert('ev_conflict', 'warning', 'EV Charging Conflict',
          `Starting EV charging at ${formatPower(state.evCharger.targetPower)} would exceed capacity. Consider reducing house load first.`
        );
      }

      set((s) => ({
        evCharger: { ...s.evCharger, state: 'charging', power: s.evCharger.targetPower, chargingStartedAt: now },
      }));

      if (evDevice) {
        set((s) => ({
          devices: {
            ...s.devices,
            [evDeviceId as string]: {
              ...evDevice,
              powerState: 'on',
              status: 'running',
              currentConsumption: state.evCharger.targetPower,
              turnedOnAt: now,
            },
          },
        }));
      }

      get()._addEvent('ev_charging_start', 'info', 
        `EV charging started at ${formatPower(state.evCharger.targetPower)}`
      );
    } else if (evState === 'paused') {
      set((s) => ({
        evCharger: { ...s.evCharger, state: 'paused', power: 0 },
      }));

      if (evDevice) {
        set((s) => ({
          devices: {
            ...s.devices,
            [evDeviceId as string]: { ...evDevice, powerState: 'off', status: 'standby', currentConsumption: 0 },
          },
        }));
      }

      get()._addEvent('ev_charging_pause', 'warning', 'EV charging paused');
    } else if (evState === 'completed') {
      set((s) => ({
        evCharger: { ...s.evCharger, state: 'completed', power: 0, batteryLevel: 100 },
      }));

      if (evDevice) {
        set((s) => ({
          devices: {
            ...s.devices,
            [evDeviceId as string]: { ...evDevice, powerState: 'off', status: 'standby', currentConsumption: 0 },
          },
        }));
      }

      get()._addEvent('ev_charging_complete', 'info', 'EV charging completed — battery at 100%');
    } else {
      set((s) => ({
        evCharger: { ...s.evCharger, state: 'disconnected', power: 0, batteryLevel: 0, chargingStartedAt: null },
      }));

      if (evDevice) {
        set((s) => ({
          devices: {
            ...s.devices,
            [evDeviceId as string]: { ...evDevice, powerState: 'off', status: 'disconnected', currentConsumption: 0 },
          },
        }));
      }

      get()._addEvent('ev_charging_disconnect', 'info', 'EV charger disconnected');
    }

    get()._recalculateMetrics();
    get()._checkMCB();

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('evChargerState', JSON.stringify(get().evCharger));
      }
    } catch (e) { /* ignore */ }
  },

  setEVChargingPower: (power: number) => {
    const clamped = Math.max(6000, Math.min(11000, power));
    set((s) => ({
      evCharger: { ...s.evCharger, targetPower: clamped },
    }));
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('evChargerState', JSON.stringify(get().evCharger));
      }
    } catch (e) { /* ignore */ }

    // If currently charging, update consumption
    if (get().evCharger.state === 'charging') {
      const state = get();
      const evDevice = Object.values(state.devices).find((d) => d.type === 'energy_evse');
      if (evDevice) {
        set((s) => ({
          evCharger: { ...s.evCharger, power: clamped },
          devices: {
            ...s.devices,
            [evDevice.id]: { ...evDevice, currentConsumption: clamped },
          },
        }));
      }
      get()._recalculateMetrics();
      get()._checkMCB();
    }

    get()._addEvent('power_change', 'info', `EV charging power set to ${formatPower(clamped)}`);
  },

  setEVBatteryLevel: (level: number) => {
    set((s) => ({
      evCharger: { ...s.evCharger, batteryLevel: Math.max(0, Math.min(100, level)) },
    }));
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('evChargerState', JSON.stringify(get().evCharger));
      }
    } catch (e) { /* ignore */ }
  },

  // ─── Alerts ────────────────────────────────────────────────────────
  dismissAlert: (id: string) => {
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? { ...a, dismissed: true } : a)),
    }));
  },

  dismissAllAlerts: () => {
    set((s) => ({
      alerts: s.alerts.map((a) => ({ ...a, dismissed: true })),
    }));
  },

  // ─── Internal: Recalculate Metrics ─────────────────────────────────
  _recalculateMetrics: () => {
    const state = get();
    const devices = Object.values(state.devices);

    // Current load = sum of all ON device consumption (excluding generation devices)
    const rawLoad = devices
      .filter((d) => d.type !== 'solar_panel' && d.type !== 'energy_solar' && d.type !== 'solar_pv')
      .reduce((sum, d) => sum + d.currentConsumption, 0);

    const solarGenerationKw = useSimulationStore.getState().metrics.solar_generation_kw || 0;
    const solarGenerationWatts = solarGenerationKw * 1000;
    
    // Net load after solar generation (can be negative, but bounded to 0 for load metrics)
    const currentLoad = Math.max(0, rawLoad - solarGenerationWatts);

    // Peak load tracking
    const peakLoad = Math.max(state.metrics.peakLoad, currentLoad);

    // Average load (running average)
    const historyCount = state.loadHistory.length;
    const prevSum = state.metrics.averageLoad * historyCount;
    const averageLoad = historyCount > 0 ? (prevSum + currentLoad) / (historyCount + 1) : currentLoad;

    // Available capacity
    const availableCapacity = Math.max(0, state.homeConfig.maxCapacityWatts - currentLoad);

    // Current draw
    const currentDraw = calculateCurrent(currentLoad, state.homeConfig.voltage, state.homeConfig.powerFactor);

    // Load percentage & level
    const loadPercentage = getLoadPercentage(currentLoad, state.homeConfig.maxCapacityWatts);
    const loadLevel = getLoadLevel(loadPercentage);

    // Estimated monthly kWh (based on current load running 24/7)
    const estimatedMonthlyKWh = (currentLoad / 1000) * 24 * 30;

    // Running device count
    const runningDevices = devices.filter((d) => d.powerState === 'on').length;

    set({
      metrics: {
        ...state.metrics,
        currentLoad,
        peakLoad,
        averageLoad,
        availableCapacity,
        voltage: state.homeConfig.voltage,
        current: currentDraw,
        powerFactor: state.homeConfig.powerFactor,
        estimatedMonthlyKWh,
        loadPercentage,
        loadLevel,
      },
    });
  },

  // ─── Internal: Add Event ───────────────────────────────────────────
  _addEvent: (type, severity, message, deviceId, deviceName, data) => {
    const event: EnergyEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      severity,
      message,
      timestamp: Date.now(),
      deviceId,
      deviceName,
      data,
    };

    set((s) => ({
      events: [event, ...s.events].slice(0, s.maxEvents),
    }));
  },

  // ─── Internal: Add Alert ───────────────────────────────────────────
  _addAlert: (type, severity, title, message, deviceId) => {
    const alert: EnergyAlert = {
      id: `alt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      severity,
      title,
      message,
      timestamp: Date.now(),
      dismissed: false,
      deviceId,
    };

    set((s) => ({
      alerts: [alert, ...s.alerts].slice(0, 100),
    }));
  },

  // ─── Internal: Check MCB ───────────────────────────────────────────
  _checkMCB: () => {
    const state = get();
    const { currentLoad } = state.metrics;
    const { configuredCapacity } = state.mcb;

    // Check near-overload warning (90-100%)
    const loadPct = getLoadPercentage(currentLoad, configuredCapacity);

    if (loadPct >= 90 && loadPct <= 100 && state.mcb.state === 'on') {
      get()._addAlert('near_overload', 'warning', '⚠ Near Overload',
        `Load at ${loadPct.toFixed(1)}% of capacity (${formatPower(currentLoad)} / ${formatPower(configuredCapacity)})`
      );
    }

    // Check overload → MCB trip
    if (currentLoad > configuredCapacity && state.mcb.state === 'on') {
      const onDevices = Object.values(state.devices)
        .filter((d) => d.powerState === 'on')
        .sort((a, b) => b.currentConsumption - a.currentConsumption);

      const responsibleDevices = onDevices.map((d) => d.id);
      const exceededBy = currentLoad - configuredCapacity;

      set({
        mcb: {
          state: 'tripped',
          tripTime: Date.now(),
          tripCause: `Load (${formatPower(currentLoad)}) exceeded capacity (${formatPower(configuredCapacity)})`,
          configuredCapacity,
          loadAtTrip: currentLoad,
          exceededBy,
          responsibleDevices,
        },
      });

      // Pause EV charging on MCB trip
      if (state.evCharger.state === 'charging') {
        get().setEVChargerState('paused');
      }

      get()._addEvent('mcb_trip', 'critical', 
        `⚠ MCB TRIPPED — Load ${formatPower(currentLoad)} exceeded capacity ${formatPower(configuredCapacity)} by ${formatPower(exceededBy)}`
      );

      get()._addAlert('mcb_trip', 'critical', '⚡ OVERLOAD DETECTED',
        `MCB has tripped! Current load (${formatPower(currentLoad)}) exceeds configured capacity (${formatPower(configuredCapacity)}) by ${formatPower(exceededBy)}. Turn off devices and reset the MCB.`
      );
    }
  },

  // ─── Internal: Update Load History ─────────────────────────────────
  _updateLoadHistory: () => {
    const state = get();
    const now = Date.now();

    set((s) => ({
      loadHistory: [
        ...s.loadHistory.slice(-119), // Keep last 120 data points
        { timestamp: now, load: s.metrics.currentLoad },
      ],
    }));

    // Update hourly consumption
    const hour = new Date().getHours();
    const hourLabel = `${hour.toString().padStart(2, '0')}:00`;
    
    set((s) => {
      const existing = s.hourlyConsumption.find((h) => h.hour === hourLabel);
      if (existing) {
        return {
          hourlyConsumption: s.hourlyConsumption.map((h) =>
            h.hour === hourLabel ? { ...h, energy: h.energy + s.metrics.currentLoad / 3600 } : h
          ),
        };
      }
      return {
        hourlyConsumption: [...s.hourlyConsumption.slice(-23), { hour: hourLabel, energy: s.metrics.currentLoad / 3600 }],
      };
    });
  },

  // ─── Tick (continuous simulation) ──────────────────────────────────
  tick: () => {
    const state = get();
    const now = Date.now();

    // Accumulate energy for running devices
    Object.values(state.devices).forEach((device) => {
      if (device.powerState === 'on' && device.turnedOnAt) {
        // Small fluctuation for realism (±2%)
        const fluctuation = 1 + (Math.random() - 0.5) * 0.04;
        const adjustedPower = device.currentConsumption * fluctuation;

        set((s) => ({
          devices: {
            ...s.devices,
            [device.id]: {
              ...s.devices[device.id],
              currentConsumption: adjustedPower,
              energyHistory: [
                ...s.devices[device.id].energyHistory.slice(-59),
                { timestamp: now, power: adjustedPower },
              ],
            },
          },
        }));
      }
    });

    // EV battery simulation
    if (state.evCharger.state === 'charging' && state.evCharger.batteryLevel < 100) {
      // Physics: power is in Watts. Energy in Wh = power * time_in_hours.
      // We tick once per second. Time in hours = 1 / 3600.
      // Battery capacity = state.evCharger.batteryCapacityWh (e.g. 60,000 Wh).
      // True rate per second: (power * 1/3600) / capacity * 100
      // Demo speedup factor: x10 (so it charges in ~48 mins instead of 8 hours)
      const chargeRatePerSecond = (state.evCharger.power / 3600) / state.evCharger.batteryCapacityWh * 100 * 10;
      
      const newLevel = Math.min(100, state.evCharger.batteryLevel + chargeRatePerSecond);

      set((s) => {
        const nextEvCharger = { ...s.evCharger, batteryLevel: newLevel };
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('evChargerState', JSON.stringify(nextEvCharger));
          }
        } catch (e) { /* ignore */ }
        return { evCharger: nextEvCharger };
      });

      if (newLevel >= 100) {
        get().setEVChargerState('completed');
      }
    }

    // Update energy counters
    const energyIncrement = state.metrics.currentLoad / 3600; // Wh per second (tick = ~1s)
    set((s) => ({
      metrics: {
        ...s.metrics,
        energyToday: s.metrics.energyToday + energyIncrement,
        totalEnergy: s.metrics.totalEnergy + energyIncrement,
      },
    }));

    get()._recalculateMetrics();
    get()._updateLoadHistory();
  },
}));

// =============================================================================
// SELECTORS (Memoization helpers)
// =============================================================================

/** Get all running devices */
export const selectRunningDevices = (state: EnergyEngineState) =>
  Object.values(state.devices).filter((d) => d.powerState === 'on');

/** Get all devices sorted by consumption (highest first) */
export const selectDevicesByConsumption = (state: EnergyEngineState) =>
  Object.values(state.devices)
    .filter((d) => d.powerState === 'on')
    .sort((a, b) => b.currentConsumption - a.currentConsumption);

/** Get device count by status */
export const selectDeviceCountsByStatus = (state: EnergyEngineState) => {
  const counts: Record<DeviceStatusType, number> = {
    running: 0, standby: 0, offline: 0, fault: 0, disconnected: 0, unknown: 0,
  };
  Object.values(state.devices).forEach((d) => { counts[d.status]++; });
  return counts;
};

/** Get room-wise consumption */
export const selectRoomConsumption = (state: EnergyEngineState) => {
  const rooms: Record<string, number> = {};
  Object.values(state.devices).forEach((d) => {
    rooms[d.room] = (rooms[d.room] || 0) + d.currentConsumption;
  });
  return Object.entries(rooms).map(([name, power]) => ({ name, power }));
};

/** Get active (undismissed) alerts */
export const selectActiveAlerts = (state: EnergyEngineState) =>
  state.alerts.filter((a) => !a.dismissed);

/** Get load color for current state */
export const selectLoadColor = (state: EnergyEngineState) =>
  LOAD_LEVEL_COLORS[state.metrics.loadLevel];

// =============================================================================
// BACKEND SYNC (Device Store -> Energy Engine)
// =============================================================================

import { useDeviceStore } from '@/store';

let isSyncing = false;

// Subscribe to backend device store updates (e.g. from websocket or devices page)
useDeviceStore.subscribe((state, prevState) => {
  if (isSyncing) return;
  
  const energyState = useEnergyStore.getState();
  if (energyState.deviceOrder.length === 0 || Object.keys(energyState.devices).length !== state.devices.length) {
    if (state.devices.length > 0) {
      energyState.initializeDevices();
    }
    if (energyState.deviceOrder.length === 0) return;
  }
  
  isSyncing = true;
  
  state.devices.forEach(device => {
    const prevDevice = prevState.devices.find(d => d.id === device.id);
    if (!prevDevice || prevDevice.power_state !== device.power_state) {
      // The energy store ID is exactly the backend device ID now
      const energyId = device.id;
      let energyDevice = energyState.devices[energyId];
      if (!energyDevice) {
        energyDevice = Object.values(energyState.devices).find(d => d.type === device.type) as any;
      }
      const targetState = device.power_state === 'on' ? 'on' : 'off';
      
      // Only toggle if states don't match (prevents infinite loops)
      if (energyDevice && energyDevice.powerState !== targetState) {
        // Toggle it locally without syncing back to the backend
        energyState.toggleDevice(energyDevice.id, true);
      }
      
      // Also sync EV Charger specifically
      if (device.type === 'energy_evse') {
        const currentEvState = energyState.evCharger.state;
        if (targetState === 'on' && currentEvState !== 'charging') {
          energyState.setEVChargerState('charging');
        } else if (targetState === 'off' && currentEvState !== 'disconnected') {
          energyState.setEVChargerState('disconnected');
        }
      }
    }
  });
  
  isSyncing = false;
});
