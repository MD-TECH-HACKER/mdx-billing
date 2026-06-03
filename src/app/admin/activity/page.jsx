import React, { useState, useEffect } from 'react';
import { 
  Activity, Search, Filter, Calendar, ChevronLeft, ChevronRight, 
  Download, Clock, User, Tag, ArrowRight, ShieldAlert,
  Terminal, ShieldCheck, CreditCard, ShoppingCart
} from 'lucide-react';

const MOCK_LOGS = [
  { id: "log_1", action: "shop.create", user: "m.dharaaneesh123@gmail.com", target: "Shop #1042", ip: "192.168.1.104", timestamp: "2026-05-28T10:15:00Z", type: "system", status: "success" },
  { id: "log_2", action: "auth.login.failed", user: "unknown", target: "m.dharaaneesh123@gmail.com", ip: "45.22.19.1", timestamp: "2026-05-28T09:42:11Z", type: "security", status: "failure" },
  { id: "log_3", action: "sale.create", user: "user@demo.com", target: "Receipt INV-1002", ip: "10.0.0.5", timestamp: "2026-05-28T08:30:00Z", type: "business", status: "success" },
  { id: "log_4", action: "system.export", user: "m.dharaaneesh123@gmail.com", target: "Database (Full)", ip: "192.168.1.104", timestamp: "2026-05-27T18:20:00Z", type: "system", status: "success" },
  { id: "log_5", action: "auth.password_reset", user: "customer@gmail.com", target: "User Account", ip: "172.16.0.4", timestamp: "2026-05-27T14:10:00Z", type: "security", status: "success" },
  { id: "log_6", action: "shop.update", user: "owner@shop.com", target: "Shop Settings", ip: "8.8.8.8", timestamp: "2026-05-26T11:05:00Z", type: "system", status: "success" },
  { id: "log_7", action: "api.unauthorized_access", user: "anonymous", target: "/api/admin/users", ip: "103.45.67.89", timestamp: "2026-05-26T02:15:00Z", type: "security", status: "failure" },
  { id: "log_8", action: "product.delete", user: "manager@shop.com", target: "Product #992", ip: "192.168.1.50", timestamp: "2026-05-25T16:45:00Z", type: "business", status: "success" },
];

const ActionIcon = ({ type, status }) => {
  if (status === "failure") return <div style={{ background: "rgba(220, 38, 38, 0.1)", color: "#DC2626", padding: "8px", borderRadius: "8px" }}><ShieldAlert size={16} /></div>;
  if (type === "security") return <div style={{ background: "rgba(59, 130, 246, 0.1)", color: "#3B82F6", padding: "8px", borderRadius: "8px" }}><ShieldCheck size={16} /></div>;
  if (type === "system") return <div style={{ background: "rgba(139, 92, 246, 0.1)", color: "#8B5CF6", padding: "8px", borderRadius: "8px" }}><Terminal size={16} /></div>;
  if (type === "business") return <div style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10B981", padding: "8px", borderRadius: "8px" }}><ShoppingCart size={16} /></div>;
  return <div style={{ background: "var(--bg-elev)", color: "var(--text-dim)", padding: "8px", borderRadius: "8px" }}><Activity size={16} /></div>;
};

