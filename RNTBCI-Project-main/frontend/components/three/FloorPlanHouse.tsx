'use client';

/**
 * RNTBCI Smart Home Digital Twin — Floor-Plan-Accurate 3D House
 *
 * Built from the provided floor plan blueprint:
 * - Kitchen/Living (259 sq ft) — open plan upper-left
 * - Bedroom (131 sq ft) — upper-right
 * - Bathroom — center, between kitchen and bedroom
 * - Entrance/Hallway — bottom area with stairs
 * - Utility Area — adjacent to bathroom
 * - Exterior — EV charger + vehicle
 *
 * Proportions: 3'3" + 10'2" + 13'6" width ≈ 26'11" total width
 *              24'1" total depth
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { useEnergyStore } from '@/store/energyEngine';
import { LOAD_LEVEL_COLORS } from '@/lib/homeCapacity';

// =============================================================================
// CONSTANTS — Floor plan measurements (converted to 3D units)
// =============================================================================

// Scale: 1 3D unit ≈ 3 feet (for visual comfort)
const SCALE = 0.35;

// Room definitions based on floor plan
const ROOMS = {
  kitchenLiving: {
    name: 'Kitchen / Living',
    // Combined open-plan area — takes up the left 2/3 of the upper section
    position: [-1.2 * SCALE, 0, -1.5 * SCALE] as [number, number, number],
    size: [4.5 * SCALE, 1.4 * SCALE, 4.0 * SCALE] as [number, number, number],
    color: '#00E5FF',
    sqft: '259 sq ft',
  },
  bedroom: {
    name: 'Bedroom',
    // Right side of the upper section
    position: [2.8 * SCALE, 0, -1.8 * SCALE] as [number, number, number],
    size: [3.2 * SCALE, 1.4 * SCALE, 3.5 * SCALE] as [number, number, number],
    color: '#6366F1',
    sqft: '131 sq ft',
  },
  bathroom: {
    name: 'Bathroom',
    // Center area between kitchen and bedroom
    position: [1.0 * SCALE, 0, 0.8 * SCALE] as [number, number, number],
    size: [2.0 * SCALE, 1.4 * SCALE, 2.0 * SCALE] as [number, number, number],
    color: '#06B6D4',
    sqft: '',
  },
  entrance: {
    name: 'Entrance',
    // Bottom-left area
    position: [-1.5 * SCALE, 0, 2.5 * SCALE] as [number, number, number],
    size: [2.5 * SCALE, 1.4 * SCALE, 2.0 * SCALE] as [number, number, number],
    color: '#10B981',
    sqft: '',
  },
  utility: {
    name: 'Utility',
    // Adjacent to bathroom, center-right
    position: [2.8 * SCALE, 0, 1.0 * SCALE] as [number, number, number],
    size: [2.0 * SCALE, 1.4 * SCALE, 2.0 * SCALE] as [number, number, number],
    color: '#F97316',
    sqft: '',
  },
  stairs: {
    name: 'Staircase',
    // Right side bottom
    position: [3.5 * SCALE, 0, 2.5 * SCALE] as [number, number, number],
    size: [1.5 * SCALE, 1.4 * SCALE, 2.0 * SCALE] as [number, number, number],
    color: '#94A3B8',
    sqft: '',
  },
};

// =============================================================================
// ROOM COMPONENT
// =============================================================================

interface RoomProps {
  name: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  sqft: string;
  isHovered: boolean;
  onClick: () => void;
}

function RoomBox({ name, position, size, color, sqft, isHovered, onClick }: RoomProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const edgeRef = useRef<THREE.LineSegments>(null);

  const pos: [number, number, number] = [position[0], size[1] / 2, position[2]];

  useFrame(() => {
    if (edgeRef.current) {
      const mat = edgeRef.current.material as THREE.LineBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, isHovered ? 0.9 : 0.35, 0.08);
    }
  });

  return (
    <group position={pos}>
      {/* Glass walls */}
      <mesh ref={meshRef} onClick={onClick}>
        <boxGeometry args={size} />
        <meshPhysicalMaterial
          color="#FFFFFF"
          transparent
          opacity={isHovered ? 0.25 : 0.12}
          roughness={0.1}
          metalness={0.1}
          envMapIntensity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Neon edges */}
      <lineSegments ref={edgeRef}>
        <edgesGeometry args={[new THREE.BoxGeometry(...size)]} />
        <lineBasicMaterial color={isHovered ? color : '#FFFFFF'} transparent opacity={0.5} />
      </lineSegments>

      {/* Floor */}
      <mesh position={[0, -size[1] / 2 + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size[0], size[2]]} />
        <meshStandardMaterial
          color="#0a1628"
          transparent
          opacity={0.5}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Room label */}
      {isHovered && (
        <Html position={[0, size[1] / 2 + 0.15, 0]} center distanceFactor={6}>
          <div style={{
            fontFamily: "'Orbitron', monospace",
            fontSize: '11px',
            color,
            background: 'rgba(5, 8, 22, 0.9)',
            padding: '6px 14px',
            borderRadius: '8px',
            border: `1px solid ${color}40`,
            whiteSpace: 'nowrap',
            textShadow: `0 0 8px ${color}80`,
            backdropFilter: 'blur(8px)',
          }}>
            {name}
            {sqft && (
              <span style={{ fontSize: '9px', color: '#94A3B8', marginLeft: '8px' }}>
                {sqft}
              </span>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

// =============================================================================
// HOUSE SHELL — Roof, Foundation, Structural Elements
// =============================================================================

function HouseFoundation() {
  const loadLevel = useEnergyStore((s) => s.metrics.loadLevel);
  const loadColor = LOAD_LEVEL_COLORS[loadLevel];
  const glowRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.1 + Math.sin(timeRef.current * 2) * 0.05;
    }
  });

  const houseWidth = 7.5 * SCALE;
  const houseDepth = 7.0 * SCALE;

  return (
    <group>
      {/* Foundation Platform */}
      <mesh ref={glowRef} position={[0.5 * SCALE, -0.05, 0.5 * SCALE]}>
        <boxGeometry args={[houseWidth + 0.3, 0.1, houseDepth + 0.3]} />
        <meshStandardMaterial
          color={loadColor}
          metalness={0.5}
          roughness={0.5}
          transparent
          opacity={0.4}
          emissive={loadColor}
          emissiveIntensity={0.1}
        />
      </mesh>

      {/* Foundation edge glow */}
      <lineSegments position={[0.5 * SCALE, -0.05, 0.5 * SCALE]}>
        <edgesGeometry args={[new THREE.BoxGeometry(houseWidth + 0.3, 0.1, houseDepth + 0.3)]} />
        <lineBasicMaterial color={loadColor} transparent opacity={0.6} />
      </lineSegments>

      {/* Roof */}
      <mesh position={[0.5 * SCALE, 1.4 * SCALE + 0.4, 0.5 * SCALE]}>
        <coneGeometry args={[Math.max(houseWidth, houseDepth) / 1.5, 0.6, 4]} />
        <meshPhysicalMaterial
          color="#FFFFFF"
          transparent
          opacity={0.15}
          roughness={0.1}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Roof wireframe */}
      <lineSegments position={[0.5 * SCALE, 1.4 * SCALE + 0.4, 0.5 * SCALE]}>
        <edgesGeometry args={[new THREE.ConeGeometry(Math.max(houseWidth, houseDepth) / 1.5, 0.6, 4)]} />
        <lineBasicMaterial color="#FFFFFF" transparent opacity={0.6} />
      </lineSegments>

      {/* Corner pillars */}
      {[
        [-houseWidth / 2 + 0.5 * SCALE, -houseDepth / 2 + 0.5 * SCALE],
        [houseWidth / 2 + 0.5 * SCALE, -houseDepth / 2 + 0.5 * SCALE],
        [-houseWidth / 2 + 0.5 * SCALE, houseDepth / 2 + 0.5 * SCALE],
        [houseWidth / 2 + 0.5 * SCALE, houseDepth / 2 + 0.5 * SCALE],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 1.4 * SCALE / 2, z]}>
          <mesh>
            <cylinderGeometry args={[0.03, 0.03, 1.4 * SCALE, 8]} />
            <meshStandardMaterial color="#1a2744" metalness={0.6} roughness={0.2} />
          </mesh>
          <mesh position={[0, 1.4 * SCALE / 2, 0]}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshStandardMaterial color={loadColor} emissive={loadColor} emissiveIntensity={1} />
          </mesh>
        </group>
      ))}

      {/* Exterior ground area */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.5 * SCALE, -0.1, 0.5 * SCALE]}>
        <planeGeometry args={[houseWidth + 3, houseDepth + 3]} />
        <meshStandardMaterial color="#060e1a" metalness={0.9} roughness={0.1} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

