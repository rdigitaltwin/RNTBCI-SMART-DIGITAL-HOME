'use client';

/**
 * RNTBCI Smart Home Digital Twin — Energy-Aware Device Models
 *
 * 3D representations of every appliance in the house, with:
 * - ON/OFF state visualization
 * - Hover animation
 * - Click interaction → selection outline + HUD
 * - Power indicator (glow intensity based on consumption)
 * - Status indicator (colored dot)
 * - Live energy usage display
 * - Real-time sync with energy engine
 *
 * Devices placed according to floor plan positions.
 */

import { useRef, useMemo, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Sparkles, Float } from '@react-three/drei';
import * as THREE from 'three';
import { useEnergyStore, type EnergyDevice } from '@/store/energyEngine';
import { DEVICE_STATUS_COLORS, formatPower } from '@/lib/applianceDatabase';
import { LOAD_LEVEL_COLORS } from '@/lib/homeCapacity';
import { SCALE } from '@/components/three/FloorPlanHouse';

// =============================================================================
// DEVICE POSITIONS — Matching floor plan layout
// =============================================================================

const DEVICE_POSITIONS: Record<string, [number, number, number]> = {
  // Kitchen area (upper-left)
  microwave:       [-2.0 * SCALE, 0.25, -3.0 * SCALE],
  dishwasher:      [ 0.0 * SCALE, 0.15, -3.0 * SCALE],
  refrigerator:    [-0.5 * SCALE, 0.30,  0.0 * SCALE],
  kitchen_light:   [-1.0 * SCALE, 0.48, -2.0 * SCALE],

  // Living area (lower-left of kitchen/living)
  cctv:            [-3.2 * SCALE, 0.30, -0.5 * SCALE],
  smart_meter:     [-3.2 * SCALE, 0.20, -1.5 * SCALE],
  living_light_1:  [-1.5 * SCALE, 0.48, -0.5 * SCALE],
  living_light_2:  [-0.5 * SCALE, 0.48,  0.5 * SCALE],

  // Bedroom (upper-right)
  bedroom_light:   [ 2.5 * SCALE, 0.48, -2.0 * SCALE],
  hvac:            [ 3.8 * SCALE, 0.35, -3.0 * SCALE],
  heat_pump:       [ 3.0 * SCALE, 0.20, -1.0 * SCALE],
  air_conditioner: [ 3.8 * SCALE, 0.35, -2.0 * SCALE],

  // Bathroom (center)
  washing_machine: [ 0.5 * SCALE, 0.15,  0.5 * SCALE],
  water_heater:    [ 1.5 * SCALE, 0.25,  0.5 * SCALE],
  bathroom_light:  [ 1.0 * SCALE, 0.48,  1.5 * SCALE],

  // Outside
  ev_charger:      [-0.8 * SCALE, 0.20,  4.2 * SCALE],
  solar_panel:     [ 0.5 * SCALE, 1.4 * SCALE + 0.45, -0.5 * SCALE],
};

// =============================================================================
// DEVICE COLOR MAP
// =============================================================================

const DEVICE_COLORS: Record<string, string> = {
  microwave: '#F97316',
  dishwasher: '#14B8A6',
  refrigerator: '#22D3EE',
  smart_light: '#FFC857',
  camera: '#EF4444',
  smart_meter: '#3B82F6',
  hvac: '#00B4D8',
  heat_pump: '#8B5CF6',
  air_conditioner: '#06B6D4',
  washing_machine: '#06B6D4',
  water_heater: '#F97316',
  energy_evse: '#10B981',
  solar_pv: '#FCD34D',
};

// =============================================================================
// INDIVIDUAL DEVICE GEOMETRY COMPONENTS
// =============================================================================

function MicrowaveModel({ isOn }: { isOn: boolean }) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.22, 0.14, 0.16]} />
        <meshStandardMaterial color="#2a3142" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Window */}
      <mesh position={[-0.02, 0.01, 0.081]}>
        <planeGeometry args={[0.1, 0.08]} />
        <meshStandardMaterial
          color={isOn ? '#331100' : '#1a1a2a'}
          emissive={isOn ? '#FF6600' : '#000'}
          emissiveIntensity={isOn ? 0.5 : 0}
        />
      </mesh>
      {/* Controls */}
      <mesh position={[0.08, 0, 0.081]}>
        <planeGeometry args={[0.04, 0.08]} />
        <meshStandardMaterial color="#1a1a22" />
      </mesh>
      {isOn && <pointLight position={[0, 0, 0.1]} intensity={0.15} color="#FF6600" distance={0.5} />}
    </group>
  );
}

