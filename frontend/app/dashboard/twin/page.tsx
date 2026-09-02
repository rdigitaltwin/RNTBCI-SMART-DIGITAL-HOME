'use client';

/**
 * RNTBCI Smart Home Digital Twin — 3D Immersive Scene (Energy Upgrade)
 *
 * Floor-plan-accurate 3D house with:
 * - Energy-aware device models (all appliances from spec)
 * - MCB 3D animation
 * - EV charger visualization
 * - Load-level house glow
 * - Real-time energy sync
 *
 * Preserves: Canvas setup, orbit controls, post-processing, overlay UI pattern
 */

import { Suspense, useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls, Stars, ContactShadows,
} from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useDeviceStore, type Device, type Room } from '@/store';
import { useEnergyStore, selectRunningDevices, selectActiveAlerts, selectLoadColor } from '@/store/energyEngine';
import { formatPower } from '@/lib/applianceDatabase';
import { LOAD_LEVEL_COLORS } from '@/lib/homeCapacity';
import FloorPlanHouse from '@/components/three/FloorPlanHouse';
import AllEnergyDevices from '@/components/three/EnergyDeviceModel';
import MCBAnimation from '@/components/three/MCBAnimation';
import SolarPV from '@/components/three/SolarPV';

// =============================================================================
// CANVAS CLEANUP
// =============================================================================

function CanvasCleanup() {
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
// ENERGY-AWARE 3D SCENE
// =============================================================================

export function EnergyDigitalTwinScene() {
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const metrics = useEnergyStore((s) => s.metrics);
  const loadColor = LOAD_LEVEL_COLORS[metrics.loadLevel];

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 8, 0]} intensity={0.4} color={loadColor} distance={20} />
      <pointLight position={[5, 5, 5]} intensity={0.2} color="#3B82F6" />
      <pointLight position={[-5, 5, -3]} intensity={0.15} color="#6366F1" />
      <directionalLight position={[5, 10, 5]} intensity={0.3} color="#FFF" />

      {/* Environment */}
      <Stars radius={80} depth={60} count={3000} factor={4} saturation={0} fade speed={0.3} />
      <fog attach="fog" args={['#050816', 10, 40]} />

      {/* Ground grid */}
      <gridHelper args={[30, 60, '#0a2a3a', '#071520']} position={[0, -0.1, 0]} />

      {/* Ground plane (reflective) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.11, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#050816" metalness={0.9} roughness={0.1} transparent opacity={0.8} />
      </mesh>

      {/* Floor-plan-accurate House */}
      <FloorPlanHouse
        hoveredRoom={hoveredRoom}
        onRoomClick={(id) => setHoveredRoom(id)}
      />

      {/* All Energy Devices */}
      <AllEnergyDevices
        selectedDeviceId={selectedDeviceId}
        onSelectDevice={(id) => setSelectedDeviceId(id)}
      />

      {/* MCB 3D Breaker */}
      <MCBAnimation position={[-1.3, 0.25, -3.2]} />

      {/* Solar PV array — on top of the house roof */}
      <SolarPV position={[0.2, 0.85, -0.3]} tiltAngle={25} panelCount={8} />

      {/* Contact shadows */}
      <ContactShadows
        position={[0, -0.1, 0]}
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
        minDistance={2}
        maxDistance={15}
        maxPolarAngle={Math.PI / 2.1}
        enableDamping
        dampingFactor={0.05}
        target={[0, 0.3, 0]}
      />
    </>
  );
}

// =============================================================================
// ENERGY STATUS OVERLAY (HUD Bar)
// =============================================================================

