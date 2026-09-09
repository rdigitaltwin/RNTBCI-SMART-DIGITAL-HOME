import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import FloorPlanHouse from '../FloorPlanHouse';
import { useEnergyStore } from '@/store/energyEngine';

// Mock React Three Fiber and Drei to avoid WebGL context errors in JSDOM
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
}));

vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: React.ReactNode }) => <div data-testid="3d-html">{children}</div>,
  Sparkles: () => null,
}));

// Mock Three.js
vi.mock('three', () => ({
  DoubleSide: 2,
  MathUtils: {
    lerp: (start: number, end: number, amt: number) => (1 - amt) * start + amt * end,
  },
  BoxGeometry: class {},
  ConeGeometry: class {},
  MeshStandardMaterial: class {},
  LineBasicMaterial: class {},
}));

// Mock native elements so they don't crash
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useRef: () => ({ current: null }),
  };
});

describe('FloorPlanHouse 3D Digital Twin', () => {
  beforeEach(() => {
    // Reset store state
    useEnergyStore.setState({
      evCharger: {
        state: 'disconnected',
        batteryLevel: 0,
        power: 0,
        targetPower: 7400,
        batteryCapacityWh: 60000,
        chargingStartedAt: null,
        estimatedCompletion: null,
      },
      devices: {},
    });
  });

  it('renders vehicle as IDLE when EVSE is charging but EV Vehicle toggle is OFF', () => {
    useEnergyStore.setState({
      evCharger: {
        state: 'charging',
        batteryLevel: 60,
        power: 7360,
        targetPower: 7400,
        batteryCapacityWh: 60000,
        chargingStartedAt: Date.now(),
        estimatedCompletion: null,
      },
      devices: {
        'ev_vehicle_1': {
          id: 'ev_vehicle_1',
          applianceId: 'ev',
          name: 'EV Vehicle',
          type: 'ev_vehicle',
          category: 'ev',
          room: 'exterior',
          powerState: 'off',
          status: 'standby',
          currentConsumption: 0,
          ratedPowerMin: 1000,
          ratedPowerMax: 11000,
          defaultPower: 7400,
          icon: 'car',
          energyHistory: [],
          turnedOnAt: null,
          totalEnergyWh: 0,
        }
      }
    });

    vi.spyOn(React, 'useRef').mockReturnValue({ current: { material: {} } });

    render(
      <FloorPlanHouse hoveredRoom={null} onRoomClick={vi.fn()} />
    );

    expect(screen.getByText(/EVSE • CHARGING/i)).toBeDefined();
    expect(screen.getByText(/IDLE/i)).toBeDefined();
    expect(screen.queryByText(/⚡ CHARGING •/i)).toBeNull();
  });
  
  it('renders vehicle as CHARGING when EVSE is charging and EV Vehicle toggle is ON', () => {
    useEnergyStore.setState({
      evCharger: {
        state: 'charging',
        batteryLevel: 60,
        power: 7360,
        targetPower: 7400,
        batteryCapacityWh: 60000,
        chargingStartedAt: Date.now(),
        estimatedCompletion: null,
      },
      devices: {
        'ev_vehicle_1': {
          id: 'ev_vehicle_1',
          applianceId: 'ev',
          name: 'EV Vehicle',
          type: 'ev_vehicle',
          category: 'ev',
          room: 'exterior',
          powerState: 'on',
          status: 'running',
          currentConsumption: 7000,
          ratedPowerMin: 1000,
          ratedPowerMax: 11000,
          defaultPower: 7400,
          icon: 'car',
          energyHistory: [],
          turnedOnAt: Date.now(),
          totalEnergyWh: 1000,
        }
      }
    });

    vi.spyOn(React, 'useRef').mockReturnValue({ current: { material: {} } });

    render(
      <FloorPlanHouse hoveredRoom={null} onRoomClick={vi.fn()} />
    );

    expect(screen.getByText(/EVSE • CHARGING/i)).toBeDefined();
    expect(screen.getByText(/⚡ CHARGING • 60%/i)).toBeDefined();
  });
});
