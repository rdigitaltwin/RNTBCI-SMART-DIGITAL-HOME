'use client';

/**
 * RNTBCI Smart Home Digital Twin — Time Travel Page
 *
 * Historical replay interface with timeline controls, playback speed,
 * and synchronized dashboard/3D twin updates.
 */

import { useState, useCallback, Suspense, useEffect } from 'react';
import {
  Clock, Play, Pause, SkipBack, SkipForward, RotateCcw,
  Calendar, Rewind, FastForward, History,
} from 'lucide-react';
import { Canvas, useThree } from '@react-three/fiber';

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
import api from '@/services/api';
import { useSimulationStore } from '@/store';
import { EnergyDigitalTwinScene } from '../twin/page';

const PRESETS = [
  {
    id: 'yesterday',
    label: 'Yesterday',
    icon: '📅',
    description: 'Replay the full day from midnight to midnight',
    getRange: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d); end.setHours(23, 59, 59);
      return { start: d.toISOString(), end: end.toISOString() };
    },
  },
  {
    id: 'last_24h',
    label: 'Last 24 Hours',
    icon: '⏰',
    description: 'Replay the last 24 hours from now',
    getRange: () => ({
      start: new Date(Date.now() - 86400000).toISOString(),
      end: new Date().toISOString(),
    }),
  },
  {
    id: 'last_week',
    label: 'Last Week',
    icon: '📊',
    description: 'Replay the last 7 days compressed',
    getRange: () => ({
      start: new Date(Date.now() - 604800000).toISOString(),
      end: new Date().toISOString(),
    }),
  },
  {
    id: 'last_month',
    label: 'Last Month',
    icon: '📈',
    description: 'Replay the last 30 days compressed',
    getRange: () => ({
      start: new Date(Date.now() - 2592000000).toISOString(),
      end: new Date().toISOString(),
    }),
  },
];

const SPEEDS = [1, 2, 5, 10];

