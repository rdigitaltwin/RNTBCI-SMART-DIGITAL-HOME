'use client';

import { useState, useEffect, useMemo } from 'react';
import { Download, Search, Filter, FileDown } from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import api from '@/services/api';
import { LiveIndicator } from '@/components/ui/DashboardCards';

const COLORS = [
  '#00E5FF', '#00FF9D', '#FFC857', '#6366F1', 
  '#FF4D6D', '#F472B6', '#38BDF8', '#FBBF24',
  '#A78BFA', '#34D399', '#FB923C', '#818CF8'
];

export default function AppliancePowerDashboard() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [allDevices, setAllDevices] = useState<string[]>([]);
  const [activeDevices, setActiveDevices] = useState<Set<string>>(new Set());
  const [hoveredDevice, setHoveredDevice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.getDevicePowerHistory({ per_page: 500 }) as any;
      
      const timeBuckets: Record<string, any> = {};
      const foundDevices = new Set<string>();

      res.records.forEach((r: any) => {
        const date = new Date(r.timestamp);
        // Truncate to nearest 10 seconds to group records properly
        date.setMilliseconds(0);
        const secs = date.getSeconds();
        date.setSeconds(secs - (secs % 10));
        const ts = date.toISOString();
        
        const deviceName = r.device_name;
        foundDevices.add(deviceName);
        
        if (!timeBuckets[ts]) {
          timeBuckets[ts] = {
            timestamp: ts,
            timeFormatted: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
          };
        }
        timeBuckets[ts][deviceName] = Number(r.kw) || 0;
      });

      const sortedData = Object.values(timeBuckets).sort((a: any, b: any) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      const deviceList = Array.from(foundDevices).sort();
      setAllDevices(deviceList);
      
      // Select top 6 devices by default if none selected yet
      if (activeDevices.size === 0 && deviceList.length > 0) {
        setActiveDevices(new Set(deviceList.slice(0, 6)));
      }
      
      setData(sortedData);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch device power data', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const toggleDevice = (device: string) => {
    setActiveDevices(prev => {
      const next = new Set(prev);
      if (next.has(device)) {
        next.delete(device);
      } else {
        next.add(device);
      }
      return next;
    });
  };

  const filteredDevices = useMemo(() => {
    return allDevices.filter(d => d.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allDevices, searchQuery]);

  const downloadCsv = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/device-power/download/csv`;
  };

  const downloadXlsx = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/device-power/download/xlsx`;
  };

  return (
    <div className="fade-in" style={{ maxWidth: '1600px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header & Controls Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '36px', fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Appliance Power</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
            <p style={{ fontSize: '13px', color: '#64748B' }}>Per-device active power over time</p>
            <div style={{ 
              padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', 
              border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', color: '#94A3B8'
            }}>
              Showing {activeDevices.size} of {allDevices.length} devices
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} size={16} />
            <input 
              type="text" 
              placeholder="Filter appliances..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%', background: 'rgba(11, 17, 32, 0.5)', border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '8px', padding: '10px 12px 10px 36px', fontSize: '13px', color: '#F8FAFC',
                outline: 'none', transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#00E5FF'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>

          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

          <button 
            onClick={downloadCsv}
            className="hover-brighten"
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(11, 17, 32, 0.8)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#CBD5E1', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.2s ease-out'
            }}
          >
            <FileDown size={16} color="#64748B" />
            CSV
          </button>
          <button 
            onClick={downloadXlsx}
            className="hover-brighten"
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(0, 255, 157, 0.1)', border: '1px solid rgba(0, 255, 157, 0.2)',
              color: '#00FF9D', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.2s ease-out'
            }}
          >
            <Download size={16} />
            XLSX
          </button>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '32px', minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#F8FAFC' }}>Appliance Consumption</h2>
            <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>Interactive power curves</p>
          </div>
          <LiveIndicator />
        </div>
        
        {/* Interactive Legend (Scrollable horizontal chips) */}
        <div style={{ 
          display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '16px', marginBottom: '16px',
          borderBottom: '1px solid rgba(255,255,255,0.05)', scrollbarWidth: 'thin' 
        }}>
          {filteredDevices.map((device, index) => {
            const isActive = activeDevices.has(device);
            const color = COLORS[allDevices.indexOf(device) % COLORS.length];
            return (
              <button
                key={device}
                onClick={() => toggleDevice(device)}
                onMouseEnter={() => setHoveredDevice(device)}
                onMouseLeave={() => setHoveredDevice(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 12px', borderRadius: '20px', whiteSpace: 'nowrap',
                  background: isActive ? `${color}15` : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isActive ? `${color}40` : 'rgba(255,255,255,0.1)'}`,
                  color: isActive ? '#F8FAFC' : '#94A3B8',
                  fontSize: '12px', fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer', transition: 'all 0.2s ease-out',
                  opacity: (hoveredDevice && hoveredDevice !== device && hoveredDevice !== 'none') ? 0.4 : 1
                }}
              >
                <span style={{ 
                  width: '8px', height: '8px', borderRadius: '50%', 
                  background: isActive ? color : '#334155',
                  boxShadow: isActive ? `0 0 8px ${color}80` : 'none'
                }} />
                {device}
              </button>
            );
          })}
          {filteredDevices.length === 0 && (
            <div style={{ fontSize: '13px', color: '#64748B', padding: '6px 0' }}>No appliances match your search.</div>
          )}
        </div>

        {loading && data.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : error ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF4D6D' }}>
            {error}
          </div>
        ) : (
          <div style={{ flex: 1, height: '400px', width: '100%' }}>
            <ResponsiveContainer minWidth={10} minHeight={10} width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="timeFormatted" 
                  stroke="#64748B" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  dy={10}
                />
                <YAxis 
                  stroke="#64748B" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(value) => `${value} kW`}
                  dx={-10}
                />
                <Tooltip 
                  contentStyle={{ 
                    background: 'rgba(11, 17, 32, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)', 
                    borderRadius: '8px', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace", 
                    color: '#F8FAFC', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
                  }}
                  itemStyle={{ fontWeight: 600, padding: '2px 0' }}
                  labelStyle={{ color: '#94A3B8', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}
                  formatter={(value: any, name: any) => [`${(Number(value) || 0).toFixed(3)} kW`, String(name)]}
                />
                
                {Array.from(activeDevices).map((device) => {
                  const color = COLORS[allDevices.indexOf(device) % COLORS.length];
                  const isHovered = hoveredDevice === device;
                  const isFaded = hoveredDevice !== null && hoveredDevice !== device;
                  
                  return (
                    <Line 
                      key={device}
                      type="monotone" 
                      dataKey={device}
                      name={device}
                      stroke={color} 
                      strokeWidth={isHovered ? 4 : 2}
                      strokeOpacity={isFaded ? 0.15 : 1}
                      dot={false}
                      connectNulls={true}
                      activeDot={{ r: 6, fill: color, stroke: '#0B1120', strokeWidth: 2 }}
                      style={{ transition: 'all 0.3s ease-out' }}
                      onMouseEnter={() => setHoveredDevice(device)}
                      onMouseLeave={() => setHoveredDevice(null)}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <style jsx global>{`
        .hover-brighten:hover {
          filter: brightness(1.2);
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}