export default function AdminActivity() {
  const [logs, setLogs] = useState(MOCK_LOGS);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [page, setPage] = useState(1);

  // Simulate loading delay for realism
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(search.toLowerCase()) || 
                          log.user.toLowerCase().includes(search.toLowerCase()) ||
                          log.target.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === "all" || log.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div style={{ animation: "fadeIn 0.5s ease" }}>
      <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ margin: "0 0 8px", fontSize: "28px", fontWeight: 800, letterSpacing: "-0.02em" }}>
            Audit & Activity Logs
          </h1>
          <p style={{ margin: 0, color: "var(--text-dim, #6B7280)", fontSize: "15px" }}>
            Track every action taken across the entire MDX Billing platform in real-time.
          </p>
        </div>
        <button style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          padding: "10px 16px",
          borderRadius: "8px",
          fontWeight: 600,
          fontSize: "14px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          cursor: "pointer",
          transition: "all 0.2s"
        }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elev)"} onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-surface)"}>
          <Download size={16} /> Export Logs (CSV)
        </button>
      </div>

      <div style={{ 
        background: "var(--bg-surface, #ffffff)", 
        padding: "20px", 
        borderRadius: "16px", 
        border: "1px solid var(--border, #E5E7EB)",
        marginBottom: "24px",
        display: "flex",
        gap: "16px",
        alignItems: "center",
        flexWrap: "wrap"
      }}>
        <div style={{ position: "relative", flex: "1 1 300px" }}>
          <Search size={18} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
          <input 
            type="text" 
            placeholder="Search by user email, action, or target..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", boxSizing: "border-box", padding: "12px 14px 12px 42px",
              borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg-elev)",
              fontSize: "14px", outline: "none", transition: "border-color 0.2s"
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = "#F97316"}
            onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Filter size={18} style={{ color: "var(--text-dim)" }} />
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              padding: "12px 32px 12px 16px", borderRadius: "10px", border: "1px solid var(--border)",
              background: "var(--bg-elev)", fontSize: "14px", color: "var(--text)", outline: "none", cursor: "pointer",
              appearance: "none"
            }}
          >
            <option value="all">All Event Types</option>
            <option value="security">Security Events</option>
            <option value="system">System Actions</option>
            <option value="business">Business Operations</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Calendar size={18} style={{ color: "var(--text-dim)" }} />
          <input 
            type="date"
            style={{
              padding: "11px 16px", borderRadius: "10px", border: "1px solid var(--border)",
              background: "var(--bg-elev)", fontSize: "14px", color: "var(--text-dim)", outline: "none"
            }}
          />
        </div>
      </div>

      <div style={{
        background: "var(--bg-surface, #ffffff)",
        borderRadius: "16px",
        border: "1px solid var(--border, #E5E7EB)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        overflow: "hidden"
      }}>
        {loading ? (
          <div style={{ padding: "80px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
            <div className="animate-spin"><Activity size={40} color="#F97316" /></div>
            <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>Fetching audit logs...</span>
          </div>
        ) : (
          <div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1000px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border, #E5E7EB)", background: "var(--bg-elev, #F9FAFB)" }}>
                    <th style={{ padding: "16px 24px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Event & Time</th>
                    <th style={{ padding: "16px 24px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Actor</th>
                    <th style={{ padding: "16px 24px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Action</th>
                    <th style={{ padding: "16px 24px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Target Resource</th>
                    <th style={{ padding: "16px 24px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: "64px", textAlign: "center", color: "var(--text-dim)" }}>
                        No logs match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map(log => {
                      const date = new Date(log.timestamp);
                      return (
                        <tr key={log.id} style={{ borderBottom: "1px solid var(--border, #E5E7EB)", transition: "background 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elev, #F9FAFB)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                          <td style={{ padding: "16px 24px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                              <ActionIcon type={log.type} status={log.status} />
                              <div>
                                <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)", marginBottom: "4px" }}>
                                  {log.type.charAt(0).toUpperCase() + log.type.slice(1)} Event
                                </div>
                                <div style={{ fontSize: "12px", color: "var(--text-dim)", display: "flex", alignItems: "center", gap: "4px" }}>
                                  <Clock size={12} /> {date.toLocaleDateString()} at {date.toLocaleTimeString()}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "16px 24px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--text)", fontWeight: 500 }}>
                              <User size={14} color="var(--text-dim)" /> {log.user}
                            </div>
                          </td>
                          <td style={{ padding: "16px 24px" }}>
                            <span style={{ 
                              display: "inline-block", padding: "4px 10px", borderRadius: "6px", 
                              background: "var(--bg-elev)", border: "1px solid var(--border)", 
                              fontSize: "13px", fontFamily: "monospace", color: "var(--text)" 
                            }}>
                              {log.action}
                            </span>
                          </td>
                          <td style={{ padding: "16px 24px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--text)" }}>
                              <Tag size={14} color="var(--text-dim)" /> {log.target}
                            </div>
                          </td>
                          <td style={{ padding: "16px 24px" }}>
                            <span style={{ fontSize: "13px", color: "var(--text-dim)", fontFamily: "monospace" }}>{log.ip}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: "14px", color: "var(--text-dim)" }}>
                Showing 1 to {filteredLogs.length} of {filteredLogs.length} entries
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button disabled style={{ padding: "8px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-dim)", cursor: "not-allowed", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ChevronLeft size={18} />
                </button>
                <button style={{ padding: "8px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "var(--bg-elev)"} onMouseLeave={e => e.currentTarget.style.background = "var(--bg-surface)"}>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
