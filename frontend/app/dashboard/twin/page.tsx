'use client';

/**
 * RNTBCI Smart Home Digital Twin — 3D Immersive Scene
 *
 * Explorable 3D house with procedural device models, glass walls,
 * dynamic lighting, particles, and device interaction HUD.
 */

import { Suspense, useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import {
  OrbitControls, Stars, Float, Html, ContactShadows,
  Environment, MeshTransmissionMaterial, Sparkles,
} from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';
import api from '@/services/api';
import { useDeviceStore, type Device, type Room } from '@/store';

export function CanvasCleanup() {
  const { gl } = useThree();
  useEffect(() => {
    return () => {
      gl.dispose();
      const context = gl.getContext();
      const ext = context.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    };
  }, [gl]);
  return null;
}

// =============================================================================
// HOUSE SHELL COMPONENT — Roof, Foundation, and Structural Elements
// =============================================================================

function HouseShell({ rooms }: { rooms: Room[] }) {
  if (!rooms.length) return null;

  // Calculate bounding box of all rooms to size the house shell
  const scale = 0.5;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = 0;

  rooms.forEach(r => {
    const halfW = r.width / 2;
    const halfD = r.depth / 2;
    minX = Math.min(minX, r.position_x - halfW);
    maxX = Math.max(maxX, r.position_x + halfW);
    minZ = Math.min(minZ, r.position_z - halfD);
    maxZ = Math.max(maxZ, r.position_z + halfD);
    maxY = Math.max(maxY, r.height);
  });

  const width = (maxX - minX) * scale + 1; // Add padding
  const depth = (maxZ - minZ) * scale + 1;
  const height = maxY * scale;
  const centerX = (minX + maxX) * scale / 2;
  const centerZ = (minZ + maxZ) * scale / 2;

  const roofHeight = 1.5;

  return (
    <group position={[centerX, 0, centerZ]}>
      {/* Foundation Platform */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[width + 0.5, 0.2, depth + 0.5]} />
        <meshStandardMaterial color="#FFFFFF" metalness={0.5} roughness={0.5} transparent opacity={0.6} />
      </mesh>

      {/* Outer Foundation Trim */}
      <lineSegments position={[0, -0.1, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(width + 0.5, 0.2, depth + 0.5)]} />
        <lineBasicMaterial color="#FFFFFF" transparent opacity={0.8} />
      </lineSegments>

      {/* Holographic Roof */}
      <mesh position={[0, height + roofHeight / 2, 0]}>
        <coneGeometry args={[Math.max(width, depth) / 1.5, roofHeight, 4]} />
        <meshPhysicalMaterial 
          color="#FFFFFF" 
          transparent opacity={0.25} 
          roughness={0.1} metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Roof Wireframe */}
      <lineSegments position={[0, height + roofHeight / 2, 0]}>
        <edgesGeometry args={[new THREE.ConeGeometry(Math.max(width, depth) / 1.5, roofHeight, 4)]} />
        <lineBasicMaterial color="#FFFFFF" transparent opacity={0.8} />
      </lineSegments>

      {/* Corner Structural Pillars */}
      {[
        [-width/2, -depth/2], [width/2, -depth/2], 
        [-width/2, depth/2], [width/2, depth/2]
      ].map(([x, z], i) => (
        <group key={i} position={[x, height/2, z]}>
          <mesh>
            <cylinderGeometry args={[0.05, 0.05, height, 8]} />
            <meshStandardMaterial color="#1a2744" metalness={0.6} roughness={0.2} />
          </mesh>
          <mesh position={[0, height/2, 0]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial color="#00E5FF" emissive="#00E5FF" emissiveIntensity={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// =============================================================================
// ROOM COMPONENT — Glass wall enclosure
// =============================================================================

function RoomMesh({ room, isHovered, onClick }: {
  room: Room; isHovered: boolean; onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const edgeRef = useRef<THREE.LineSegments>(null);

  const scale = 0.5; // World scale factor
  const pos: [number, number, number] = [
    room.position_x * scale,
    room.height * scale * 0.5,
    room.position_z * scale,
  ];
  const size: [number, number, number] = [
    room.width * scale,
    room.height * scale,
    room.depth * scale,
  ];

  useFrame(() => {
    if (edgeRef.current) {
      const mat = edgeRef.current.material as THREE.LineBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, isHovered ? 0.9 : 0.3, 0.05);
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
          opacity={isHovered ? 0.3 : 0.15}
          roughness={0.1}
          metalness={0.1}
          envMapIntensity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Neon edges */}
      <lineSegments ref={edgeRef}>
        <edgesGeometry args={[new THREE.BoxGeometry(...size)]} />
        <lineBasicMaterial
          color={isHovered ? '#00E5FF' : '#FFFFFF'}
          transparent
          opacity={0.5}
        />
      </lineSegments>

      {/* Floor */}
      <mesh position={[0, -size[1] / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size[0], size[2]]} />
        <meshStandardMaterial
          color="#0a1628"
          transparent
          opacity={0.4}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Room label */}
      {isHovered && (
        <Html position={[0, size[1] / 2 + 0.3, 0]} center distanceFactor={6}>
          <div style={{
            fontFamily: "'Orbitron', monospace",
            fontSize: '11px',
            color: '#00E5FF',
            background: 'rgba(5, 8, 22, 0.85)',
            padding: '4px 12px',
            borderRadius: '6px',
            border: '1px solid rgba(0, 229, 255, 0.3)',
            whiteSpace: 'nowrap',
            textShadow: '0 0 8px rgba(0, 229, 255, 0.5)',
          }}>
            {room.name}
          </div>
        </Html>
      )}
    </group>
  );
}

// =============================================================================
// DEVICE 3D MODEL — Procedural appliance representations
// =============================================================================

function DeviceModel({ device, isSelected, onClick }: {
  device: Device; isSelected: boolean; onClick: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const isOn = device.power_state === 'on';
  const scale = 0.5;

  const pos: [number, number, number] = [
    device.position_x * scale,
    device.position_y * scale + 0.15,
    device.position_z * scale,
  ];

  const deviceColor = useMemo(() => {
    const colors: Record<string, string> = {
      hvac: '#00B4D8', refrigerator: '#22D3EE', smart_tv: '#EC4899',
      smart_light: '#FFC857', door_lock: '#3B82F6', garage_door: '#6366F1',
      washing_machine: '#06B6D4', dishwasher: '#14B8A6', water_heater: '#F97316',
      nebulizer: '#A78BFA', router: '#10B981', camera: '#EF4444',
      smart_switch: '#94A3B8', smart_plug: '#8B5CF6',
    };
    return colors[device.type] || '#00E5FF';
  }, [device.type]);

  // Animate glow
  const timeRef = useRef(0);
  useFrame((state, delta) => {
    timeRef.current += delta;
    if (glowRef.current && isOn) {
      const pulse = Math.sin(timeRef.current * 2) * 0.15 + 0.85;
      glowRef.current.scale.setScalar(pulse);
    }
    if (groupRef.current && isSelected) {
      groupRef.current.position.y = pos[1] + Math.sin(timeRef.current * 3) * 0.03;
    }
  });

  const getDeviceGeometry = () => {
    switch (device.type) {
      case 'hvac':
        return (
          <group>
            <mesh position={[0, 0.2, 0]}>
              <boxGeometry args={[0.5, 0.15, 0.22]} />
              <meshStandardMaterial color="#1a2744" metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Fan grill */}
            <mesh position={[0, 0.2, 0.12]}>
              <planeGeometry args={[0.45, 0.03]} />
              <meshStandardMaterial color={isOn ? deviceColor : '#333'} emissive={isOn ? deviceColor : '#000'} emissiveIntensity={isOn ? 0.5 : 0} />
            </mesh>
            {/* Air particles */}
            {isOn && <Sparkles count={15} scale={[0.5, 0.3, 0.5]} position={[0, 0.05, 0.2]} size={0.5} speed={0.3} color={deviceColor} opacity={0.4} />}
          </group>
        );
      case 'refrigerator':
        return (
          <group>
            <mesh position={[0, 0.35, 0]}>
              <boxGeometry args={[0.3, 0.7, 0.3]} />
              <meshStandardMaterial color="#2a3142" metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Handle */}
            <mesh position={[0.16, 0.35, 0.01]}>
              <boxGeometry args={[0.015, 0.25, 0.02]} />
              <meshStandardMaterial color="#888" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Door line */}
            <mesh position={[0, 0.35, 0.151]}>
              <planeGeometry args={[0.28, 0.01]} />
              <meshStandardMaterial color="#555" />
            </mesh>
            {/* Internal glow */}
            {isOn && (
              <pointLight position={[0, 0.3, 0.1]} intensity={0.15} color="#00E5FF" distance={0.5} />
            )}
          </group>
        );
      case 'smart_tv':
        return (
          <group>
            {/* Screen */}
            <mesh position={[0, 0.3, 0]}>
              <boxGeometry args={[0.6, 0.35, 0.02]} />
              <meshStandardMaterial
                color={isOn ? '#111' : '#1a1a2a'}
                emissive={isOn ? '#1a1a4a' : '#000'}
                emissiveIntensity={isOn ? 0.3 : 0}
                metalness={0.8}
                roughness={0.1}
              />
            </mesh>
            {/* Screen glow */}
            {isOn && (
              <>
                <mesh position={[0, 0.3, 0.015]}>
                  <planeGeometry args={[0.56, 0.31]} />
                  <meshStandardMaterial
                    color="#0a0a2e"
                    emissive="#3B82F6"
                    emissiveIntensity={0.4}
                    transparent opacity={0.8}
                  />
                </mesh>
                <pointLight position={[0, 0.3, 0.3]} intensity={0.3} color="#3B82F6" distance={1.5} />
              </>
            )}
            {/* Stand */}
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.15, 0.15, 0.02, 16]} />
              <meshStandardMaterial color="#333" metalness={0.7} roughness={0.2} />
            </mesh>
          </group>
        );
      case 'smart_light':
        return (
          <group>
            <mesh position={[0, 0.5, 0]}>
              <sphereGeometry args={[0.08, 16, 16]} />
              <meshStandardMaterial
                color={isOn ? '#FFF' : '#555'}
                emissive={isOn ? deviceColor : '#000'}
                emissiveIntensity={isOn ? 2 : 0}
                transparent
                opacity={isOn ? 0.9 : 0.5}
              />
            </mesh>
            {isOn && <pointLight position={[0, 0.5, 0]} intensity={0.5} color={deviceColor} distance={2} decay={2} />}
          </group>
        );
      case 'door_lock':
        return (
          <group>
            <mesh position={[0, 0.15, 0]}>
              <boxGeometry args={[0.08, 0.12, 0.04]} />
              <meshStandardMaterial color="#2a3142" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Indicator */}
            <mesh position={[0, 0.12, 0.025]}>
              <circleGeometry args={[0.015, 16]} />
              <meshStandardMaterial
                color={isOn ? '#00FF9D' : '#FF4D6D'}
                emissive={isOn ? '#00FF9D' : '#FF4D6D'}
                emissiveIntensity={1}
              />
            </mesh>
          </group>
        );
      case 'router':
        return (
          <group>
            <mesh position={[0, 0.12, 0]}>
              <boxGeometry args={[0.15, 0.03, 0.12]} />
              <meshStandardMaterial color="#1a2744" metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Antennas */}
            {[-0.05, 0.05].map((x, i) => (
              <mesh key={i} position={[x, 0.2, -0.04]}>
                <cylinderGeometry args={[0.005, 0.005, 0.12, 8]} />
                <meshStandardMaterial color="#555" metalness={0.8} />
              </mesh>
            ))}
            {/* Signal waves */}
            {isOn && <Sparkles count={10} scale={[0.3, 0.3, 0.3]} position={[0, 0.25, 0]} size={0.3} speed={0.5} color="#10B981" opacity={0.3} />}
          </group>
        );
      case 'camera':
        return (
          <group>
            <mesh position={[0, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.04, 0.05, 0.06, 16]} />
              <meshStandardMaterial color="#2a3142" metalness={0.7} roughness={0.2} />
            </mesh>
            {/* Lens */}
            <mesh position={[0, 0.35, 0.04]}>
              <circleGeometry args={[0.025, 16]} />
              <meshStandardMaterial
                color={isOn ? '#111' : '#333'}
                emissive={isOn ? '#EF4444' : '#000'}
                emissiveIntensity={isOn ? 1 : 0}
              />
            </mesh>
          </group>
        );
      case 'garage_door':
        return (
          <group>
            <mesh position={[0, 0.4, 0]}>
              <boxGeometry args={[0.8, 0.7, 0.05]} />
              <meshStandardMaterial color="#2a3142" metalness={0.5} roughness={0.4} />
            </mesh>
            {/* Horizontal lines */}
            {[0.15, 0.3, 0.45, 0.6].map((y, i) => (
              <mesh key={i} position={[0, y, 0.026]}>
                <planeGeometry args={[0.78, 0.005]} />
                <meshStandardMaterial color="#444" />
              </mesh>
            ))}
          </group>
        );
      case 'water_heater':
        return (
          <group>
            <mesh position={[0, 0.3, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.5, 16]} />
              <meshStandardMaterial color="#F8F8F8" metalness={0.4} roughness={0.3} />
            </mesh>
            {isOn && (
              <pointLight position={[0, 0.15, 0.15]} intensity={0.2} color="#F97316" distance={0.8} />
            )}
          </group>
        );
      case 'washing_machine':
        return (
          <group>
            <mesh position={[0, 0.22, 0]}>
              <boxGeometry args={[0.28, 0.38, 0.28]} />
              <meshStandardMaterial color="#E8E8E8" metalness={0.3} roughness={0.4} />
            </mesh>
            {/* Door */}
            <mesh position={[0, 0.22, 0.141]}>
              <circleGeometry args={[0.1, 24]} />
              <meshStandardMaterial color="#333" metalness={0.8} roughness={0.1} transparent opacity={0.6} />
            </mesh>
          </group>
        );
      case 'nebulizer':
        return (
          <group>
            <mesh position={[0, 0.1, 0]}>
              <cylinderGeometry args={[0.06, 0.08, 0.15, 16]} />
              <meshStandardMaterial color="#E8E8F0" metalness={0.3} roughness={0.4} />
            </mesh>
            {isOn && <Sparkles count={20} scale={[0.2, 0.4, 0.2]} position={[0, 0.25, 0]} size={0.4} speed={0.2} color="#A78BFA" opacity={0.5} />}
          </group>
        );
      default:
        return (
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[0.15, 0.1, 0.1]} />
            <meshStandardMaterial color="#2a3142" metalness={0.5} roughness={0.4} />
          </mesh>
        );
    }
  };

  return (
    <group ref={groupRef} position={pos} onClick={onClick}>
      {getDeviceGeometry()}

      {/* Selection ring */}
      {isSelected && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.25, 0.28, 32]} />
          <meshStandardMaterial color={deviceColor} emissive={deviceColor} emissiveIntensity={2} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Hover glow */}
      <mesh ref={glowRef} position={[0, 0.15, 0]} visible={isOn}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial color={deviceColor} transparent opacity={0.04} />
      </mesh>

      {/* HUD label on select */}
      {isSelected && (
        <Html position={[0, 0.8, 0]} center distanceFactor={5}>
          <DeviceHUD device={device} color={deviceColor} />
        </Html>
      )}
    </group>
  );
}

