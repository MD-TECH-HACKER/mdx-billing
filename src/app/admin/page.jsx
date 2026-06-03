import React, { useEffect, useState } from 'react';
import AdminStatCard from '@/components/admin/AdminStatCard';
import { Users, Store, Package, IndianRupee, Activity, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/overview')
      .then(res => res.json())
      .then(data => {
        if(data.stats) setStats(data.stats);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const chartData = stats?.growth || [];

  return (
    <div style={{ animation: "fadeIn 0.5s ease" }}>
      <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ margin: "0 0 8px", fontSize: "28px", fontWeight: 800, letterSpacing: "-0.02em" }}>
            Platform Overview
          </h1>
          <p style={{ margin: 0, color: "var(--text-dim, #6B7280)", fontSize: "15px" }}>
            Monitor key metrics, user growth, and total revenue across all shops.
          </p>
        </div>
        <div style={{ 
          background: "rgba(16, 185, 129, 0.1)", 
          color: "#10B981", 
          padding: "6px 12px", 
          borderRadius: "20px",
          fontSize: "13px",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: "6px"
        }}>
          <Activity size={14} /> System Healthy
        </div>
      </div>

      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", 
        gap: "24px",
        marginBottom: "32px"
      }}>
        <AdminStatCard 
          title="Total Users" 
          value={stats?.users || 0} 
          icon={Users} 
          color="#3B82F6" 
          loading={loading} 
        />
        <AdminStatCard 
          title="Total Shops" 
          value={stats?.shops || 0} 
          icon={Store} 
          color="#8B5CF6" 
          loading={loading} 
        />
        <AdminStatCard 
          title="Total Products" 
          value={stats?.products || 0} 
          icon={Package} 
          color="#F59E0B" 
          loading={loading} 
        />
        <AdminStatCard 
          title="Total Sales" 
          value={stats?.sales || 0} 
          icon={TrendingUp} 
          color="#10B981" 
          loading={loading} 
        />
        <AdminStatCard 
          title="Platform Revenue (INR)" 
          value={`₹${(stats?.revenue || 0).toLocaleString()}`} 
          icon={IndianRupee} 
          color="#F97316" 
          loading={loading} 
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px" }}>
        {/* Growth Chart */}
        <div style={{
          background: "var(--bg-surface, #ffffff)",
          borderRadius: "16px",
          padding: "24px",
          border: "1px solid var(--border, #E5E7EB)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <h3 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: 600 }}>User & Sales Growth (YTD)</h3>
          <div style={{ height: "300px", width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartData.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>
                  No growth data yet
                </div>
              ) : (
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border, #E5E7EB)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--text-dim, #6B7280)" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--text-dim, #6B7280)" }} dx={-10} />
                <Tooltip 
                  contentStyle={{ borderRadius: "10px", border: "1px solid var(--border, #E5E7EB)", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", background: "var(--bg-surface, #ffffff)" }}
                />
                <Area type="monotone" dataKey="sales" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                <Area type="monotone" dataKey="users" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