function EnergyStatusBar() {
  const metrics = useEnergyStore((s) => s.metrics);
  const mcb = useEnergyStore((s) => s.mcb);
  const evCharger = useEnergyStore((s) => s.evCharger);
  const devices = useEnergyStore((s) => s.devices);
  const loadColor = LOAD_LEVEL_COLORS[metrics.loadLevel];

  const runningCount = Object.values(devices).filter((d) => d.powerState === 'on').length;
  const totalCount = Object.keys(devices).length;

  return (
    <div style={{
      position: 'absolute',
      top: '16px',
      left: '16px',
      right: '16px',
      display: 'flex',
      gap: '10px',
      zIndex: 10,
      flexWrap: 'wrap',
    }}>
      {/* Title badge */}
      <div style={{
        fontFamily: "'Orbitron', monospace",
        fontSize: '11px',
        color: '#00E5FF',
        padding: '8px 14px',
        borderRadius: '8px',
        background: 'rgba(5, 8, 22, 0.85)',
        border: '1px solid rgba(0, 229, 255, 0.2)',
        backdropFilter: 'blur(8px)',
      }}>
        3D DIGITAL TWIN
      </div>

      {/* Load indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 14px',
        borderRadius: '8px',
        background: 'rgba(5, 8, 22, 0.85)',
        border: `1px solid ${loadColor}30`,
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: loadColor,
          boxShadow: `0 0 8px ${loadColor}80`,
          animation: metrics.loadLevel === 'red' ? 'statusPulse 0.5s infinite' : 'none',
        }} />
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          color: loadColor,
        }}>
          {formatPower(metrics.currentLoad)} / {formatPower(metrics.availableCapacity + metrics.currentLoad)}
        </span>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '10px',
          color: '#94A3B8',
        }}>
          ({metrics.loadPercentage.toFixed(1)}%)
        </span>
      </div>

      {/* MCB State */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        borderRadius: '8px',
        background: mcb.state === 'tripped'
          ? 'rgba(255, 77, 109, 0.15)'
          : 'rgba(5, 8, 22, 0.85)',
        border: `1px solid ${mcb.state === 'tripped' ? 'rgba(255, 77, 109, 0.4)' : 'rgba(255,255,255,0.1)'}`,
        backdropFilter: 'blur(8px)',
      }}>
        <span style={{ fontSize: '12px' }}>⚡</span>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '10px',
          color: mcb.state === 'tripped' ? '#FF4D6D' : mcb.state === 'on' ? '#00FF9D' : '#64748B',
          fontWeight: 600,
        }}>
          MCB: {mcb.state.toUpperCase()}
        </span>
      </div>

      {/* Running devices */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        borderRadius: '8px',
        background: 'rgba(5, 8, 22, 0.85)',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(8px)',
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '10px',
          color: '#94A3B8',
        }}>
          {runningCount}/{totalCount} devices
        </span>
      </div>

      {/* EV Status */}
      {evCharger.state !== 'disconnected' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 12px',
          borderRadius: '8px',
          background: evCharger.state === 'charging' ? 'rgba(0, 255, 157, 0.1)' : 'rgba(5, 8, 22, 0.85)',
          border: `1px solid ${evCharger.state === 'charging' ? 'rgba(0, 255, 157, 0.3)' : 'rgba(255,255,255,0.1)'}`,
          backdropFilter: 'blur(8px)',
        }}>
          <span style={{ fontSize: '12px' }}>🔌</span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            color: evCharger.state === 'charging' ? '#00FF9D' : '#FFC857',
          }}>
            EV: {evCharger.state.toUpperCase()} {evCharger.state === 'charging' && `${evCharger.batteryLevel.toFixed(0)}%`}
          </span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// PAGE WRAPPER
// =============================================================================

export default function DigitalTwinPage() {
  const initializeDevices = useEnergyStore((s) => s.initializeDevices);
  const tick = useEnergyStore((s) => s.tick);
  const deviceOrder = useEnergyStore((s) => s.deviceOrder);

  // Initialize energy engine on mount
  useEffect(() => {
    if (deviceOrder.length === 0) {
      initializeDevices();
    }
  }, [initializeDevices, deviceOrder.length]);

  // Run simulation tick
  useEffect(() => {
    const interval = setInterval(() => {
      tick();
    }, 1000);
    return () => clearInterval(interval);
  }, [tick]);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: 'calc(100vh - var(--topbar-height) - 140px)',
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [5, 4, 5], fov: 45 }}
        gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
        dpr={[1, 2]}
        style={{ background: '#050816' }}
      >
        <CanvasCleanup />
        <Suspense fallback={null}>
          <EnergyDigitalTwinScene />
        </Suspense>
      </Canvas>

      {/* Energy status overlay */}
      <EnergyStatusBar />

      {/* Camera controls hint */}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        right: '16px',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '10px',
        color: '#64748B',
        padding: '6px 10px',
        borderRadius: '6px',
        background: 'rgba(5, 8, 22, 0.7)',
      }}>
        🖱️ Orbit • Scroll Zoom • Click Device for Energy HUD
      </div>
    </div>
  );
}
