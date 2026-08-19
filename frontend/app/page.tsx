/* eslint-disable react-hooks/exhaustive-deps, react-hooks/immutability */
'use client';

/**
 * RNTBCI Smart Home Digital Twin — Cinematic Landing Page
 *
 * Black background → floating particles → holographic house blueprint →
 * walls form → devices glow → camera orbits → text fades in → CTA button
 */

import { useEffect, useRef, useState, useCallback, Suspense, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, Float } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

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
// PARTICLE FIELD
// =============================================================================

function ParticleField({ count = 2000 }: { count?: number }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  const velocities = useMemo(() => new Float32Array(count * 3), [count]);

  useEffect(() => {
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
      velocities[i * 3] = (Math.random() - 0.5) * 0.002;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.002;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.002;
    }
  }, [count, positions, velocities]);

  useFrame(() => {
    if (!points.current) return;
    const geo = points.current.geometry;
    const pos = geo.attributes.position;
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < 3; j++) {
        const idx = i * 3 + j;
        positions[idx] += velocities[idx];
        if (Math.abs(positions[idx]) > 20) velocities[idx] *= -1;
      }
    }
    (pos.array as Float32Array).set(positions);
    pos.needsUpdate = true;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#00E5FF" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

// =============================================================================
// HOLOGRAPHIC HOUSE WIREFRAME
// =============================================================================

function HolographicHouse({ progress }: { progress: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  useFrame((state, delta) => {
    if (groupRef.current) {
      timeRef.current += delta;
      groupRef.current.rotation.y = timeRef.current * 0.1;
    }
  });

  const wallMaterial = new THREE.LineBasicMaterial({
    color: '#00E5FF',
    transparent: true,
    opacity: Math.min(progress * 1.5, 0.8),
  });

  const createWallGeometry = (w: number, h: number, d: number, px: number, py: number, pz: number) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const edges = new THREE.EdgesGeometry(geo);
    return { edges, position: [px, py, pz] as [number, number, number] };
  };

  const rooms = [
    createWallGeometry(3, 1.5, 2.5, 0, 0.75, 0),        // Living Room
    createWallGeometry(2, 1.5, 2, 3, 0.75, 0),            // Kitchen
    createWallGeometry(2.5, 1.5, 2.2, 0, 0.75, 2.8),     // Bedroom
    createWallGeometry(1.5, 1.5, 1.5, 2.8, 0.75, 2.8),   // Bathroom
    createWallGeometry(2.5, 1.8, 2.8, -3.2, 0.9, 0),     // Garage
    createWallGeometry(2, 1.5, 1.5, 3, 0.75, 2.5),        // Utility
    createWallGeometry(0.8, 1.5, 3, 1.5, 0.75, 1.5),     // Hallway
  ];

  const visibleRooms = Math.floor(rooms.length * Math.min(progress, 1));

  return (
    <group ref={groupRef} scale={[1.2, 1.2, 1.2]} position={[0, -0.5, 0]}>
      {/* Foundation */}
      <mesh position={[0, -0.02, 1]}>
        <boxGeometry args={[9, 0.04, 7]} />
        <meshStandardMaterial
          color="#00E5FF"
          transparent
          opacity={0.08 * Math.min(progress * 2, 1)}
          emissive="#00E5FF"
          emissiveIntensity={0.1}
        />
      </mesh>

      {/* Grid floor */}
      <gridHelper
        args={[10, 20, '#00E5FF', '#0a2a3a']}
        position={[0, 0, 1]}
        material-transparent
        material-opacity={0.2 * Math.min(progress * 2, 1)}
      />

      {/* Rooms */}
      {rooms.slice(0, visibleRooms).map((room, i) => (
        <lineSegments key={i} position={room.position} geometry={room.edges} material={wallMaterial} />
      ))}

      {/* Device glow points */}
      {progress > 0.6 && (
        <>
          {[
            [0, 1.3, 0],
            [3.2, 0.5, 0.3],
            [0, 0.5, 2.8],
            [-3.2, 0.5, 0],
            [1.5, 0.5, 1.5],
            [2.8, 0.5, 2.8],
          ].map((pos, i) => (
            <Float key={i} speed={2} floatIntensity={0.2}>
              <mesh position={pos as [number, number, number]}>
                <sphereGeometry args={[0.06, 16, 16]} />
                <meshStandardMaterial
                  color="#00E5FF"
                  emissive="#00E5FF"
                  emissiveIntensity={2}
                  transparent
                  opacity={Math.min((progress - 0.6) * 3, 1)}
                />
              </mesh>
            </Float>
          ))}
        </>
      )}

      {/* Neon floor edges */}
      {progress > 0.3 && (
        <lineSegments position={[0, 0.01, 1]}>
          <edgesGeometry args={[new THREE.BoxGeometry(9, 0.01, 7)]} />
          <lineBasicMaterial color="#00E5FF" transparent opacity={0.4} />
        </lineSegments>
      )}
    </group>
  );
}

// =============================================================================
// CAMERA ANIMATION
// =============================================================================

