import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export function StatCard({ label, value, unit, icon: Icon, color, change, trend }: {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ComponentType<{ size?: number; color?: string; className?: string }>;
  color: string;
  change?: string;
  trend?: 'up' | 'down';
}) {
  return (
    <div className="glass-card" style={{ padding: '20px', position: 'relative', overflow: 'hidden', height: '100%', transition: 'all 0.2s ease-out' }} 
         onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
         onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}>
      {/* Glow accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px',
          background: `${color}15`, border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} color={color} />
        </div>
        {change && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '2px',
            fontSize: '12px', fontWeight: 600,
            color: trend === 'up' ? '#00FF9D' : '#FF4D6D',
          }}>
            {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {change}
          </div>
        )}
      </div>

      <div style={{
        fontFamily: "'Orbitron', monospace", fontSize: '28px', fontWeight: 800,
        color: '#F8FAFC', lineHeight: 1,
      }}>
        {value}
        {unit && <span style={{ fontSize: '14px', color: '#94A3B8', marginLeft: '4px', fontWeight: 500 }}>{unit}</span>}
      </div>
      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px', letterSpacing: '0.05em' }}>
        {label}
      </div>
    </div>
  );
}

export function LiveIndicator() {
  return (
    <div style={{
      padding: '4px 10px', borderRadius: '20px',
      background: 'rgba(0, 229, 255, 0.1)', border: '1px solid rgba(0, 229, 255, 0.2)',
      fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#00E5FF',
      display: 'inline-flex', alignItems: 'center', gap: '6px'
    }}>
      <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] shadow-[0_0_8px_rgba(0,229,255,0.8)]"></span>
      LIVE
    </div>
  );
}
