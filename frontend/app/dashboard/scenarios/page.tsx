'use client';

/**
 * RNTBCI Smart Home Digital Twin — Scenario Manager Page
 *
 * Built-in and custom automation scenarios with activation controls.
 */

import { useState, useEffect } from 'react';
import {
  Sunrise, Moon, Plane, AlertTriangle, Battery, Film,
  Play, Pause, CheckCircle, Loader, Settings, Plus,
} from 'lucide-react';
import api from '@/services/api';

interface Scenario {
  id: string;
  name: string;
  description: string;
  icon: string;
  trigger: string;
  active: boolean;
  built_in: boolean;
}

const ICON_MAP: Record<string, any> = {
  sunrise: Sunrise, moon: Moon, plane: Plane,
  'alert-triangle': AlertTriangle, battery: Battery, film: Film,
  settings: Settings,
};

const GRADIENT_MAP: Record<string, string> = {
  sunrise: 'linear-gradient(135deg, #FFC857 0%, #F97316 100%)',
  moon: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
  plane: 'linear-gradient(135deg, #00B4D8 0%, #3B82F6 100%)',
  'alert-triangle': 'linear-gradient(135deg, #FF4D6D 0%, #EF4444 100%)',
  battery: 'linear-gradient(135deg, #10B981 0%, #00FF9D 100%)',
  film: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)',
  settings: 'linear-gradient(135deg, #94A3B8 0%, #64748B 100%)',
};

function ScenarioCard({ scenario, onToggle }: { scenario: Scenario; onToggle: () => void }) {
  const [loading, setLoading] = useState(false);
  const Icon = ICON_MAP[scenario.icon] || Settings;
  const gradient = GRADIENT_MAP[scenario.icon] || GRADIENT_MAP.settings;

  const handleToggle = async () => {
    setLoading(true);
    await onToggle();
    setLoading(false);
  };

  return (
    <div className="glass-card" style={{
      padding: '24px', position: 'relative', overflow: 'hidden',
      border: scenario.active ? '1px solid rgba(0, 255, 157, 0.3)' : undefined,
      boxShadow: scenario.active ? '0 0 20px rgba(0, 255, 157, 0.1)' : undefined,
    }}>
      {/* Active indicator */}
      {scenario.active && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
          background: 'linear-gradient(90deg, #00FF9D, #10B981)',
        }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        {/* Icon */}
        <div style={{
          width: '52px', height: '52px', borderRadius: '14px',
          background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, boxShadow: `0 4px 15px ${gradient.includes('#FFC857') ? 'rgba(255, 200, 87, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
        }}>
          <Icon size={24} color="#FFF" />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#F8FAFC' }}>{scenario.name}</h3>
            {scenario.active && (
              <span style={{
                fontSize: '10px', fontFamily: "'JetBrains Mono', monospace",
                color: '#00FF9D', padding: '2px 8px', borderRadius: '10px',
                background: 'rgba(0, 255, 157, 0.1)', fontWeight: 600,
              }}>
                ACTIVE
              </span>
            )}
          </div>
          <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.4, marginBottom: '12px' }}>
            {scenario.description}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '10px', fontFamily: "'JetBrains Mono', monospace",
              color: '#64748B', padding: '3px 8px', borderRadius: '4px',
              background: 'rgba(255,255,255,0.03)',
            }}>
              {scenario.trigger.toUpperCase()}
            </span>
            {scenario.built_in && (
              <span style={{
                fontSize: '10px', fontFamily: "'JetBrains Mono', monospace",
                color: '#6366F1', padding: '3px 8px', borderRadius: '4px',
                background: 'rgba(99, 102, 241, 0.1)',
              }}>
                BUILT-IN
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action button */}
      <button
        onClick={handleToggle}
        disabled={loading}
        style={{
          marginTop: '16px', width: '100%', padding: '10px', borderRadius: '8px',
          border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
          fontFamily: "'Orbitron', monospace", display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: '8px', transition: 'all 0.3s',
          background: scenario.active
            ? 'rgba(255, 77, 109, 0.1)'
            : 'linear-gradient(135deg, rgba(0, 229, 255, 0.15), rgba(59, 130, 246, 0.15))',
          color: scenario.active ? '#FF4D6D' : '#00E5FF',
          letterSpacing: '0.1em',
        }}
      >
        {loading ? <Loader size={14} className="animate-spin" /> : scenario.active ? <Pause size={14} /> : <Play size={14} />}
        {scenario.active ? 'DEACTIVATE' : 'ACTIVATE'}
      </button>
    </div>
  );
}

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.getScenarios();
        setScenarios(res as Scenario[]);
      } catch {
        setScenarios([
          { id: 'morning_routine', name: 'Morning Routine', description: 'Prepare the home for the day — lights, AC, water heater, and media.', icon: 'sunrise', trigger: 'schedule', active: false, built_in: true },
          { id: 'night_routine', name: 'Night Routine', description: 'Secure and dim the home for sleep — locks, cameras, low lights.', icon: 'moon', trigger: 'schedule', active: false, built_in: true },
          { id: 'vacation_mode', name: 'Vacation Mode', description: 'Simulate occupancy with random lights, lock doors, minimize energy.', icon: 'plane', trigger: 'manual', active: false, built_in: true },
          { id: 'emergency_mode', name: 'Emergency Mode', description: 'Maximum visibility and access — all lights on, doors unlocked.', icon: 'alert-triangle', trigger: 'manual', active: false, built_in: true },
          { id: 'energy_saver', name: 'Energy Saver', description: 'Reduce consumption — dim lights, fan-only AC, lower water temp.', icon: 'battery', trigger: 'manual', active: false, built_in: true },
          { id: 'movie_night', name: 'Movie Night', description: 'Perfect ambiance — dim purple lights, TV on, AC to 22°C.', icon: 'film', trigger: 'manual', active: false, built_in: true },
        ]);
      }
    };
    fetch();
  }, []);

  const handleToggle = async (scenario: Scenario) => {
    try {
      if (scenario.active) {
        await api.deactivateScenario(scenario.id);
      } else {
        await api.activateScenario(scenario.id);
      }
    } catch { /* API not connected */ }
    setScenarios((prev) =>
      prev.map((s) => s.id === scenario.id ? { ...s, active: !s.active } : s)
    );
  };

  return (
    <div className="fade-in" style={{ maxWidth: '1200px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#F8FAFC' }}>Scenario Manager</h2>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
            Automate your home with predefined and custom scenarios
          </p>
        </div>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={14} /> New Scenario
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
        gap: '16px',
      }}>
        {scenarios.map((scenario) => (
          <ScenarioCard key={scenario.id} scenario={scenario} onToggle={() => handleToggle(scenario)} />
        ))}
      </div>
    </div>
  );
}
