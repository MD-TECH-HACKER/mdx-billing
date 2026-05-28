import React, { useEffect, useState } from 'react';
import { 
  Loader2, Search, Store, MoreHorizontal, Filter, AlertTriangle, 
  CheckCircle2, Ban, X, ArrowUpRight, TrendingUp, IndianRupee, MapPin, 
  Calendar, Eye
} from 'lucide-react';

export default function AdminShops() {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedShop, setSelectedShop] = useState(null);

  useEffect(() => {
    fetch('/api/admin/shops')
      .then(res => res.json())
      .then(data => {
        if(data.shops) setShops(data.shops);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const filteredShops = shops.filter(s => {
    const matchesSearch = (s.shop_name || "").toLowerCase().includes(search.toLowerCase()) || 
                          (s.owner_email || "").toLowerCase().includes(search.toLowerCase());
    
    // Mock status logic since actual db might not have status column yet
    const isSuspended = (s.shop_name || "").toLowerCase().includes("suspended");
    const status = isSuspended ? "suspended" : "active";
    
    const matchesStatus = statusFilter === "all" || status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ animation: "fadeIn 0.5s ease" }}>
      {/* Shop Details Modal */}
      {selectedShop && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(4px)", animation: "fadeIn 0.2s ease"
        }}>
          <div style={{
            background: "var(--bg-surface, #ffffff)", width: "100%", maxWidth: "600px",
            borderRadius: "20px", overflow: "hidden", boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
            animation: "slideUp 0.3s ease"
          }}>
            <div style={{ 
              padding: "24px", borderBottom: "1px solid var(--border, #E5E7EB)",
              display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-elev, #F9FAFB)" 
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {selectedShop.shop_logo ? (
                  <img src={selectedShop.shop_logo} alt="logo" style={{ width: "48px", height: "48px", borderRadius: "12px", objectFit: "cover", border: "1px solid var(--border)" }} />
                ) : (
                  <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(139, 92, 246, 0.1)", color: "#8B5CF6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Store size={24} />
                  </div>
                )}
                <div>
                  <h2 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 700, color: "var(--text)" }}>{selectedShop.shop_name}</h2>
                  <p style={{ margin: 0, fontSize: "14px", color: "var(--text-dim)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Store size={14} /> Shop ID: {selectedShop.shop_id}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedShop(null)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: "8px", borderRadius: "50%" }}>
                <X size={24} />
              </button>
            </div>
            
            <div style={{ padding: "24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
                <div style={{ background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "12px", padding: "16px" }}>
                  <div style={{ color: "#10B981", display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontWeight: 600, fontSize: "14px" }}>
                    <IndianRupee size={16} /> Total Revenue
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--text)" }}>₹{parseFloat(selectedShop.total_revenue || 0).toLocaleString()}</div>
                </div>
                <div style={{ background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: "12px", padding: "16px" }}>
                  <div style={{ color: "#3B82F6", display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontWeight: 600, fontSize: "14px" }}>
                    <TrendingUp size={16} /> Total Sales
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--text)" }}>{selectedShop.sales_count || 0}</div>
                </div>
              </div>

              <h4 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 600, color: "var(--text)" }}>Shop Details</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px", background: "var(--bg-elev)", borderRadius: "8px", fontSize: "14px" }}>
                  <span style={{ color: "var(--text-dim)", display: "flex", alignItems: "center", gap: "8px" }}><MapPin size={16}/> Owner</span>
                  <span style={{ fontWeight: 500, color: "var(--text)" }}>{selectedShop.owner_name} ({selectedShop.owner_email})</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px", background: "var(--bg-elev)", borderRadius: "8px", fontSize: "14px" }}>
                  <span style={{ color: "var(--text-dim)", display: "flex", alignItems: "center", gap: "8px" }}><Calendar size={16}/> Created On</span>
                  <span style={{ fontWeight: 500, color: "var(--text)" }}>{new Date(selectedShop.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button style={{ flex: 1, padding: "12px", background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text)", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "pointer" }}>
                  <Eye size={18} /> View Raw Data
                </button>
                <button style={{ flex: 1, padding: "12px", background: "rgba(220, 38, 38, 0.1)", border: "1px solid rgba(220, 38, 38, 0.3)", borderRadius: "8px", color: "#DC2626", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "pointer" }}>
                  <Ban size={18} /> Suspend Shop
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ margin: "0 0 8px", fontSize: "28px", fontWeight: 800, letterSpacing: "-0.02em" }}>
            Shop Fleet Management
          </h1>
          <p style={{ margin: 0, color: "var(--text-dim, #6B7280)", fontSize: "15px" }}>
            Monitor and administer all business entities registered on the platform.
          </p>
        </div>
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
            placeholder="Search by shop name or owner email..." 
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "12px 32px 12px 16px", borderRadius: "10px", border: "1px solid var(--border)",
              background: "var(--bg-elev)", fontSize: "14px", color: "var(--text)", outline: "none", cursor: "pointer",
              appearance: "none"
            }}
          >
            <option value="all">All Shops</option>
            <option value="active">Active Status</option>
            <option value="suspended">Suspended</option>
          </select>
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
            <Loader2 size={40} style={{ animation: "spin 1s linear infinite", color: "#F97316" }} />
            <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>Loading fleet data...</span>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border, #E5E7EB)", background: "var(--bg-elev, #F9FAFB)" }}>
                  <th style={{ padding: "16px 24px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Shop Info</th>
                  <th style={{ padding: "16px 24px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Owner</th>
                  <th style={{ padding: "16px 24px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</th>
                  <th style={{ padding: "16px 24px", textAlign: "right", fontSize: "12px", fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Metrics</th>
                  <th style={{ padding: "16px 24px", textAlign: "center", fontSize: "12px", fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredShops.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "64px", textAlign: "center", color: "var(--text-dim)" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                        <Store size={48} style={{ opacity: 0.2 }} />
                        <span style={{ fontSize: "16px", fontWeight: 500 }}>No shops match your filters.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredShops.map(shop => {
                    const isSuspended = (shop.shop_name || "").toLowerCase().includes("suspended");
                    return (
                      <tr key={shop.shop_id} style={{ borderBottom: "1px solid var(--border, #E5E7EB)", transition: "background 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elev, #F9FAFB)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "16px 24px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                            {shop.shop_logo ? (
                              <img src={shop.shop_logo} alt="" style={{ width: "48px", height: "48px", borderRadius: "12px", objectFit: "cover", border: "1px solid var(--border)" }} />
                            ) : (
                              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(139, 92, 246, 0.1)", color: "#8B5CF6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Store size={24} />
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "15px", color: "var(--text)", marginBottom: "4px" }}>{shop.shop_name}</div>
                              <div style={{ fontSize: "12px", color: "var(--text-dim)", display: "flex", alignItems: "center", gap: "4px" }}>
                                <Calendar size={12} /> {new Date(shop.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "16px 24px" }}>
                          <div style={{ fontWeight: 500, fontSize: "14px", color: "var(--text)" }}>{shop.owner_name}</div>
                          <div style={{ fontSize: "13px", color: "var(--text-dim)" }}>{shop.owner_email}</div>
                        </td>
                        <td style={{ padding: "16px 24px" }}>
                          {isSuspended ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "20px", background: "rgba(220, 38, 38, 0.1)", color: "#DC2626", fontSize: "12px", fontWeight: 600 }}>
                              <Ban size={14} /> Suspended
                            </span>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "20px", background: "rgba(16, 185, 129, 0.1)", color: "#10B981", fontSize: "12px", fontWeight: 600 }}>
                              <CheckCircle2 size={14} /> Active
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "16px 24px", textAlign: "right" }}>
                          <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--text)", marginBottom: "4px" }}>₹{parseFloat(shop.total_revenue || 0).toLocaleString()}</div>
                          <div style={{ fontSize: "13px", color: "var(--text-dim)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }}>
                            <TrendingUp size={12} /> {shop.sales_count || 0} sales
                          </div>
                        </td>
                        <td style={{ padding: "16px 24px", textAlign: "center" }}>
                          <button 
                            onClick={() => setSelectedShop(shop)}
                            style={{ background: "var(--bg-elev)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text)", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, transition: "all 0.2s" }} 
                            onMouseEnter={(e) => { e.currentTarget.style.background = "#F97316"; e.currentTarget.style.color = "white"; e.currentTarget.style.borderColor = "#F97316"; }} 
                            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-elev)"; e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
