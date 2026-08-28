/**
 * RNTBCI Smart Home Digital Twin — Appliance Power Database
 *
 * Complete power database for French residential electrical standards.
 * All rated power values match the specification exactly.
 */

// =============================================================================
// TYPES
// =============================================================================

export type ApplianceCategory =
  | 'kitchen'
  | 'living'
  | 'bedroom'
  | 'bathroom'
  | 'utility'
  | 'outdoor'
  | 'infrastructure';

export type DeviceStatusType =
  | 'running'
  | 'standby'
  | 'offline'
  | 'fault'
  | 'disconnected'
  | 'unknown';

export const DEVICE_STATUS_COLORS: Record<DeviceStatusType, string> = {
  running: '#00FF9D',
  standby: '#FFC857',
  offline: '#64748B',
  fault: '#FF4D6D',
  disconnected: '#FF0040',
  unknown: '#94A3B8',
};

export const DEVICE_STATUS_LABELS: Record<DeviceStatusType, string> = {
  running: 'Running',
  standby: 'Standby',
  offline: 'Offline',
  fault: 'Fault',
  disconnected: 'Disconnected',
  unknown: 'Unknown',
};

export interface ApplianceSpec {
  id: string;
  name: string;
  type: string;
  category: ApplianceCategory;
  room: string;
  ratedPowerMin: number; // Watts
  ratedPowerMax: number; // Watts
  defaultPower: number;  // Watts (typical operating power)
  standbyPower: number;  // Watts (when in standby mode)
  icon: string;
  model: string;
  description: string;
}

// =============================================================================
// APPLIANCE POWER DATABASE
// =============================================================================