// =============================================================================
// DEVICE HUD (Iron Man style overlay)
// =============================================================================

function DeviceHUD({ device, color }: { device: Device; color: string }) {
  const [toggling, setToggling] = useState(false);
  const meta = device.metadata || {};
  const isOn = device.power_state === 'on';

  const handlePowerToggle = async () => {
    setToggling(true);
    try {
      const newState = isOn ? 'off' : 'on';
      const updatedDevice = await api.togglePower(device.id, newState) as Partial<Device>;
      useDeviceStore.getState().updateDevice(device.id, updatedDevice);
    } catch { /* Ignore */ }
    setToggling(false);
  };

  return (
    <div className="hud-panel" style={{
      width: '240px', padding: '16px',
      pointerEvents: 'auto', cursor: 'default',
      animation: 'fadeIn 0.3s ease-out',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontFamily: "'Orbitron', monospace", fontSize: '12px', fontWeight: 700, color }}>
          {device.name}
        </span>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: isOn ? '#00FF9D' : '#64748B',
          boxShadow: isOn ? '0 0 8px rgba(0, 255, 157, 0.5)' : 'none',
        }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>
        <div>
          <div style={{ color: '#64748B' }}>POWER</div>
          <div style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '14px' }}>
            {isOn ? `${(device.energy_usage_kw * 1000).toFixed(0)}W` : 'OFF'}
          </div>
        </div>
        <div>
          <div style={{ color: '#64748B' }}>STATUS</div>
          <div style={{ color: isOn ? '#00FF9D' : '#FF4D6D', fontWeight: 600 }}>
            {device.status.toUpperCase()}
          </div>
        </div>

        {meta.temperature !== undefined && (
          <div>
            <div style={{ color: '#64748B' }}>TEMP</div>
            <div style={{ color: '#00E5FF', fontWeight: 600 }}>
              {(meta.temperature as number).toFixed(1)}°C
            </div>
          </div>
        )}
        {meta.brightness !== undefined && (
          <div>
            <div style={{ color: '#64748B' }}>BRIGHT</div>
            <div style={{ color: '#FFC857', fontWeight: 600 }}>{meta.brightness as number}%</div>
          </div>
        )}
        {meta.download_speed !== undefined && (
          <div>
            <div style={{ color: '#64748B' }}>SPEED</div>
            <div style={{ color: '#10B981', fontWeight: 600 }}>↓{meta.download_speed as number} Mbps</div>
          </div>
        )}
      </div>

      <div style={{
        marginTop: '10px', padding: '6px 8px', borderRadius: '4px',
        background: 'rgba(0, 229, 255, 0.05)',
        fontSize: '9px', color: '#64748B', fontFamily: "'JetBrains Mono', monospace",
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <span>EFF: {device.efficiency_percent?.toFixed(0) || 90}% • {device.type.replace(/_/g, ' ').toUpperCase()}</span>
        <button
          onClick={handlePowerToggle}
          disabled={toggling}
          style={{
            background: isOn ? 'rgba(0, 255, 157, 0.2)' : 'rgba(255, 77, 109, 0.2)',
            border: `1px solid ${isOn ? '#00FF9D' : '#FF4D6D'}`,
            color: isOn ? '#00FF9D' : '#FF4D6D',
            padding: '2px 8px', borderRadius: '4px', cursor: 'pointer',
            fontSize: '9px', fontWeight: 'bold', fontFamily: "'Orbitron', monospace",
            opacity: toggling ? 0.5 : 1, transition: 'all 0.2s',
          }}
        >
          {isOn ? 'TURN OFF' : 'TURN ON'}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN 3D SCENE
// =============================================================================

export function DigitalTwinScene() {
  const devices = useDeviceStore((s) => s.devices);
  const rooms = useDeviceStore((s) => s.rooms);
  const selectedDevice = useDeviceStore((s) => s.selectedDevice);
  const selectDevice = useDeviceStore((s) => s.selectDevice);
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);

  // Fallback data
  const displayRooms = rooms.length > 0 ? rooms : [
    { id: '1', name: 'Living Room', type: 'living_room', floor: 0, position_x: 0, position_y: 0, position_z: 0, width: 6, depth: 5, height: 3 },
    { id: '2', name: 'Kitchen', type: 'kitchen', floor: 0, position_x: 6.5, position_y: 0, position_z: 0, width: 4, depth: 4, height: 3 },
    { id: '3', name: 'Master Bedroom', type: 'master_bedroom', floor: 0, position_x: 0, position_y: 0, position_z: 5.5, width: 5, depth: 4.5, height: 3 },
    { id: '4', name: 'Garage', type: 'garage', floor: 0, position_x: -5.5, position_y: 0, position_z: 0, width: 5, depth: 5.5, height: 3.5 },
    { id: '5', name: 'Hallway', type: 'hallway', floor: 0, position_x: 3, position_y: 0, position_z: 2.5, width: 1.5, depth: 6, height: 3 },
  ] as Room[];

  const displayDevices = devices.length > 0 ? devices : [
    { id: '00000000-0000-0000-0000-000000000001', name: 'Living Room AC', type: 'hvac', status: 'online', power_state: 'on', energy_usage_kw: 2.1, efficiency_percent: 94, metadata: { temperature: 23.5, target_temperature: 22 }, position_x: 0.5, position_y: 2.5, position_z: 0, room_id: '1', connectivity: 'connected', last_updated: '' },
    { id: '00000000-0000-0000-0000-000000000002', name: 'Smart TV', type: 'smart_tv', status: 'online', power_state: 'on', energy_usage_kw: 0.12, efficiency_percent: 88, metadata: { volume: 35 }, position_x: 3, position_y: 0.1, position_z: 1.2, room_id: '1', connectivity: 'connected', last_updated: '' },
    { id: '00000000-0000-0000-0000-000000000003', name: 'Refrigerator', type: 'refrigerator', status: 'online', power_state: 'on', energy_usage_kw: 0.08, efficiency_percent: 91, metadata: { temperature: 3.8 }, position_x: 9.5, position_y: 0.3, position_z: 0, room_id: '2', connectivity: 'connected', last_updated: '' },
    { id: '00000000-0000-0000-0000-000000000004', name: 'Living Light', type: 'smart_light', status: 'online', power_state: 'on', energy_usage_kw: 0.012, efficiency_percent: 95, metadata: { brightness: 85 }, position_x: 1, position_y: 2.8, position_z: 1, room_id: '1', connectivity: 'connected', last_updated: '' },
    { id: '00000000-0000-0000-0000-000000000005', name: 'Router', type: 'router', status: 'online', power_state: 'on', energy_usage_kw: 0.012, efficiency_percent: 97, metadata: { download_speed: 95, connected_clients: 8 }, position_x: 3.5, position_y: 2, position_z: 2.5, room_id: '5', connectivity: 'connected', last_updated: '' },
    { id: '00000000-0000-0000-0000-000000000006', name: 'Garage Door', type: 'garage_door', status: 'online', power_state: 'on', energy_usage_kw: 0.005, efficiency_percent: 90, metadata: { position: 'closed' }, position_x: -5.5, position_y: 0, position_z: 2.5, room_id: '4', connectivity: 'connected', last_updated: '' },
    { id: '00000000-0000-0000-0000-000000000007', name: 'Door Lock', type: 'door_lock', status: 'online', power_state: 'on', energy_usage_kw: 0.003, efficiency_percent: 99, metadata: { lock_state: 'locked' }, position_x: 3, position_y: 1, position_z: 0, room_id: '5', connectivity: 'connected', last_updated: '' },
    { id: '00000000-0000-0000-0000-000000000008', name: 'Security Camera', type: 'camera', status: 'online', power_state: 'on', energy_usage_kw: 0.015, efficiency_percent: 96, metadata: { recording: true }, position_x: -3, position_y: 2.5, position_z: 0, room_id: '4', connectivity: 'connected', last_updated: '' },
  ] as unknown as Device[];

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 8, 0]} intensity={0.4} color="#00E5FF" distance={20} />
      <pointLight position={[5, 5, 5]} intensity={0.2} color="#3B82F6" />
      <pointLight position={[-5, 5, -3]} intensity={0.15} color="#6366F1" />
      <directionalLight position={[5, 10, 5]} intensity={0.3} color="#FFF" />

      {/* Environment */}
      <Stars radius={80} depth={60} count={3000} factor={4} saturation={0} fade speed={0.3} />
      <fog attach="fog" args={['#050816', 10, 40]} />

      {/* Ground grid */}
      <gridHelper args={[30, 60, '#0a2a3a', '#071520']} position={[0, 0, 2]} />

      {/* Ground plane (reflective) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 2]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#050816" metalness={0.9} roughness={0.1} transparent opacity={0.8} />
      </mesh>

      {/* House Shell (Roof & Foundation) */}
      <HouseShell rooms={displayRooms} />

      {/* Rooms */}
      {displayRooms.map((room) => (
        <RoomMesh
          key={room.id}
          room={room}
          isHovered={hoveredRoom === room.id}
          onClick={() => setHoveredRoom(hoveredRoom === room.id ? null : room.id)}
        />
      ))}

      {/* Devices */}
      {displayDevices.map((device) => (
        <DeviceModel
          key={device.id}
          device={device}
          isSelected={selectedDevice?.id === device.id}
          onClick={() => selectDevice(selectedDevice?.id === device.id ? null : device)}
        />
      ))}

      {/* Contact shadows */}
      <ContactShadows
        position={[0, 0, 2]}
        opacity={0.3}
        scale={20}
        blur={2}
        far={10}
        color="#000"
      />

      {/* Post-processing */}
      <EffectComposer>
        <Bloom intensity={0.8} luminanceThreshold={0.3} luminanceSmoothing={0.9} />
        <Vignette eskil={false} offset={0.2} darkness={0.6} />
      </EffectComposer>

      {/* Controls */}
      <OrbitControls
        makeDefault
        minDistance={3}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2.1}
        enableDamping
        dampingFactor={0.05}
        target={[1, 0.5, 2]}
      />
    </>
  );
}