function DishwasherModel({ isOn }: { isOn: boolean }) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.25, 0.35, 0.25]} />
        <meshStandardMaterial color="#E8E8E8" metalness={0.3} roughness={0.4} />
      </mesh>
      {/* Door */}
      <mesh position={[0, -0.05, 0.126]}>
        <planeGeometry args={[0.22, 0.2]} />
        <meshStandardMaterial color="#ccc" metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Control panel */}
      <mesh position={[0, 0.12, 0.126]}>
        <planeGeometry args={[0.22, 0.06]} />
        <meshStandardMaterial color="#2a2a3a" emissive={isOn ? '#00E5FF' : '#000'} emissiveIntensity={isOn ? 0.3 : 0} />
      </mesh>
      {isOn && <Sparkles count={8} scale={[0.2, 0.3, 0.2]} position={[0, -0.1, 0]} size={0.3} speed={0.3} color="#06B6D4" opacity={0.3} />}
    </group>
  );
}

function RefrigeratorModel({ isOn }: { isOn: boolean }) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.28, 0.65, 0.28]} />
        <meshStandardMaterial color="#2a3142" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0.14, 0, 0.01]}>
        <boxGeometry args={[0.015, 0.25, 0.02]} />
        <meshStandardMaterial color="#888" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0, 0, 0.141]}>
        <planeGeometry args={[0.26, 0.01]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      {isOn && <pointLight position={[0, -0.1, 0.1]} intensity={0.12} color="#00E5FF" distance={0.4} />}
    </group>
  );
}

function SmartLightModel({ isOn, color }: { isOn: boolean; color: string }) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial
          color={isOn ? '#FFF' : '#555'}
          emissive={isOn ? color : '#000'}
          emissiveIntensity={isOn ? 2.5 : 0}
          transparent
          opacity={isOn ? 0.9 : 0.5}
        />
      </mesh>
      {/* Stem */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.01, 0.015, 0.04, 8]} />
        <meshStandardMaterial color="#888" metalness={0.7} />
      </mesh>
      {isOn && <pointLight position={[0, -0.05, 0]} intensity={0.4} color={color} distance={1.5} decay={2} />}
    </group>
  );
}

function CCTVModel({ isOn }: { isOn: boolean }) {
  return (
    <group>
      {/* Body */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.045, 0.06, 16]} />
        <meshStandardMaterial color="#2a3142" metalness={0.7} roughness={0.2} />
      </mesh>
      {/* Lens */}
      <mesh position={[0, 0, 0.035]}>
        <circleGeometry args={[0.02, 16]} />
        <meshStandardMaterial
          color={isOn ? '#111' : '#333'}
          emissive={isOn ? '#EF4444' : '#000'}
          emissiveIntensity={isOn ? 1.5 : 0}
        />
      </mesh>
      {/* Mount */}
      <mesh position={[0, 0.04, -0.03]}>
        <boxGeometry args={[0.06, 0.02, 0.04]} />
        <meshStandardMaterial color="#444" metalness={0.8} />
      </mesh>
    </group>
  );
}

function SmartMeterModel({ isOn }: { isOn: boolean }) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.12, 0.18, 0.05]} />
        <meshStandardMaterial color="#1a2744" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Screen */}
      <mesh position={[0, 0.02, 0.026]}>
        <planeGeometry args={[0.08, 0.06]} />
        <meshStandardMaterial
          color={isOn ? '#001a00' : '#111'}
          emissive={isOn ? '#00FF9D' : '#000'}
          emissiveIntensity={isOn ? 0.6 : 0}
        />
      </mesh>
    </group>
  );
}

