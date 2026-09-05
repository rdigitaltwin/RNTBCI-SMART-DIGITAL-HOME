export const DEVICE_TYPE_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  smart_light: { emoji: '💡', label: 'Smart Light', color: '#FFC857' },
  smart_switch: { emoji: '🔌', label: 'Smart Switch', color: '#94A3B8' },
  smart_plug: { emoji: '🔌', label: 'Smart Plug', color: '#8B5CF6' },
  door_lock: { emoji: '🔒', label: 'Door Lock', color: '#3B82F6' },
  hvac: { emoji: '❄️', label: 'HVAC', color: '#00B4D8' },
  microwave: { emoji: '🔥', label: 'Microwave', color: '#F97316' },
  smart_meter: { emoji: '📊', label: 'Smart Meter', color: '#3B82F6' },
  heat_pump: { emoji: '🌡️', label: 'Heat Pump', color: '#8B5CF6' },
  air_conditioner: { emoji: '🌀', label: 'Air Conditioner', color: '#06B6D4' },
  washing_machine: { emoji: '🧺', label: 'Washing Machine', color: '#06B6D4' },
  dishwasher: { emoji: '🍽️', label: 'Dishwasher', color: '#14B8A6' },
  refrigerator: { emoji: '🧊', label: 'Refrigerator', color: '#22D3EE' },
  water_heater: { emoji: '🔥', label: 'Water Heater', color: '#F97316' },
  camera: { emoji: '📷', label: 'Camera', color: '#EF4444' },
  energy_evse: { emoji: '🚗⚡', label: 'EV Charger', color: '#10B981' },
  ev_vehicle: { emoji: '🚘', label: 'EV Vehicle', color: '#6366F1' },
  solar_pv: { emoji: '☀️', label: 'Solar Panel', color: '#FCD34D' },
  battery_storage: { emoji: '🔋', label: 'Battery Storage', color: '#34D399' },
  mcb: { emoji: '⚡', label: 'Main Breaker', color: '#EF4444' },
};

export function isDeviceConnected(device: { connectivity?: string; status?: string }): boolean {
  if (device.connectivity) {
    const conn = device.connectivity.toLowerCase();
    if (conn === 'disconnected' || conn === 'offline') return false;
  }
  if (device.status) {
    const st = device.status.toLowerCase();
    if (st === 'offline') return false;
  }
  return true;
}

