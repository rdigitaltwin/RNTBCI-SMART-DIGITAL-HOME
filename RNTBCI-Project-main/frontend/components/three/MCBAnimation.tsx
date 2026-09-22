'use client';

/**
 * RNTBCI Smart Home Digital Twin — MCB 3D Animation
 *
 * 3D Miniature Circuit Breaker visualization with:
 * - Animated breaker lever (ON → TRIPPED → OFF)
 * - Color-coded state indication
 * - Overload warning overlay in 3D scene
 * - Load gauge visualization
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useEnergyStore, type MCBState } from '@/store/energyEngine';
import { formatPower } from '@/lib/applianceDatabase';
import { LOAD_LEVEL_COLORS } from '@/lib/homeCapacity';

// =============================================================================
// MCB STATE COLORS
// =============================================================================

const MCB_COLORS: Record<MCBState, string> = {
  on: '#00FF9D',
  tripped: '#FF4D6D',
  off: '#64748B',
};

// =============================================================================
// MCB 3D MODEL
// =============================================================================

interface MCBAnimationProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  visible?: boolean;
}

export default function MCBAnimation({
  position = [-3.5, 0.5, -3.5],
  rotation = [0, 0, 0],
  visible = true,
}: MCBAnimationProps) {
  const mcb = useEnergyStore((s) => s.mcb);
  const metrics = useEnergyStore((s) => s.metrics);
  const resetMCB = useEnergyStore((s) => s.resetMCB);
  const turnOffOverloadedDevices = useEnergyStore((s) => s.turnOffOverloadedDevices);

  const leverRef = useRef<THREE.Group>(null);
  const warningLightRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  // Target lever angle based on state
  const targetAngle = useMemo(() => {
    switch (mcb.state) {
      case 'on': return 0;
      case 'tripped': return Math.PI / 4;
      case 'off': return Math.PI / 2;
    }
  }, [mcb.state]);

  const currentAngle = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;

    // Animate lever rotation
    if (leverRef.current) {
      currentAngle.current = THREE.MathUtils.lerp(currentAngle.current, targetAngle, 0.06);
      leverRef.current.rotation.x = -currentAngle.current;
    }

    // Pulse warning light when tripped
    if (warningLightRef.current && mcb.state === 'tripped') {
      const mat = warningLightRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.5 + Math.sin(timeRef.current * 6) * 1.0;
    }
  });

  if (!visible) return null;

  const stateColor = MCB_COLORS[mcb.state];
  const loadColor = LOAD_LEVEL_COLORS[metrics.loadLevel];

  return (
    <group position={position} rotation={rotation}>
      {/* Wall Mounting Plate */}
      <mesh position={[0, 0, -0.055]}>
        <boxGeometry args={[0.26, 0.42, 0.015]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* MCB Housing */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.2, 0.35, 0.1]} />
        <meshStandardMaterial color="#1a2235" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* MCB Face plate */}
      <mesh position={[0, 0, 0.051]}>
        <boxGeometry args={[0.17, 0.32, 0.005]} />
        <meshStandardMaterial color="#252d42" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Lever pivot & handle */}
      <group ref={leverRef} position={[0, 0.05, 0.06]}>
        {/* Lever arm */}
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.06, 0.12, 0.03]} />
          <meshStandardMaterial
            color={stateColor}
            emissive={stateColor}
            emissiveIntensity={mcb.state === 'tripped' ? 0.8 : 0.2}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
        {/* Lever knob */}
        <mesh position={[0, 0.12, 0]}>
          <boxGeometry args={[0.05, 0.025, 0.035]} />
          <meshStandardMaterial color="#F8F8F8" metalness={0.8} roughness={0.1} />
        </mesh>
      </group>

      {/* Warning light */}
      <mesh
        ref={warningLightRef}
        position={[0, -0.1, 0.055]}
      >
        <circleGeometry args={[0.025, 16]} />
        <meshStandardMaterial
          color={stateColor}
          emissive={stateColor}
          emissiveIntensity={mcb.state === 'tripped' ? 2 : 0.5}
        />
      </mesh>

      {/* Load gauge bar */}
      <group position={[0, -0.15, 0.055]}>
        {/* Background */}
        <mesh>
          <planeGeometry args={[0.14, 0.015]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        {/* Fill */}
        <mesh position={[-(0.14 - 0.14 * Math.min(metrics.loadPercentage / 100, 1)) / 2, 0, 0.001]}>
          <planeGeometry args={[0.14 * Math.min(metrics.loadPercentage / 100, 1), 0.015]} />
          <meshStandardMaterial
            color={loadColor}
            emissive={loadColor}
            emissiveIntensity={0.5}
          />
        </mesh>
      </group>

      {/* State label */}
      <Html position={[0, 0.25, 0]} center distanceFactor={6}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '9px',
          color: stateColor,
          background: 'rgba(5, 8, 22, 0.9)',
          padding: '3px 8px',
          borderRadius: '4px',
          border: `1px solid ${stateColor}40`,
          whiteSpace: 'nowrap',
          textShadow: `0 0 6px ${stateColor}60`,
        }}>
          MCB • {mcb.state.toUpperCase()}
        </div>
      </Html>

      {/* OVERLOAD WARNING PANEL (only when tripped) */}
      {mcb.state === 'tripped' && (
        <Html position={[0, 0.6, 0]} center distanceFactor={4}>
          <div style={{
            width: '300px',
            padding: '16px',
            background: 'linear-gradient(135deg, rgba(30, 5, 10, 0.95), rgba(50, 10, 20, 0.9))',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 77, 109, 0.4)',
            borderRadius: '16px',
            boxShadow: '0 0 40px rgba(255, 77, 109, 0.2)',
            pointerEvents: 'auto',
            cursor: 'default',
            animation: 'fadeIn 0.3s ease-out',
          }}>
            {/* Title */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              paddingBottom: '10px',
              borderBottom: '1px solid rgba(255, 77, 109, 0.2)',
            }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <div>
                <div style={{
                  fontFamily: "'Orbitron', monospace",
                  fontSize: '13px',
                  fontWeight: 800,
                  color: '#FF4D6D',
                  letterSpacing: '0.1em',
                }}>
                  OVERLOAD DETECTED
                </div>
                <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                  MCB has tripped — power cut
                </div>
              </div>
            </div>

            {/* Info grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              marginBottom: '12px',
            }}>
              <div>
                <div style={{ color: '#64748B' }}>CAPACITY</div>
                <div style={{ color: '#F8FAFC', fontWeight: 600 }}>
                  {formatPower(mcb.configuredCapacity)}
                </div>
              </div>
              <div>
                <div style={{ color: '#64748B' }}>LOAD AT TRIP</div>
                <div style={{ color: '#FF4D6D', fontWeight: 600 }}>
                  {formatPower(mcb.loadAtTrip)}
                </div>
              </div>
              <div>
                <div style={{ color: '#64748B' }}>EXCEEDED BY</div>
                <div style={{ color: '#FF4D6D', fontWeight: 600 }}>
                  +{formatPower(mcb.exceededBy)}
                </div>
              </div>
              <div>
                <div style={{ color: '#64748B' }}>TRIP TIME</div>
                <div style={{ color: '#FFC857', fontWeight: 600 }}>
                  {mcb.tripTime ? new Date(mcb.tripTime).toLocaleTimeString() : '—'}
                </div>
              </div>
            </div>

            {/* Cause */}
            {mcb.tripCause && (
              <div style={{
                fontSize: '9px',
                color: '#FF8C8C',
                background: 'rgba(255, 77, 109, 0.1)',
                padding: '6px 8px',
                borderRadius: '6px',
                marginBottom: '12px',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {mcb.tripCause}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  turnOffOverloadedDevices();
                  setTimeout(() => resetMCB(), 500);
                }}
                style={{
                  background: 'rgba(0, 255, 157, 0.15)',
                  border: '1px solid rgba(0, 255, 157, 0.3)',
                  color: '#00FF9D',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontWeight: 600,
                  fontFamily: "'Orbitron', monospace",
                  flex: 1,
                }}
              >
                AUTO FIX & RESET
              </button>
              <button
                onClick={() => resetMCB()}
                style={{
                  background: 'rgba(255, 200, 87, 0.15)',
                  border: '1px solid rgba(255, 200, 87, 0.3)',
                  color: '#FFC857',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontWeight: 600,
                  fontFamily: "'Orbitron', monospace",
                  flex: 1,
                }}
              >
                RESET MCB
              </button>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