// =============================================================================
// PAGE WRAPPER
// =============================================================================

export default function DigitalTwinPage() {
  const selectedDevice = useDeviceStore((s) => s.selectedDevice);

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - var(--topbar-height) - 140px)', borderRadius: '12px', overflow: 'hidden' }}>
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [8, 6, 8], fov: 45 }}
        gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
        dpr={[1, 2]}
        style={{ background: '#050816' }}
      >
        <CanvasCleanup />
        <Suspense fallback={null}>
          <DigitalTwinScene />
        </Suspense>
      </Canvas>

      {/* Overlay controls */}
      <div style={{
        position: 'absolute', top: '16px', left: '16px',
        display: 'flex', gap: '8px', zIndex: 10,
      }}>
        <div style={{
          fontFamily: "'Orbitron', monospace", fontSize: '11px',
          color: '#00E5FF', padding: '8px 14px', borderRadius: '8px',
          background: 'rgba(5, 8, 22, 0.85)', border: '1px solid rgba(0, 229, 255, 0.2)',
          backdropFilter: 'blur(8px)',
        }}>
          3D DIGITAL TWIN
        </div>
      </div>

      {/* Camera controls hint */}
      <div style={{
        position: 'absolute', bottom: '12px', right: '16px',
        fontFamily: "'JetBrains Mono', monospace", fontSize: '10px',
        color: '#64748B', padding: '6px 10px', borderRadius: '6px',
        background: 'rgba(5, 8, 22, 0.7)',
      }}>
        🖱️ Orbit • Scroll Zoom • Click Device for HUD
      </div>
    </div>
  );
}
