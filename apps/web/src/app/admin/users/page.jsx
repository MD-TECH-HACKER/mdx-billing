import React, { useEffect, useState } from 'react';
import { Loader2, Search, User, MoreHorizontal, ShieldCheck } from 'lucide-react';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openActionId, setOpenActionId] = useState(null);
  const [modalMessage, setModalMessage] = useState(null);

  useEffect(() => {
    fetch('/api/admin/users')
      .then(res => res.json())
      .then(data => {
        if(data.users) setUsers(data.users);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const filteredUsers = users.filter(u => 
    (u.name || "").toLowerCase().includes(search.toLowerCase()) || 
    (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ animation: "fadeIn 0.5s ease" }}>
      {/* Custom Alert Modal */}
      {modalMessage && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(4px)", animation: "fadeIn 0.2s ease"
        }}>
          <div style={{
            background: "var(--bg-surface, #ffffff)", width: "100%", maxWidth: "400px",
            borderRadius: "16px", padding: "24px", boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
            animation: "slideUp 0.3s ease", textAlign: "center"
          }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "18px", fontWeight: 700, color: "var(--text)" }}>Notice</h3>
            <p style={{ margin: "0 0 24px", color: "var(--text-dim)", fontSize: "15px" }}>{modalMessage}</p>
            <button 
              onClick={() => setModalMessage(null)}
              style={{ width: "100%", padding: "12px", background: "#F97316", color: "white", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>
              OK
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ margin: "0 0 8px", fontSize: "28px", fontWeight: 800, letterSpacing: "-0.02em" }}>
            User Management
          </h1>
          <p style={{ margin: 0, color: "var(--text-dim, #6B7280)", fontSize: "15px" }}>
            View and manage all registered platform users.
          </p>
        </div>
        <div style={{ position: "relative", width: "100%", maxWidth: "320px" }}>
          <Search size={18} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-dim, #6B7280)" }} />
          <input 
            type="text" 
            placeholder="Search users..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px 14px 12px 42px",
              borderRadius: "12px",
              border: "1px solid var(--border, #E5E7EB)",
              background: "var(--bg-surface, #ffffff)",
              fontSize: "14px",
              outline: "none",
              transition: "border-color 0.2s"
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = "#F97316"}
            onBlur={(e) => e.currentTarget.style.borderColor = "var(--border, #E5E7EB)"}
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
          <div style={{ padding: "64px", display: "flex", justifyContent: "center" }}>
            <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "#F97316" }} />
          </div>
        ) : (
          <div style={{ width: "100%", overflow: "visible" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border, #E5E7EB)", background: "var(--bg-elev, #F9FAFB)" }}>
                  <th style={{ padding: "16px 24px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--text-dim, #6B7280)", textTransform: "uppercase", letterSpacing: "0.05em" }}>User</th>
                  <th style={{ padding: "16px 24px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "var(--text-dim, #6B7280)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Role</th>
                  <th style={{ padding: "16px 24px", textAlign: "right", fontSize: "12px", fontWeight: 600, color: "var(--text-dim, #6B7280)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Shops</th>
                  <th style={{ padding: "16px 24px", textAlign: "right", fontSize: "12px", fontWeight: 600, color: "var(--text-dim, #6B7280)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Sales Made</th>
                  <th style={{ padding: "16px 24px", textAlign: "center", fontSize: "12px", fontWeight: 600, color: "var(--text-dim, #6B7280)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "48px", textAlign: "center", color: "var(--text-dim)" }}>
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => {
                    const isOwner = user.email.toLowerCase() === "m.dharaaneesh123@gmail.com"; // Hardcoded visual check for primary owner
                    return (
                      <tr key={user.id} style={{ borderBottom: "1px solid var(--border, #E5E7EB)", transition: "background 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elev, #F9FAFB)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "16px 24px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                            {user.image ? (
                              <img src={user.image} alt="" style={{ width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border, #E5E7EB)" }} />
                            ) : (
                              <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "var(--bg-elev, #F3F4F6)", border: "1px solid var(--border, #E5E7EB)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)" }}>
                                <User size={20} />
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)" }}>{user.display_name || user.name || "Unknown User"}</div>
                              <div style={{ fontSize: "13px", color: "var(--text-dim, #6B7280)" }}>{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "16px 24px" }}>
                          {isOwner ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 12px", borderRadius: "20px", background: "rgba(249, 115, 22, 0.1)", color: "#F97316", fontSize: "12px", fontWeight: 600, border: "1px solid rgba(249, 115, 22, 0.2)" }}>
                              <ShieldCheck size={14} /> Platform Owner
                            </span>
                          ) : (
                            <span style={{ padding: "4px 12px", borderRadius: "20px", background: "var(--bg-elev, #F3F4F6)", color: "var(--text-dim, #6B7280)", fontSize: "12px", fontWeight: 500, border: "1px solid var(--border, #E5E7EB)" }}>
                              Standard User
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "16px 24px", textAlign: "right", fontSize: "14px", fontWeight: 500, color: "var(--text)" }}>{user.shop_count || 0}</td>
                        <td style={{ padding: "16px 24px", textAlign: "right", fontSize: "14px", fontWeight: 500, color: "var(--text)" }}>{user.sales_count || 0}</td>
                        <td style={{ padding: "16px 24px", textAlign: "center", position: "relative" }}>
                          <button 
                            onClick={() => setOpenActionId(openActionId === user.id ? null : user.id)}
                            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: "8px", borderRadius: "8px", transition: "all 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elev, #F3F4F6)"; e.currentTarget.style.color = "var(--text)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}>
                            <MoreHorizontal size={20} />
                          </button>
                          {openActionId === user.id && (
                            <div style={{ position: "absolute", right: "24px", top: "100%", zIndex: 10, background: "var(--bg-surface, #ffffff)", border: "1px solid var(--border, #E5E7EB)", borderRadius: "8px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", minWidth: "150px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                              {!isOwner && (
                                <button style={{ width: "100%", padding: "10px 16px", background: "transparent", border: "none", borderBottom: "1px solid var(--border, #E5E7EB)", textAlign: "left", color: "#DC2626", cursor: "pointer", fontSize: "14px", fontWeight: 500 }} onClick={() => { setModalMessage("Ban user functionality coming soon"); setOpenActionId(null); }}>
                                  Ban User
                                </button>
                              )}
                              <button style={{ width: "100%", padding: "10px 16px", background: "transparent", border: "none", textAlign: "left", color: "var(--text, #111827)", cursor: "pointer", fontSize: "14px", fontWeight: 500 }} onClick={() => { setModalMessage("View Details coming soon"); setOpenActionId(null); }}>
                                View Details
                              </button>
                            </div>
                          )}
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
    </div>
  );
}
