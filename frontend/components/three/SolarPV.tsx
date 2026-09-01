'use client';

/**
 * RNTBCI Smart Home Digital Twin — Solar PV 3D Component
 *
 * Standalone solar photovoltaic array for the exterior scene.
 * Follows the exact same conventions as MCBAnimation and ExteriorArea (EVSE):
 *   - mesh geometry matching the low-poly wireframe aesthetic
 *   - floating status label: "SOLAR PV • GENERATING" / "SOLAR PV • OFFLINE"
 *   - state read from EnergyDevice (type: 'solar_pv', applianceId: 'solar_panel')
 *   - props: position, tiltAngle, panelCount — config-driven, not hardcoded
 *
 * Backend identifier: solar_pv  (see backend/services/solar_service.py)
 * Appliance DB entry: { id: 'solar_panel', type: 'solar_pv' }
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { useEnergyStore } from '@/store/energyEngine';
import { formatPower } from '@/lib/applianceDatabase';

// =============================================================================
// CONFIG DEFAULTS (all overridable via props)
// =============================================================================

const SOLAR_PV_DEFAULTS = {
  position:   [0.2, 0.85, -0.3] as [number, number, number],
  tiltAngle:  25,   // degrees from horizontal
  panelCount: 8,    // total panels in array
};

// Solar PV accent colour — amber/gold matching DEVICE_COLORS['solar_pv']
const SOLAR_COLOR_ON  = '#FCD34D';
const SOLAR_COLOR_OFF = '#64748B';

// =============================================================================
// PROPS
// =============================================================================

export interface SolarPVProps {
  position?:   [number, number, number];
  tiltAngle?:  number;
  panelCount?: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function SolarPV({
  position   = SOLAR_PV_DEFAULTS.position,
  tiltAngle  = SOLAR_PV_DEFAULTS.tiltAngle,
  panelCount = SOLAR_PV_DEFAULTS.panelCount,
}: SolarPVProps) {
  // ── Read solar_pv device from the energy store ───────────────────────────
  // The device is registered with applianceId 'solar_panel', type 'solar_pv'
  const devices = useEnergyStore((s) => s.devices);
  const solarDevice = useMemo(
    () => Object.values(devices).find((d) => d.type === 'solar_pv') ?? null,
    [devices],
  );

  const isOn       = solarDevice?.powerState === 'on';
  const pvState    = isOn ? 'GENERATING' : 'OFFLINE';
  const pvColor    = isOn ? SOLAR_COLOR_ON : SOLAR_COLOR_OFF;
  const generation = solarDevice ? Math.abs(solarDevice.currentConsumption) : 0;

  // ── Grid layout ──────────────────────────────────────────────────────────
  const { panels, arrayW, arrayH } = useMemo(() => {
    const cols  = Math.min(4, panelCount);
    const rows  = Math.ceil(panelCount / cols);
    const pw    = 0.24;   // panel width (3D units)
    const ph    = 0.38;   // panel height
    const gap   = 0.025;
    const arrayW = cols * pw + (cols - 1) * gap;
    const arrayH = rows * ph + (rows - 1) * gap;
    const list: { key: number; x: number; z: number; pw: number; ph: number }[] = [];
    for (let i = 0; i < panelCount; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      list.push({
        key: i,
        x: (c - (cols - 1) / 2) * (pw + gap),
        z: (r - (rows - 1) / 2) * (ph + gap),
        pw,
        ph,
      });
    }
    return { panels: list, arrayW, arrayH };
  }, [panelCount]);

  // ── Animation refs ───────────────────────────────────────────────────────
  const mountGroupRef = useRef<THREE.Group>(null);
  const timeRef       = useRef(0);
  const tiltRad       = tiltAngle * (Math.PI / 180);

  useFrame((_, delta) => {
    timeRef.current += delta;
    // Subtle floating bob when generating
    if (mountGroupRef.current) {
      const yBase = 0.42;
      const bob   = isOn ? Math.sin(timeRef.current * 1.2) * 0.012 : 0;
      mountGroupRef.current.position.y = yBase + bob;
    }
  });

  return (
    <group position={position}>

      {/* ── STAND BASE ── */}
      {/* Concrete footing plate */}
      <mesh position={[0, 0.005, 0]}>
        <boxGeometry args={[0.28, 0.01, 0.28]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.4} />
      </mesh>
      <lineSegments position={[0, 0.005, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(0.28, 0.01, 0.28)]} />
        <lineBasicMaterial color={pvColor} transparent opacity={0.3} />
      </lineSegments>

      {/* Central vertical mast */}
      <mesh position={[0, 0.215, 0]}>
        <cylinderGeometry args={[0.016, 0.02, 0.43, 8]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* ── TILTED PANEL ARRAY ── */}
      <group ref={mountGroupRef} position={[0, 0.42, 0]}>

        {/* Tilt the whole array */}
        <group rotation={[-tiltRad, 0, 0]}>

          {/* Horizontal crossbar backing the panels */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.013, 0.013, Math.max(0.24, arrayW), 8]} />
            <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
          </mesh>

          {/* Render each panel cell */}
          {panels.map((p) => (
            <group key={p.key} position={[p.x, 0, p.z]}>

              {/* Panel frame (dark aluminium) */}
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <boxGeometry args={[p.pw, p.ph, 0.016]} />
                <meshStandardMaterial
                  color="#0f172a"
                  metalness={0.9}
                  roughness={0.15}
                />
              </mesh>

              {/* PV cell surface */}
              <mesh position={[0, 0.009, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[p.pw - 0.018, p.ph - 0.018]} />
                <meshStandardMaterial
                  color={isOn ? '#0d3b6e' : '#0a0f1a'}
                  emissive={isOn ? '#1a5ca8' : '#000000'}
                  emissiveIntensity={isOn ? 0.35 : 0}
                  roughness={0.05}
                  metalness={0.9}
                />
              </mesh>

              {/* Cell-grid lines (faint inner grid) */}
              <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[p.pw - 0.018, p.ph - 0.018]} />
                <meshStandardMaterial
                  color={isOn ? '#1e40af' : '#1e293b'}
                  emissive={isOn ? '#3b82f6' : '#000000'}
                  emissiveIntensity={isOn ? 0.12 : 0}
                  transparent
                  opacity={0.4}
                  wireframe
                />
              </mesh>

              {/* Neon wireframe edge glow */}
              <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
                <edgesGeometry args={[new THREE.BoxGeometry(p.pw, p.ph, 0.016)]} />
                <lineBasicMaterial
                  color={pvColor}
                  transparent
                  opacity={isOn ? 0.75 : 0.35}
                />
              </lineSegments>
            </group>
          ))}

          {/* Generating sparkles — amber energy particles floating above cells */}
          {isOn && (
            <Sparkles
              count={Math.min(40, panelCount * 5)}
              scale={[arrayW, 0.08, arrayH]}
              position={[0, 0.06, 0]}
              size={0.45}
              speed={0.4}
              color={SOLAR_COLOR_ON}
              opacity={0.55}
            />
          )}

          {/* Point-light glow when generating */}
          {isOn && (
            <pointLight
              position={[0, 0.1, 0]}
              intensity={0.3}
              color={SOLAR_COLOR_ON}
              distance={1.2}
              decay={2}
            />
          )}
        </group>
      </group>

      {/* ── STATUS LABEL ──────────────────────────────────────────────────────
          Matches the exact style of:
            EVSE label in FloorPlanHouse: "EVSE • DISCONNECTED"
            MCB label in MCBAnimation:   "MCB • ON"
      */}
      <Html position={[0, 0.82, 0]} center distanceFactor={6}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '9px',
            color: pvColor,
            background: 'rgba(5, 8, 22, 0.9)',
            padding: '3px 8px',
            borderRadius: '4px',
            border: `1px solid ${pvColor}40`,
            whiteSpace: 'nowrap',
            textShadow: `0 0 6px ${pvColor}60`,
            pointerEvents: 'none',
          }}
        >
          SOLAR PV &bull; {pvState}
          {isOn && generation > 0 && ` • ${formatPower(generation)}`}
        </div>
      </Html>
    </group>
  );
}
