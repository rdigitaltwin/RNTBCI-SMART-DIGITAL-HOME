'use client';

import { useState, useEffect } from 'react';
import { Download, Activity, Zap, Clock, FileDown } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import api from '@/services/api';
import { StatCard, LiveIndicator } from '@/components/ui/DashboardCards';

export default function HomePowerDashboard() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('24h');
  
  // Calculate stats from data
  const latestKw = data.length > 0 ? data[data.length - 1].total_home_power_consumption_kw : 0;
  const maxKw = data.length > 0 ? Math.max(...data.map(d => d.total_home_power_consumption_kw)) : 0;
  const avgKw = data.length > 0 ? data.reduce((sum, d) => sum + d.total_home_power_consumption_kw, 0) / data.length : 0;

  useEffect(() => {
    fetchData();
    // Poll every 15 seconds
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchData = async () => {
    try {
      const targetCount = { '15m': 60, '1h': 240, '6h': 1440, '24h': 5760 }[timeRange] || 60;
      let allRecords: any[] = [];
      const CHUNK_SIZE = 1000;
      const numChunks = Math.ceil(targetCount / CHUNK_SIZE);
      
      const promises = [];
      for (let i = 0; i < numChunks; i++) {
        const fetchSize = (i === numChunks - 1 && targetCount % CHUNK_SIZE !== 0) ? targetCount % CHUNK_SIZE : CHUNK_SIZE;
        promises.push(api.getHomePowerHistory({ page: i + 1, per_page: fetchSize }));
      }
      
      const results = await Promise.all(promises);
      results.forEach((res: any) => {
        allRecords = allRecords.concat(res.records || []);
      });

      // Sort ascending for charts
      const sortedData = allRecords.sort((a: any, b: any) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      // Format timestamps for display
      const formattedData = sortedData.map((d: any) => {
        const date = new Date(d.timestamp);
        return {
          ...d,
          timeFormatted: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
        };
      });
      
      setData(formattedData);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch home power data', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/home-power/download/csv`;
  };

  const downloadXlsx = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/home-power/download/xlsx`;
  };

  return (
    <div className="fade-in" style={{ maxWidth: '1600px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header & Controls Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '36px', fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Home Power History</h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>Total electricity consumption time-series</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Time Range Selector */}
          <div style={{ 
            display: 'flex', background: 'rgba(11, 17, 32, 0.5)', 
            borderRadius: '8px', padding: '4px', border: '1px solid rgba(255,255,255,0.05)'
          }}>
            {['15m', '1h', '6h', '24h'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                style={{
                  padding: '6px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                  background: timeRange === range ? 'rgba(0, 229, 255, 0.15)' : 'transparent',
                  color: timeRange === range ? '#00E5FF' : '#64748B',
                  transition: 'all 0.2s', cursor: 'pointer', border: 'none'
                }}
              >
                {range}
              </button>
            ))}
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

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '16px',
      }}>
        <StatCard label="Current Draw" value={(latestKw).toFixed(2)} unit="kW" icon={Activity} color="#00FF9D" />
        <StatCard label="Peak Demand" value={(maxKw).toFixed(2)} unit="kW" icon={Zap} color="#FFC857" />
        <StatCard label="Average" value={(avgKw).toFixed(2)} unit="kW" icon={Clock} color="#6366F1" />
      </div>

      {/* Main Chart */}
      <div className="glass-card" style={{ padding: '32px', minHeight: '500px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#F8FAFC' }}>Power Consumption Trend</h2>
            <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>Historical breakdown</p>
          </div>
          <LiveIndicator />
        </div>
        
        {loading && data.length === 0 ? (
          <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : error ? (
          <div style={{ height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
            <div style={{ color: '#FF4D6D', fontSize: '16px', fontWeight: 500 }}>{error}</div>
            <button 
              onClick={fetchData}
              style={{
                padding: '8px 24px', background: 'rgba(255, 77, 109, 0.1)', color: '#FF4D6D',
                border: '1px solid rgba(255, 77, 109, 0.2)', borderRadius: '8px', cursor: 'pointer',
                fontWeight: 600, transition: 'all 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255, 77, 109, 0.2)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255, 77, 109, 0.1)'}
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <div style={{ height: '400px', width: '100%' }}>
            <ResponsiveContainer minWidth={10} minHeight={10} width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorKwPremium" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00E5FF" stopOpacity={0.4}/>
                    <stop offset="100%" stopColor="#00E5FF" stopOpacity={0}/>
                  </linearGradient>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>
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
                    background: 'rgba(11, 17, 32, 0.95)', border: '1px solid rgba(0, 229, 255, 0.2)', 
                    borderRadius: '8px', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace", 
                    color: '#F8FAFC', boxShadow: '0 8px 32px rgba(0, 229, 255, 0.1)'
                  }}
                  itemStyle={{ color: '#00E5FF', fontWeight: 600, padding: '4px 0' }}
                  labelStyle={{ color: '#94A3B8', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}
                  formatter={(value: any) => [`${Number(value).toFixed(3)} kW`, 'Total Power']}
                />
                <Area 
                  type="monotone" 
                  dataKey="total_home_power_consumption_kw" 
                  stroke="#00E5FF" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorKwPremium)" 
                  activeDot={{ r: 6, fill: '#00E5FF', stroke: '#0B1120', strokeWidth: 3 }}
                  style={{ filter: 'url(#glow)' }}
                />
              </AreaChart>
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