// =============================================================================
// EXTERIOR AREA (EV Charger + Vehicle)
// =============================================================================

function ExteriorArea() {
  const evCharger = useEnergyStore((s) => s.evCharger);
  const devices = useEnergyStore((s) => s.devices);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
  });

  const isCharging = evCharger.state === 'charging';
  const isEvseConnected = evCharger.state !== 'disconnected';
  const evColor = isCharging ? '#00FF9D' : (isEvseConnected ? '#3B82F6' : '#64748B');

  const evVehicle = Object.values(devices).find((d) => d.type === 'ev_vehicle');
  const isVehicleActive = evVehicle?.powerState === 'on';
  const isVehicleDrawingPower = (evVehicle?.currentConsumption || 0) > 0;
  
  const isVehicleCharging = isEvseConnected && isVehicleActive && isVehicleDrawingPower;

  return (
    <group position={[-0.5 * SCALE, 0, 4.2 * SCALE]}>
      {/* EV Charger Station */}
      <group position={[-0.3, 0, 0]}>
        {/* Charger post */}
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[0.15, 0.5, 0.1]} />
          <meshStandardMaterial color="#1a2744" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Charger screen */}
        <mesh position={[0, 0.35, 0.055]}>
          <boxGeometry args={[0.1, 0.12, 0.01]} />
          <meshStandardMaterial
            color={isCharging ? '#111' : '#1a1a2a'}
            emissive={isCharging ? '#00FF9D' : '#333'}
            emissiveIntensity={isCharging ? 0.8 : 0.1}
          />
        </mesh>
        {/* Status LED */}
        <mesh position={[0, 0.45, 0.06]}>
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshStandardMaterial
            color={evColor}
            emissive={evColor}
            emissiveIntensity={isCharging ? 2 : 0.3}
          />
        </mesh>
        {isCharging && (
          <Sparkles
            count={12}
            scale={[0.3, 0.5, 0.3]}
            position={[0, 0.2, 0.1]}
            size={0.5}
            speed={0.5}
            color="#00FF9D"
            opacity={0.6}
          />
        )}

        {/* Label */}
        <Html position={[0, 0.6, 0]} center distanceFactor={6}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '9px',
            color: evColor,
            background: 'rgba(5, 8, 22, 0.85)',
            padding: '3px 8px',
            borderRadius: '4px',
            border: `1px solid ${evColor}40`,
            whiteSpace: 'nowrap',
          }}>
            EVSE • {isCharging ? `CHARGING • ${evCharger.batteryLevel.toFixed(0)}%` : (isEvseConnected ? 'STANDBY' : 'DISCONNECTED')}
          </div>
        </Html>
      </group>

      {/* Electric Vehicle */}
      <group position={[0.5, 0, 0]}>
        {/* Car body - Metallic Red */}
        <mesh position={[0, 0.12, 0]}>
          <boxGeometry args={[0.6, 0.12, 0.3]} />
          <meshStandardMaterial color="#DC2626" metalness={0.7} roughness={0.2} />
        </mesh>
        {/* Cabin */}
        <mesh position={[0, 0.22, 0]}>
          <boxGeometry args={[0.35, 0.1, 0.25]} />
          <meshStandardMaterial color="#1f2937" metalness={0.6} roughness={0.2} transparent opacity={0.75} />
        </mesh>
        {/* Wheels */}
        {[
          [-0.22, 0.04, 0.16], [-0.22, 0.04, -0.16],
          [0.22, 0.04, 0.16], [0.22, 0.04, -0.16],
        ].map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.03, 12]} />
            <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
          </mesh>
        ))}
        {/* Charging cable (connecting to charger) */}
        {evCharger.state !== 'disconnected' && (
          <mesh position={[-0.5, 0.15, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.4, 8]} />
            <meshStandardMaterial color={isCharging ? '#00FF9D' : '#555'} />
          </mesh>
        )}

        {/* Minute Vehicle Charging Status Badge */}
        <Html position={[0, 0.38, 0]} center distanceFactor={6}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '9px',
            fontWeight: 600,
            color: isVehicleCharging ? '#00FF9D' : '#94A3B8',
            background: isVehicleCharging ? 'rgba(5, 20, 15, 0.9)' : 'rgba(15, 23, 42, 0.85)',
            padding: '2px 7px',
            borderRadius: '4px',
            border: `1px solid ${isVehicleCharging ? 'rgba(0, 255, 157, 0.5)' : 'rgba(148, 163, 184, 0.2)'}`,
            boxShadow: isVehicleCharging ? '0 0 10px rgba(0, 255, 157, 0.3)' : 'none',
            whiteSpace: 'nowrap',
            letterSpacing: '0.5px',
            pointerEvents: 'none',
            transition: 'all 0.3s ease',
          }}>
            {isVehicleCharging ? `⚡ CHARGING • ${evCharger.batteryLevel.toFixed(0)}%` : (isVehicleActive ? 'EV • ACTIVE' : 'IDLE')}
          </div>
        </Html>
      </group>
    </group>
  );
}

