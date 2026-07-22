'use client';

import { useState, useEffect } from 'react';
import { Download, Activity, Zap, Clock } from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart 
} from 'recharts';
import api from '@/services/api';

export default function HomePowerDashboard() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Calculate stats from data
  const latestKw = data.length > 0 ? data[data.length - 1].total_home_power_consumption_kw : 0;
  const maxKw = data.length > 0 ? Math.max(...data.map(d => d.total_home_power_consumption_kw)) : 0;
  const avgKw = data.length > 0 ? data.reduce((sum, d) => sum + d.total_home_power_consumption_kw, 0) / data.length : 0;

  useEffect(() => {
    fetchData();
    // Poll every 15 seconds
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      // Get last 24 hours of data roughly
      const res = await api.getHomePowerHistory({ per_page: 100 }) as any;
      // Sort ascending for charts
      const sortedData = res.records.sort((a: any, b: any) => 
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Home Power Analytics</h1>
          <p className="text-gray-400 mt-1">Total electricity consumption time-series</p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={downloadCsv}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors border border-slate-700"
          >
            <Download size={18} />
            <span>Export CSV</span>
          </button>
          <button 
            onClick={downloadXlsx}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Download size={18} />
            <span>Export XLSX</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Activity size={64} />
          </div>
          <div className="flex items-center gap-3 text-emerald-400 mb-2">
            <Activity size={20} />
            <h3 className="font-medium">Current Draw</h3>
          </div>
          <div className="text-4xl font-bold text-white mt-4">
            {latestKw.toFixed(2)} <span className="text-xl text-gray-500 font-normal">kW</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Zap size={64} />
          </div>
          <div className="flex items-center gap-3 text-amber-400 mb-2">
            <Zap size={20} />
            <h3 className="font-medium">Peak Demand (24h)</h3>
          </div>
          <div className="text-4xl font-bold text-white mt-4">
            {maxKw.toFixed(2)} <span className="text-xl text-gray-500 font-normal">kW</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Clock size={64} />
          </div>
          <div className="flex items-center gap-3 text-blue-400 mb-2">
            <Clock size={20} />
            <h3 className="font-medium">Average (24h)</h3>
          </div>
          <div className="text-4xl font-bold text-white mt-4">
            {avgKw.toFixed(2)} <span className="text-xl text-gray-500 font-normal">kW</span>
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">Power Consumption Trend</h2>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
            <span className="text-sm text-gray-400">Live</span>
          </div>
        </div>
        
        {loading && data.length === 0 ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : error ? (
          <div className="h-[400px] flex items-center justify-center text-red-400">
            {error}
          </div>
        ) : (
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorKw" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
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
                  itemStyle={{ color: '#10b981' }}
                  labelStyle={{ color: '#94a3b8', marginBottom: '8px' }}
                  formatter={(value: any) => [`${Number(value).toFixed(3)} kW`, 'Total Power']}
                />
                <Area 
                  type="monotone" 
                  dataKey="total_home_power_consumption_kw" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorKw)" 
                  activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