export const APPLIANCE_DATABASE: ApplianceSpec[] = [
  // ─── Kitchen ───────────────────────────────────────────────────────────
  {
    id: 'microwave',
    name: 'Microwave Oven',
    type: 'microwave',
    category: 'kitchen',
    room: 'Kitchen/Living',
    ratedPowerMin: 1000,
    ratedPowerMax: 1500,
    defaultPower: 1200,
    standbyPower: 3,
    icon: '🔥',
    model: 'microwave_oven',
    description: 'Kitchen microwave oven with grill function',
  },
  {
    id: 'dishwasher',
    name: 'Dishwasher',
    type: 'dishwasher',
    category: 'kitchen',
    room: 'Kitchen/Living',
    ratedPowerMin: 1200,
    ratedPowerMax: 1800,
    defaultPower: 1500,
    standbyPower: 2,
    icon: '🍽️',
    model: 'dishwasher',
    description: 'Energy-efficient dishwasher with eco mode',
  },
  {
    id: 'refrigerator',
    name: 'Refrigerator',
    type: 'refrigerator',
    category: 'kitchen',
    room: 'Kitchen/Living',
    ratedPowerMin: 100,
    ratedPowerMax: 300,
    defaultPower: 150,
    standbyPower: 0,
    icon: '🧊',
    model: 'refrigerator',
    description: 'Combined fridge-freezer, always-on appliance',
  },
  {
    id: 'kitchen_light',
    name: 'Kitchen Light',
    type: 'smart_light',
    category: 'kitchen',
    room: 'Kitchen/Living',
    ratedPowerMin: 15,
    ratedPowerMax: 15,
    defaultPower: 15,
    standbyPower: 0.5,
    icon: '💡',
    model: 'smart_light',
    description: 'LED smart light with dimming capability',
  },

  // ─── Living Room ───────────────────────────────────────────────────────
  {
    id: 'cctv',
    name: 'CCTV Camera',
    type: 'camera',
    category: 'living',
    room: 'Kitchen/Living',
    ratedPowerMin: 5,
    ratedPowerMax: 15,
    defaultPower: 10,
    standbyPower: 3,
    icon: '📷',
    model: 'cctv_camera',
    description: 'Indoor/outdoor security camera with night vision',
  },
  {
    id: 'smart_meter',
    name: 'Smart Meter',
    type: 'smart_meter',
    category: 'infrastructure',
    room: 'Kitchen/Living',
    ratedPowerMin: 5,
    ratedPowerMax: 5,
    defaultPower: 5,
    standbyPower: 5,
    icon: '📊',
    model: 'smart_meter',
    description: 'Linky-compatible smart energy meter',
  },
  {
    id: 'living_light_1',
    name: 'Living Room Light 1',
    type: 'smart_light',
    category: 'living',
    room: 'Kitchen/Living',
    ratedPowerMin: 15,
    ratedPowerMax: 15,
    defaultPower: 15,
    standbyPower: 0.5,
    icon: '💡',
    model: 'smart_light',
    description: 'LED smart light with color temperature control',
  },
  {
    id: 'living_light_2',
    name: 'Living Room Light 2',
    type: 'smart_light',
    category: 'living',
    room: 'Kitchen/Living',
    ratedPowerMin: 15,
    ratedPowerMax: 15,
    defaultPower: 15,
    standbyPower: 0.5,
    icon: '💡',
    model: 'smart_light',
    description: 'LED smart light with color temperature control',
  },

  // ─── Bedroom ───────────────────────────────────────────────────────────
  {
    id: 'bedroom_light',
    name: 'Bedroom Light',
    type: 'smart_light',
    category: 'bedroom',
    room: 'Bedroom',
    ratedPowerMin: 15,
    ratedPowerMax: 15,
    defaultPower: 15,
    standbyPower: 0.5,
    icon: '💡',
    model: 'smart_light',
    description: 'LED smart light with warm white setting',
  },
  {
    id: 'hvac',
    name: 'HVAC System',
    type: 'hvac',
    category: 'bedroom',
    room: 'Bedroom',
    ratedPowerMin: 2000,
    ratedPowerMax: 3500,
    defaultPower: 2500,
    standbyPower: 10,
    icon: '❄️',
    model: 'hvac_system',
    description: 'Central heating, ventilation, and air conditioning',
  },
  {
    id: 'heat_pump',
    name: 'Heat Pump',
    type: 'heat_pump',
    category: 'bedroom',
    room: 'Bedroom',
    ratedPowerMin: 3000,
    ratedPowerMax: 5000,
    defaultPower: 4000,
    standbyPower: 15,
    icon: '🌡️',
    model: 'heat_pump',
    description: 'Air-source heat pump for heating and cooling',
  },
  {
    id: 'air_conditioner',
    name: 'Air Conditioner',
    type: 'air_conditioner',
    category: 'bedroom',
    room: 'Bedroom',
    ratedPowerMin: 2000,
    ratedPowerMax: 3500,
    defaultPower: 2500,
    standbyPower: 8,
    icon: '🌀',
    model: 'air_conditioner',
    description: 'Split-system air conditioning unit',
  },

  // ─── Bathroom ──────────────────────────────────────────────────────────
  {
    id: 'washing_machine',
    name: 'Washing Machine',
    type: 'washing_machine',
    category: 'bathroom',
    room: 'Bathroom',
    ratedPowerMin: 1800,
    ratedPowerMax: 2500,
    defaultPower: 2100,
    standbyPower: 2,
    icon: '🧺',
    model: 'washing_machine',
    description: 'Front-loading washing machine with eco cycle',
  },
  {
    id: 'water_heater',
    name: 'Water Heater',
    type: 'water_heater',
    category: 'bathroom',
    room: 'Bathroom',
    ratedPowerMin: 1500,
    ratedPowerMax: 3000,
    defaultPower: 2000,
    standbyPower: 5,
    icon: '🔥',
    model: 'water_heater',
    description: 'Electric water heater / ballon d\'eau chaude',
  },
  {
    id: 'bathroom_light',
    name: 'Bathroom Light',
    type: 'smart_light',
    category: 'bathroom',
    room: 'Bathroom',
    ratedPowerMin: 15,
    ratedPowerMax: 15,
    defaultPower: 15,
    standbyPower: 0.5,
    icon: '💡',
    model: 'smart_light',
    description: 'IP44 rated bathroom LED light',
  },

  // ─── Outside ───────────────────────────────────────────────────────────
  {
    id: 'ev_charger',
    name: 'EV Charger (EVSE)',
    type: 'energy_evse',
    category: 'outdoor',
    room: 'Exterior',
    ratedPowerMin: 6000,
    ratedPowerMax: 11000,
    defaultPower: 7400,
    standbyPower: 5,
    icon: '🔌⚡',
    model: 'ev_charger',
    description: 'Mode 3 EV charging station (Type 2)',
  },
  {
    id: 'solar_panel',
    name: 'Solar Panel Array',
    type: 'solar_pv',
    category: 'outdoor',
    room: 'Exterior',
    ratedPowerMin: 0,
    ratedPowerMax: -8000,
    defaultPower: -5000,
    standbyPower: 0,
    icon: '☀️',
    model: 'solar_array',
    description: 'Rooftop solar photovoltaic array',
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Get appliance spec by ID */
export function getApplianceById(id: string): ApplianceSpec | undefined {
  return APPLIANCE_DATABASE.find((a) => a.id === id);
}

/** Get all appliances in a specific room */
export function getAppliancesByRoom(room: string): ApplianceSpec[] {
  return APPLIANCE_DATABASE.filter((a) => a.room === room);
}

/** Get all appliances in a category */
export function getAppliancesByCategory(category: ApplianceCategory): ApplianceSpec[] {
  return APPLIANCE_DATABASE.filter((a) => a.category === category);
}

/** Get total rated power range for all appliances */
export function getTotalRatedPowerRange(): { min: number; max: number } {
  return APPLIANCE_DATABASE.reduce(
    (acc, a) => ({
      min: acc.min + a.ratedPowerMin,
      max: acc.max + a.ratedPowerMax,
    }),
    { min: 0, max: 0 }
  );
}

/** Get rooms with device counts */
export function getRoomDeviceCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  APPLIANCE_DATABASE.forEach((a) => {
    counts[a.room] = (counts[a.room] || 0) + 1;
  });
  return counts;
}

/** Format power value for display */
export function formatPower(watts: number): string {
  if (watts >= 1000) {
    return `${(watts / 1000).toFixed(2)} kW`;
  }
  return `${Math.round(watts)} W`;
}

/** Format energy value for display */
export function formatEnergy(wattHours: number): string {
  if (wattHours >= 1000) {
    return `${(wattHours / 1000).toFixed(2)} kWh`;
  }
  return `${Math.round(wattHours)} Wh`;
}