function CameraAnimator({ progress }: { progress: number }) {
  const timeRef = useRef(0);

  useFrame((state, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;
    const radius = 8 - progress * 2;
    const height = 4 + Math.sin(t * 0.3) * 0.5;

    state.camera.position.x = Math.sin(t * 0.15) * radius;
    state.camera.position.z = Math.cos(t * 0.15) * radius;
    state.camera.position.y = height;
    state.camera.lookAt(0, 0.5, 1);
  });

  return null;
}

// =============================================================================
// 3D SCENE
// =============================================================================

function LandingScene({ progress }: { progress: number }) {
  return (
    <>
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 5, 0]} intensity={0.3} color="#00E5FF" />
      <pointLight position={[5, 3, 5]} intensity={0.2} color="#3B82F6" />

      <Stars radius={50} depth={50} count={3000} factor={3} saturation={0} fade speed={0.5} />
      <ParticleField count={1500} />
      <HolographicHouse progress={progress} />
      <CameraAnimator progress={progress} />

      <fog attach="fog" args={['#050816', 8, 30]} />

      <EffectComposer>
        <Bloom intensity={1.2} luminanceThreshold={0.2} luminanceSmoothing={0.9} />
        <Vignette eskil={false} offset={0.3} darkness={0.8} />
      </EffectComposer>
    </>
  );
}

// =============================================================================
// LANDING PAGE
// =============================================================================

export default function LandingPage() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [showText, setShowText] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [buttonHover, setButtonHover] = useState(false);

  useEffect(() => {
    // Animate progress from 0 to 1 over 4 seconds
    const startTime = Date.now();
    const duration = 4000;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const p = Math.min(elapsed / duration, 1);
      setProgress(p);

      if (p >= 0.7 && !showText) setShowText(true);
      if (p >= 0.9 && !showButton) setShowButton(true);

      if (p < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [showText, showButton]);

  const handleEnter = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#050816', position: 'relative', overflow: 'hidden' }}>
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [8, 4, 8], fov: 50 }}
        gl={{ antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: false }}
        dpr={[1, 2]}
        style={{ position: 'absolute', inset: 0 }}
      >
        <CanvasCleanup />
        <Suspense fallback={null}>
          <LandingScene progress={progress} />
        </Suspense>
      </Canvas>

      {/* Overlay UI */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 10,
      }}>
        {/* Title */}
        <div style={{
          opacity: showText ? 1 : 0,
          transform: showText ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
          textAlign: 'center',
        }}>
          <h1 style={{
            fontFamily: "'Orbitron', monospace",
            fontSize: 'clamp(2rem, 5vw, 4.5rem)',
            fontWeight: 900,
            color: '#F8FAFC',
            letterSpacing: '0.15em',
            lineHeight: 1.1,
            marginBottom: '16px',
            textShadow: '0 0 30px rgba(0, 229, 255, 0.3), 0 0 60px rgba(0, 229, 255, 0.1)',
          }}>
            RNTBCI
          </h1>
          <h2 style={{
            fontFamily: "'Orbitron', monospace",
            fontSize: 'clamp(0.8rem, 2vw, 1.5rem)',
            fontWeight: 500,
            color: '#00E5FF',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            marginBottom: '8px',
            textShadow: '0 0 20px rgba(0, 229, 255, 0.5)',
          }}>
            Smart Home Digital Twin
          </h2>
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 'clamp(0.7rem, 1.2vw, 1rem)',
            color: '#94A3B8',
            letterSpacing: '0.15em',
            marginTop: '12px',
          }}>
            Real-Time Intelligent Home Ecosystem
          </p>
        </div>

        {/* CTA Button */}
        <div style={{
          opacity: showButton ? 1 : 0,
          transform: showButton ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1) 0.3s',
          marginTop: '48px',
          pointerEvents: showButton ? 'auto' : 'none',
        }}>
          <button
            onClick={handleEnter}
            onMouseEnter={() => setButtonHover(true)}
            onMouseLeave={() => setButtonHover(false)}
            style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: '14px',
              fontWeight: 700,
              color: buttonHover ? '#050816' : '#00E5FF',
              background: buttonHover
                ? 'linear-gradient(135deg, #00E5FF, #3B82F6)'
                : 'transparent',
              border: '2px solid #00E5FF',
              padding: '16px 48px',
              borderRadius: '8px',
              cursor: 'pointer',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: buttonHover
                ? '0 0 30px rgba(0, 229, 255, 0.5), 0 0 60px rgba(0, 229, 255, 0.2), inset 0 0 20px rgba(0, 229, 255, 0.1)'
                : '0 0 15px rgba(0, 229, 255, 0.2)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            Enter Control Center
            {/* Energy wave animation */}
            {buttonHover && (
              <span style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                animation: 'energyWave 1.5s ease-in-out infinite',
              }} />
            )}
          </button>
        </div>

        {/* Version */}
        <p style={{
          position: 'absolute',
          bottom: '24px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          color: '#64748B',
          letterSpacing: '0.1em',
          opacity: showText ? 1 : 0,
          transition: 'opacity 1s',
        }}>
          NEXUS_CORE v1.0.0 // SYSTEM_READY // LATENCY: &lt;4MS
        </p>
      </div>

      <style>{`
        @keyframes energyWave {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