export default function TimeTravelPage() {
  const { replayMode, speed } = useSimulationStore();
  const [playing, setPlaying] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const handleStartReplay = useCallback(async (start: string, end: string) => {
    try {
      await api.startTimeTravel(start, end, currentSpeed);
      setPlaying(true);
      useSimulationStore.getState().setReplayMode(true);

      // Animate progress
      const duration = (new Date(end).getTime() - new Date(start).getTime()) / 1000;
      const tickInterval = 100;
      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += tickInterval * currentSpeed;
        const p = Math.min((elapsed / (duration * 1000)) * 100, 100);
        setProgress(p);
        if (p >= 100) {
          clearInterval(interval);
          setPlaying(false);
        }
      }, tickInterval);
    } catch { /* API not connected - simulate locally */
      setPlaying(true);
      useSimulationStore.getState().setReplayMode(true);
      let p = 0;
      const interval = setInterval(() => {
        p += 0.5 * currentSpeed;
        setProgress(Math.min(p, 100));
        if (p >= 100) { clearInterval(interval); setPlaying(false); }
      }, 100);
    }
  }, [currentSpeed]);

  const handleStop = useCallback(async () => {
    try { await api.stopTimeTravel(); } catch {}
    setPlaying(false);
    setProgress(0);
    useSimulationStore.getState().setReplayMode(false);
  }, []);

  const handleSpeedChange = (newSpeed: number) => {
    setCurrentSpeed(newSpeed);
    try { api.controlSimulation('change_speed', newSpeed); } catch {}
  };

  return (
    <div className="fade-in" style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)',
          }}>
            <History size={20} color="#FFF" />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#F8FAFC' }}>Time Travel</h2>
            <p style={{ fontSize: '13px', color: '#64748B' }}>
              Travel back in time and replay your home&apos;s history
            </p>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      {playing && (
        <div className="neon-border" style={{
          padding: '16px 24px', borderRadius: '12px', marginBottom: '20px',
          background: 'rgba(99, 102, 241, 0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: '#6366F1', animation: 'statusPulse 1.5s infinite',
              boxShadow: '0 0 10px rgba(99, 102, 241, 0.5)',
            }} />
            <span style={{ fontFamily: "'Orbitron', monospace", fontSize: '13px', color: '#6366F1', fontWeight: 700 }}>
              TIME TRAVEL ACTIVE
            </span>
          </div>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#94A3B8' }}>
            Speed: ×{currentSpeed} • Progress: {progress.toFixed(0)}%
          </span>
        </div>
      )}

      {/* Presets Grid */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#94A3B8', marginBottom: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Quick Presets
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                setSelectedPreset(preset.id);
                const range = preset.getRange();
                handleStartReplay(range.start, range.end);
              }}
              disabled={playing}
              className="glass-card"
              style={{
                padding: '20px', cursor: playing ? 'not-allowed' : 'pointer', textAlign: 'left',
                border: selectedPreset === preset.id ? '1px solid rgba(99, 102, 241, 0.4)' : undefined,
                opacity: playing && selectedPreset !== preset.id ? 0.5 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <span style={{ fontSize: '28px' }}>{preset.icon}</span>
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#F8FAFC' }}>{preset.label}</span>
              </div>
              <p style={{ fontSize: '12px', color: '#94A3B8' }}>{preset.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Playback Controls */}
      <div className="hud-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#94A3B8', marginBottom: '16px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Playback Controls
        </h3>

        {/* Progress bar */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            width: '100%', height: '6px', borderRadius: '3px',
            background: 'rgba(255,255,255,0.05)', overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress}%`, height: '100%',
              background: 'linear-gradient(90deg, #6366F1, #00E5FF)',
              borderRadius: '3px', transition: 'width 0.1s linear',
              boxShadow: '0 0 10px rgba(99, 102, 241, 0.5)',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: '#64748B' }}>
              {progress.toFixed(0)}%
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: '#64748B' }}>
              ×{currentSpeed}
            </span>
          </div>
        </div>

        {/* Control buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <button onClick={handleStop} disabled={!playing}
            style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: playing ? 1 : 0.3 }}>
            <RotateCcw size={16} />
          </button>
          <button disabled style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SkipBack size={16} />
          </button>
          <button
            onClick={() => playing ? handleStop() : null}
            style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: playing ? 'linear-gradient(135deg, #FF4D6D, #EF4444)' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              border: 'none', color: '#FFF', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: playing ? '0 0 20px rgba(255, 77, 109, 0.4)' : '0 0 20px rgba(99, 102, 241, 0.4)',
              transition: 'all 0.3s',
            }}
          >
            {playing ? <Pause size={22} /> : <Play size={22} />}
          </button>
          <button disabled style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SkipForward size={16} />
          </button>
          <button disabled style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FastForward size={16} />
          </button>
        </div>

        {/* Speed selector */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => handleSpeedChange(s)}
              style={{
                padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 600,
                background: currentSpeed === s ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.03)',
                color: currentSpeed === s ? '#6366F1' : '#64748B',
                transition: 'all 0.2s',
              }}
            >
              ×{s}
            </button>
          ))}
        </div>
      </div>

      {/* 3D Visualizer */}
      <div className="glass-card" style={{ padding: '2px', height: '500px', overflow: 'hidden', position: 'relative' }}>
        <div style={{
          position: 'absolute', top: '16px', left: '16px', zIndex: 10,
          fontFamily: "'Orbitron', monospace", fontSize: '11px',
          color: '#00E5FF', padding: '8px 14px', borderRadius: '8px',
          background: 'rgba(5, 8, 22, 0.85)', border: '1px solid rgba(0, 229, 255, 0.2)',
          backdropFilter: 'blur(8px)',
        }}>
          HISTORICAL REPLAY VISUALIZER
        </div>
        
        <Canvas
          camera={{ position: [8, 6, 8], fov: 45 }}
          gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
          dpr={[1, 2]}
          style={{ background: '#050816', borderRadius: '14px' }}
        >
          <CanvasCleanup />
          <Suspense fallback={null}>
            <EnergyDigitalTwinScene />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