function HVACModel({ isOn }: { isOn: boolean }) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.45, 0.12, 0.18]} />
        <meshStandardMaterial color="#1a2744" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.02, 0.091]}>
        <planeGeometry args={[0.4, 0.025]} />
        <meshStandardMaterial color={isOn ? '#00B4D8' : '#333'} emissive={isOn ? '#00B4D8' : '#000'} emissiveIntensity={isOn ? 0.5 : 0} />
      </mesh>
      {isOn && <Sparkles count={15} scale={[0.4, 0.2, 0.4]} position={[0, -0.1, 0.15]} size={0.4} speed={0.3} color="#00B4D8" opacity={0.3} />}
    </group>
  );
}

function HeatPumpModel({ isOn }: { isOn: boolean }) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.3, 0.35, 0.2]} />
        <meshStandardMaterial color="#E8E8E8" metalness={0.4} roughness={0.3} />
      </mesh>
      {/* Fan grille */}
      <mesh position={[0, 0.05, 0.101]}>
        <circleGeometry args={[0.08, 24]} />
        <meshStandardMaterial color="#444" metalness={0.7} />
      </mesh>
      {/* Indicator */}
      <mesh position={[0.1, 0.13, 0.101]}>
        <circleGeometry args={[0.015, 12]} />
        <meshStandardMaterial color={isOn ? '#00FF9D' : '#FF4D6D'} emissive={isOn ? '#00FF9D' : '#FF4D6D'} emissiveIntensity={1} />
      </mesh>
      {isOn && <pointLight position={[0, -0.1, 0.15]} intensity={0.15} color="#8B5CF6" distance={0.6} />}
    </group>
  );
}

function AirConditionerModel({ isOn }: { isOn: boolean }) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.4, 0.1, 0.15]} />
        <meshStandardMaterial color="#F0F0F0" metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Vent */}
      <mesh position={[0, -0.03, 0.076]}>
        <planeGeometry args={[0.35, 0.02]} />
        <meshStandardMaterial color={isOn ? '#06B6D4' : '#666'} emissive={isOn ? '#06B6D4' : '#000'} emissiveIntensity={isOn ? 0.4 : 0} />
      </mesh>
      {isOn && <Sparkles count={10} scale={[0.35, 0.15, 0.3]} position={[0, -0.08, 0.1]} size={0.3} speed={0.2} color="#06B6D4" opacity={0.3} />}
    </group>
  );
}

function WashingMachineModel({ isOn }: { isOn: boolean }) {
  const drumRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (drumRef.current && isOn) {
      drumRef.current.rotation.z += delta * 3;
    }
  });
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.25, 0.35, 0.25]} />
        <meshStandardMaterial color="#E8E8E8" metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh ref={drumRef} position={[0, -0.02, 0.126]}>
        <circleGeometry args={[0.09, 24]} />
        <meshStandardMaterial color="#333" metalness={0.8} roughness={0.1} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

function WaterHeaterModel({ isOn }: { isOn: boolean }) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.4, 16]} />
        <meshStandardMaterial color="#F8F8F8" metalness={0.4} roughness={0.3} />
      </mesh>
      {/* Indicator */}
      <mesh position={[0, 0.1, 0.1]}>
        <circleGeometry args={[0.02, 12]} />
        <meshStandardMaterial
          color={isOn ? '#F97316' : '#555'}
          emissive={isOn ? '#F97316' : '#000'}
          emissiveIntensity={isOn ? 1.5 : 0}
        />
      </mesh>
      {isOn && <pointLight position={[0, -0.1, 0.12]} intensity={0.2} color="#F97316" distance={0.6} />}
    </group>
  );
}

function SolarPanelModel({ isOn }: { isOn: boolean }) {
  return (
    <group rotation={[Math.PI / 8, 0, 0]}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.2, 0.05, 1.8]} />
        <meshStandardMaterial color="#2a3142" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.1, 1.7]} />
        <meshStandardMaterial 
          color={isOn ? '#0e4a7a' : '#111'} 
          emissive={isOn ? '#0e4a7a' : '#000'} 
          emissiveIntensity={isOn ? 0.4 : 0} 
        />
      </mesh>
      {isOn && <Sparkles count={20} scale={[1.1, 0.2, 1.7]} position={[0, 0.1, 0]} size={0.6} speed={0.2} color="#FCD34D" opacity={0.5} />}
    </group>
  );
}

// =============================================================================
// DEVICE HUD (floating info panel on selection)
// =============================================================================

