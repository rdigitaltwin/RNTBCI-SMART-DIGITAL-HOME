'use client';

/**
 * RNTBCI Smart Home Digital Twin — Settings Page
 */

import { useState } from 'react';
import { Settings, User, Shield, Wifi, Palette, Bell, Database, Server } from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'system', label: 'System', icon: Server },
  ];

  return (
    <div className="fade-in" style={{ maxWidth: '1000px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#F8FAFC', marginBottom: '24px' }}>Settings</h2>

      <div style={{ display: 'flex', gap: '20px' }}>
        {/* Tabs */}
        <div style={{ width: '200px', flexShrink: 0 }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`sidebar-item ${activeTab === tab.id ? 'active' : ''}`}
                style={{
                  width: '100%', textAlign: 'left', marginBottom: '4px',
                  background: activeTab === tab.id ? 'rgba(0, 229, 255, 0.08)' : 'transparent',
                  border: activeTab === tab.id ? '1px solid rgba(0, 229, 255, 0.2)' : '1px solid transparent',
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="glass-card" style={{ flex: 1, padding: '24px' }}>
          {activeTab === 'general' && (
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#F8FAFC', marginBottom: '20px' }}>General Settings</h3>
              {[
                { label: 'Application Name', value: 'RNTBCI Smart Home Digital Twin' },
                { label: 'Version', value: 'v1.0.0 (Nexus Core)' },
                { label: 'API Endpoint', value: 'http://localhost:8000' },
                { label: 'WebSocket', value: 'ws://localhost:8000/api/v1/ws' },
                { label: 'Simulation Interval', value: '1 second' },
                { label: 'Data Retention', value: '30 days' },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <span style={{ fontSize: '13px', color: '#94A3B8' }}>{item.label}</span>
                  <span style={{ fontSize: '13px', fontFamily: "'JetBrains Mono', monospace", color: '#F8FAFC' }}>{item.value}</span>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'system' && (
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#F8FAFC', marginBottom: '20px' }}>System Status</h3>
              {[
                { label: 'PostgreSQL', status: 'Connected', color: '#00FF9D' },
                { label: 'Redis PubSub', status: 'Connected', color: '#00FF9D' },
                { label: 'MQTT Broker', status: 'Optional', color: '#FFC857' },
                { label: 'Simulation Engine', status: 'Running', color: '#00FF9D' },
                { label: 'WebSocket Server', status: 'Active', color: '#00FF9D' },
                { label: 'HEMS', status: 'Active', color: '#00FF9D' },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <span style={{ fontSize: '13px', color: '#94A3B8' }}>{item.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.color, boxShadow: `0 0 6px ${item.color}80` }} />
                    <span style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: item.color }}>{item.status}</span>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', marginBottom: '12px' }}>System Logs</h4>
                <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '16px' }}>
                  Download the comprehensive JSON-formatted system logs for debugging and analysis.
                </p>
                <button
                  onClick={() => window.open('http://localhost:8000/api/v1/system/logs/download', '_blank')}
                  style={{
                    background: 'rgba(0, 229, 255, 0.1)',
                    border: '1px solid rgba(0, 229, 255, 0.3)',
                    color: '#00E5FF',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Settings size={16} />
                  Download System Logs
                </button>
              </div>
            </div>
          )}
          {!['general', 'system'].includes(activeTab) && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <span style={{ fontSize: '40px' }}>⚙️</span>
              <p style={{ fontSize: '14px', color: '#94A3B8', marginTop: '12px' }}>
                {tabs.find((t) => t.id === activeTab)?.label} settings will be available after backend configuration.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
