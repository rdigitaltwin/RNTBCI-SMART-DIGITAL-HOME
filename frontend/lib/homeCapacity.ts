/**
 * RNTBCI Smart Home Digital Twin — Home Capacity Configuration
 *
 * French residential electrical standards and usage profiles.
 * Configurable energy meter parameters reflecting country-specific
 * electrical characteristics for France.
 */

// =============================================================================
// TYPES
// =============================================================================

export type HomeProfileType = 'small' | 'medium' | 'large';
export type PhaseType = 'single' | 'three';

export interface HomeProfile {
  id: HomeProfileType;
  name: string;
  description: string;
  voltage: number;               // Volts
  phaseType: PhaseType;
  optionalPhase?: number;        // Optional 3-phase voltage
  contractedPowerMin: number;    // kVA
  contractedPowerMax: number;    // kVA
  defaultContractedPower: number;// kVA
  currentRatingMin: number;      // Amps
  currentRatingMax: number;      // Amps
  defaultCurrentRating: number;  // Amps
  supportedDevices: string[];
  icon: string;
  color: string;
}

export interface HomeCapacityConfig {
  profile: HomeProfileType;
  voltage: number;               // V
  contractedPower: number;       // kVA
  currentRating: number;         // A
  maxCapacityWatts: number;      // W (derived from contractedPower)
  phaseType: PhaseType;
  powerFactor: number;           // 0.0 – 1.0, default 0.95
}

// =============================================================================
// FRENCH RESIDENTIAL PROFILES
// =============================================================================

export const HOME_PROFILES: Record<HomeProfileType, HomeProfile> = {
  small: {
    id: 'small',
    name: 'Small Residential Villa',
    description: 'Compact home with standard appliances and basic EV charging capability.',
    voltage: 230,
    phaseType: 'single',
    contractedPowerMin: 6,
    contractedPowerMax: 12,
    defaultContractedPower: 9,
    currentRatingMin: 30,
    currentRatingMax: 60,
    defaultCurrentRating: 40,
    supportedDevices: [
      'Standard HVAC',
      'Basic EV charging',
      'Standard appliances',
      'Lighting',
    ],
    icon: '🏠',
    color: '#3B82F6',
  },
  medium: {
    id: 'medium',
    name: 'Medium Family Home',
    description: 'Family home with smart energy integration, efficient HVAC, and slow EV charging.',
    voltage: 230,
    phaseType: 'single',
    contractedPowerMin: 9,
    contractedPowerMax: 12,
    defaultContractedPower: 12,
    currentRatingMin: 30,
    currentRatingMax: 45,
    defaultCurrentRating: 45,
    supportedDevices: [
      'Smart energy integration',
      'Efficient HVAC (heat pump)',
      'Small EV charger (slow)',
      'Smart home automation',
    ],
    icon: '🏡',
    color: '#00E5FF',
  },
  large: {
    id: 'large',
    name: 'Large Villa / High-End Home',
    description: 'Premium home with full smart automation, high-power EV charging, solar, and battery.',
    voltage: 230,
    phaseType: 'single',
    optionalPhase: 400,
    contractedPowerMin: 12,
    contractedPowerMax: 24,
    defaultContractedPower: 18,
    currentRatingMin: 45,
    currentRatingMax: 90,
    defaultCurrentRating: 60,
    supportedDevices: [
      '11–22 kW EV charging',
      'Pool pumps',
      'Large HVAC systems',
      'Smart home automation',
      'Solar PV + battery integration',
    ],
    icon: '🏰',
    color: '#8B5CF6',
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Create a HomeCapacityConfig from a profile with defaults */
export function createDefaultConfig(profileType: HomeProfileType): HomeCapacityConfig {
  const profile = HOME_PROFILES[profileType];
  const contractedPower = profile.defaultContractedPower;
  return {
    profile: profileType,
    voltage: profile.voltage,
    contractedPower,
    currentRating: profile.defaultCurrentRating,
    maxCapacityWatts: contractedPower * 1000, // kVA → W (at PF=1 approximation)
    phaseType: profile.phaseType,
    powerFactor: 0.95,
  };
}

/** Recalculate max capacity from contracted power and power factor */
export function calculateMaxCapacity(
  contractedPowerKVA: number,
  powerFactor: number = 0.95
): number {
  // W = kVA × 1000 × power_factor
  return contractedPowerKVA * 1000 * powerFactor;
}

/** Calculate current from power, voltage, and power factor */
export function calculateCurrent(
  powerWatts: number,
  voltage: number = 230,
  powerFactor: number = 0.95
): number {
  return powerWatts / (voltage * powerFactor);
}

/** Get load percentage */
export function getLoadPercentage(currentLoadWatts: number, maxCapacityWatts: number): number {
  if (maxCapacityWatts <= 0) return 0;
  return (currentLoadWatts / maxCapacityWatts) * 100;
}

/** Get load warning level based on percentage */
export type LoadLevel = 'green' | 'yellow' | 'orange' | 'red';

export function getLoadLevel(percentage: number): LoadLevel {
  if (percentage > 100) return 'red';
  if (percentage >= 90) return 'orange';
  if (percentage >= 70) return 'yellow';
  return 'green';
}

export const LOAD_LEVEL_COLORS: Record<LoadLevel, string> = {
  green: '#00FF9D',
  yellow: '#FFC857',
  orange: '#FF8C00',
  red: '#FF4D6D',
};

export const LOAD_LEVEL_LABELS: Record<LoadLevel, string> = {
  green: 'Normal (0–70%)',
  yellow: 'Elevated (70–90%)',
  orange: 'Critical (90–100%)',
  red: 'OVERLOAD (>100%)',
};

/** Validate contracted power against profile limits */
export function isValidContractedPower(
  profileType: HomeProfileType,
  contractedPower: number
): boolean {
  const profile = HOME_PROFILES[profileType];
  return (
    contractedPower >= profile.contractedPowerMin &&
    contractedPower <= profile.contractedPowerMax
  );
}

/** Validate current rating against profile limits */
export function isValidCurrentRating(
  profileType: HomeProfileType,
  currentRating: number
): boolean {
  const profile = HOME_PROFILES[profileType];
  return (
    currentRating >= profile.currentRatingMin &&
    currentRating <= profile.currentRatingMax
  );
}
