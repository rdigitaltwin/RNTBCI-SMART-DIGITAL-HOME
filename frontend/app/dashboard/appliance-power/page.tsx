'use client';

import { useState, useEffect } from 'react';
import { Download, Activity, Search, Filter } from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import api from '@/lib/api';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function AppliancePowerDashboard() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<string[]>([]);
  
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.getDevicePowerHistory({ per_page: 500 });
      
      // We need to pivot the data manually for Recharts, similar to how the backend does it for CSV
      // Recharts wants an array of objects where each object is a timestamp with keys for each device
      
      const timeBuckets: Record<string, any> = {};
      const foundDevices = new Set<string>();

      res.records.forEach((r: any) => {
        const ts = r.timestamp;
        const deviceName = r.device_name;
        foundDevices.add(deviceName);
        
        if (!timeBuckets[ts]) {
          const date = new Date(ts);
          timeBuckets[ts] = {
            timestamp: ts,
            timeFormatted: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
          };
        }
        
        timeBuckets[ts][deviceName] = r.kw;
      });

      // Sort by timestamp
      const sortedData = Object.values(timeBuckets).sort((a: any, b: any) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      setDevices(Array.from(foundDevices).sort());
      setData(sortedData);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch device power data', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/device-power/download/csv`;
  };

  const downloadXlsx = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/device-power/download/xlsx`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Appliance Power Breakdown</h1>
          <p className="text-gray-400 mt-1">Per-device active power (kW) over time</p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={downloadCsv}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors border border-slate-700"
          >
            <Download size={18} />
            <span>Export Wide CSV</span>
          </button>
          <button 
            onClick={downloadXlsx}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Download size={18} />
            <span>Export Wide XLSX</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h2 className="text-xl font-semibold text-white">Appliance Consumption</h2>
          
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input 
                type="text" 
                placeholder="Search devices..." 
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button className="flex items-center justify-center bg-slate-800 border border-slate-700 rounded-lg w-10 h-10 text-gray-400 hover:text-white transition-colors">
              <Filter size={16} />
            </button>
          </div>
        </div>
        
        {loading && data.length === 0 ? (
          <div className="h-[500px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : error ? (
          <div className="h-[500px] flex items-center justify-center text-red-400">
            {error}
          </div>
        ) : (
          <div className="h-[500px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis 
                  dataKey="timeFormatted" 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(value) => `${value} kW`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ fontSize: '13px', paddingTop: '4px' }}
                  labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontWeight: 'bold' }}
                  formatter={(value: number, name: string) => [`${(value || 0).toFixed(3)} kW`, name]}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                
                {devices.map((device, index) => (
                  <Line 
                    key={device}
                    type="monotone" 
                    dataKey={device}
                    name={device}
                    stroke={COLORS[index % COLORS.length]} 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