// =============================================================================
// MAIN FLOOR PLAN HOUSE COMPONENT
// =============================================================================

interface FloorPlanHouseProps {
  hoveredRoom: string | null;
  onRoomClick: (roomId: string | null) => void;
}

export default function FloorPlanHouse({ hoveredRoom, onRoomClick }: FloorPlanHouseProps) {
  return (
    <group>
      {/* House foundation, roof, and structural elements */}
      <HouseFoundation />

      {/* Rooms */}
      {Object.entries(ROOMS).map(([id, room]) => (
        <RoomBox
          key={id}
          name={room.name}
          position={room.position}
          size={room.size}
          color={room.color}
          sqft={room.sqft}
          isHovered={hoveredRoom === id}
          onClick={() => onRoomClick(hoveredRoom === id ? null : id)}
        />
      ))}

      {/* Exterior area with EV charger */}
      <ExteriorArea />

      {/* Exterior decoration — plants */}
      {[
        [-2.8 * SCALE, 0.08, -3.0 * SCALE],
        [-2.8 * SCALE, 0.08, 3.0 * SCALE],
        [4.5 * SCALE, 0.08, 3.2 * SCALE],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <coneGeometry args={[0.08, 0.15, 6]} />
          <meshStandardMaterial color="#0a4a2a" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/** Export room definitions for use in device placement */
export { ROOMS, SCALE };