function DeviceEnergyHUD({ device }: { device: EnergyDevice }) {
  const toggleDevice = useEnergyStore((s) => s.toggleDevice);
  const mcbState = useEnergyStore((s) => s.mcb.state);
  const [toggling, setToggling] = useState(false);

  const handleToggle = useCallback(() => {
    setToggling(true);
    toggleDevice(device.id);
    setTimeout(() => setToggling(false), 200);
  }, [device.id, toggleDevice]);

  const isOn = device.powerState === 'on';
  const color = DEVICE_COLORS[device.type] || '#00E5FF';
  const statusColor = DEVICE_STATUS_COLORS[device.status];

  return (
    <div style={{
      width: '260px',
      padding: '16px',
      background: 'linear-gradient(135deg, rgba(5, 8, 22, 0.95), rgba(11, 17, 32, 0.9))',
      backdropFilter: 'blur(20px)',
      border: `1px solid ${color}40`,
      borderRadius: '16px',
      boxShadow: `0 0 30px ${color}15, 0 0 60px rgba(0,0,0,0.3)`,
      pointerEvents: 'auto',
      cursor: 'default',
      animation: 'fadeIn 0.3s ease-out',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>{device.icon}</span>
          <span style={{ fontFamily: "'Orbitron', monospace", fontSize: '11px', fontWeight: 700, color }}>
            {device.name}
          </span>
        </div>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: statusColor,
          boxShadow: `0 0 8px ${statusColor}80`,
        }} />
      </div>

      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>
        <div>
          <div style={{ color: '#64748B', marginBottom: '2px' }}>POWER</div>
          <div style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '16px' }}>
            {isOn ? formatPower(device.currentConsumption) : 'OFF'}
          </div>
        </div>
        <div>
          <div style={{ color: '#64748B', marginBottom: '2px' }}>STATUS</div>
          <div style={{ color: statusColor, fontWeight: 600, textTransform: 'uppercase' }}>
            {device.status}
          </div>
        </div>
        <div>
          <div style={{ color: '#64748B', marginBottom: '2px' }}>RATED</div>
          <div style={{ color: '#94A3B8' }}>
            {formatPower(device.ratedPowerMin)}–{formatPower(device.ratedPowerMax)}
          </div>
        </div>
        <div>
          <div style={{ color: '#64748B', marginBottom: '2px' }}>ROOM</div>
          <div style={{ color: '#94A3B8' }}>{device.room}</div>
        </div>
        <div>
          <div style={{ color: '#64748B', marginBottom: '2px' }}>ENERGY</div>
          <div style={{ color: '#00E5FF' }}>
            {(device.totalEnergyWh / 1000).toFixed(3)} kWh
          </div>
        </div>
        <div>
          <div style={{ color: '#64748B', marginBottom: '2px' }}>TYPE</div>
          <div style={{ color: '#94A3B8', textTransform: 'uppercase', fontSize: '9px' }}>
            {device.type.replace(/_/g, ' ')}
          </div>
        </div>
      </div>

      {/* Power toggle */}
      <div style={{
        marginTop: '12px',
        paddingTop: '10px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '9px', color: '#64748B', fontFamily: "'JetBrains Mono', monospace" }}>
          {device.category.toUpperCase()}
        </span>
        <button
          onClick={handleToggle}
          disabled={toggling || (mcbState === 'tripped' && !isOn)}
          style={{
            background: isOn ? 'rgba(0, 255, 157, 0.15)' : 'rgba(255, 77, 109, 0.15)',
            border: `1px solid ${isOn ? '#00FF9D' : '#FF4D6D'}`,
            color: isOn ? '#00FF9D' : '#FF4D6D',
            padding: '4px 12px',
            borderRadius: '6px',
            cursor: (toggling || (mcbState === 'tripped' && !isOn)) ? 'not-allowed' : 'pointer',
            fontSize: '10px',
            fontWeight: 700,
            fontFamily: "'Orbitron', monospace",
            opacity: toggling ? 0.5 : 1,
            transition: 'all 0.2s',
          }}
        >
          {isOn ? 'TURN OFF' : 'TURN ON'}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// GENERIC DEVICE WRAPPER
// =============================================================================

interface EnergyDeviceModelProps {
  device: EnergyDevice;
  isSelected: boolean;
  onClick: () => void;
}

function EnergyDeviceModelComponent({ device, isSelected, onClick }: EnergyDeviceModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  const isOn = device.powerState === 'on';
  const color = DEVICE_COLORS[device.type] || '#00E5FF';
  const statusColor = DEVICE_STATUS_COLORS[device.status];
  const pos = DEVICE_POSITIONS[device.applianceId] || [0, 0.15, 0];

  // Animate
  useFrame((_, delta) => {
    timeRef.current += delta;
    if (glowRef.current && isOn) {
      const pulse = Math.sin(timeRef.current * 2) * 0.15 + 0.85;
      glowRef.current.scale.setScalar(pulse);
    }
    if (groupRef.current && isSelected) {
      groupRef.current.position.y = pos[1] + Math.sin(timeRef.current * 3) * 0.015;
    }
  });

  // Render the appropriate device geometry
  const renderDeviceGeometry = () => {
    switch (device.type) {
      case 'microwave': return <MicrowaveModel isOn={isOn} />;
      case 'dishwasher': return <DishwasherModel isOn={isOn} />;
      case 'refrigerator': return <RefrigeratorModel isOn={isOn} />;
      case 'smart_light': return <SmartLightModel isOn={isOn} color={color} />;
      case 'camera': return <CCTVModel isOn={isOn} />;
      case 'smart_meter': return <SmartMeterModel isOn={isOn} />;
      case 'hvac': return <HVACModel isOn={isOn} />;
      case 'heat_pump': return <HeatPumpModel isOn={isOn} />;
      case 'air_conditioner': return <AirConditionerModel isOn={isOn} />;
      case 'washing_machine': return <WashingMachineModel isOn={isOn} />;
      case 'water_heater': return <WaterHeaterModel isOn={isOn} />;
      case 'solar_pv': return <SolarPanelModel isOn={isOn} />;
      default:
        return (
          <mesh>
            <boxGeometry args={[0.12, 0.08, 0.08]} />
            <meshStandardMaterial color="#2a3142" metalness={0.5} roughness={0.4} />
          </mesh>
        );
    }
  };

  // Don't render EV charger or solar PV here — rendered as standalone components in the scene
  if (device.type === 'energy_evse' || device.type === 'solar_pv') return null;

  return (
    <group ref={groupRef} position={pos} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {renderDeviceGeometry()}

      {/* Selection ring */}
      {isSelected && (
        <mesh position={[0, -pos[1] + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.18, 0.21, 32]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={2}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Power glow sphere */}
      <mesh ref={glowRef} visible={isOn}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color={color} transparent opacity={0.03} />
      </mesh>

      {/* Status indicator dot (always visible) */}
      <mesh position={[0.12, 0.12, 0]}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={1.5}
        />
      </mesh>

      {/* Inline power label (when on and selected) */}
      {isOn && !isSelected && (
        <Html position={[0, 0.3, 0]} center distanceFactor={8}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '8px',
            color: color,
            background: 'rgba(5, 8, 22, 0.75)',
            padding: '2px 6px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            opacity: 0.8,
          }}>
            {formatPower(device.currentConsumption)}
          </div>
        </Html>
      )}

      {/* Full HUD on selection */}
      {isSelected && (
        <Html position={[0, 0.6, 0]} center distanceFactor={5}>
          <DeviceEnergyHUD device={device} />
        </Html>
      )}
    </group>
  );
}

// =============================================================================
// ALL DEVICES RENDERER
// =============================================================================

export default function AllEnergyDevices({
  selectedDeviceId,
  onSelectDevice,
}: {
  selectedDeviceId: string | null;
  onSelectDevice: (id: string | null) => void;
}) {
  const devices = useEnergyStore((s) => s.devices);
  const deviceOrder = useEnergyStore((s) => s.deviceOrder);

  return (
    <>
      {deviceOrder.map((id) => {
        const device = devices[id];
        if (!device) return null;
        return (
          <EnergyDeviceModelComponent
            key={id}
            device={device}
            isSelected={selectedDeviceId === id}
            onClick={() => onSelectDevice(selectedDeviceId === id ? null : id)}
          />
        );
      })}
    </>
  );
}

export { DEVICE_POSITIONS, DEVICE_COLORS };
