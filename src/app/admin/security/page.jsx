import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, ShieldAlert, Key, Globe, Lock, Unlock, 
  Settings, AlertTriangle, Fingerprint, Eye, EyeOff, Save,
  RefreshCw, CheckCircle2, Shield, Activity, Network, Loader2
} from 'lucide-react';

const Toggle = ({ enabled, onChange, disabled }) => (
  <button 
    onClick={onChange}
    disabled={disabled}
    style={{
      width: "44px", height: "24px", borderRadius: "12px",
      background: enabled ? "#10B981" : "var(--border, #E5E7EB)",
      border: "none", cursor: disabled ? "not-allowed" : "pointer", position: "relative",
      transition: "background 0.3s ease", opacity: disabled ? 0.5 : 1
    }}
  >
    <div style={{
      position: "absolute", top: "2px", left: enabled ? "22px" : "2px",
      width: "20px", height: "20px", borderRadius: "50%", background: "white",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)", transition: "left 0.3s ease"
    }}/>
  </button>
);

const SecuritySection = ({ icon: Icon, title, description, children, color = "#F97316" }) => (
  <div style={{
    background: "var(--bg-surface, #ffffff)",
    borderRadius: "16px",
    border: "1px solid var(--border, #E5E7EB)",
    padding: "32px",
    marginBottom: "24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  }}>
    <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "24px", borderBottom: "1px solid var(--border, #E5E7EB)", paddingBottom: "24px" }}>
      <div style={{ background: `${color}1A`, color: color, padding: "12px", borderRadius: "12px" }}>
        <Icon size={24} />
      </div>
      <div>
        <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 700, color: "var(--text)" }}>{title}</h3>
        <p style={{ margin: 0, fontSize: "14px", color: "var(--text-dim)", lineHeight: 1.5, maxWidth: "600px" }}>{description}</p>
      </div>
    </div>
    {children}
  </div>
);

export default function AdminSecurity() {
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [toastType, setToastType] = useState("success");
  const [hasChanges, setHasChanges] = useState(false);
  
  // Security States
  const [securitySettings, setSecuritySettings] = useState({
    cloudflareTurnstile: true,
    rateLimiting: true,
    blockTorExitNodes: false,
    maxLoginAttempts: 5,
    sessionTimeoutMins: 120,
    twoFactorEnforcement: "none"
  });

  const [bannedIps, setBannedIps] = useState([]);
  const [newIp, setNewIp] = useState("");
  const [banLoading, setBanLoading] = useState(false);

  const showToast = (message, type = "success") => {
    setToast(message);
    setToastType(type);
    setTimeout(() => setToast(null), 3000);
  };

  // Load settings from API on mount
  useEffect(() => {
    fetch('/api/admin/security')
      .then(r => r.json())
      .then(data => {
        if (data.settings) setSecuritySettings(data.settings);
        if (data.bannedIps) setBannedIps(data.bannedIps);
      })
      .catch(() => showToast("Failed to load security settings", "error"))
      .finally(() => setPageLoading(false));
  }, []);

  const updateSetting = (key, value) => {
    setSecuritySettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const toggleSetting = (key) => {
    updateSetting(key, !securitySettings[key]);
  };

  // Save all settings to the database
  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_settings', settings: securitySettings })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      showToast(data.message || "Security settings saved successfully.");
      setHasChanges(false);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Ban IP via API
  const handleAddIp = async (e) => {
    e.preventDefault();
    if (!newIp) return;
    setBanLoading(true);
    try {
      const res = await fetch('/api/admin/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ban_ip', ip: newIp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ban failed');
      setBannedIps(prev => [newIp, ...prev]);
      setNewIp("");
      showToast(data.message || `IP ${newIp} banned successfully.`);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBanLoading(false);
    }
  };

  // Unban IP via API
  const handleRemoveIp = async (ip) => {
    try {
      const res = await fetch('/api/admin/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unban_ip', ip })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unban failed');
      setBannedIps(prev => prev.filter(i => i !== ip));
      showToast(data.message || `IP ${ip} unbanned.`);
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  if (pageLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
        <Loader2 size={32} className="animate-spin" style={{ color: "var(--text-dim)" }} />
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeIn 0.5s ease" }}>
      {toast && (
        <div style={{
          position: "fixed", top: "24px", right: "24px", zIndex: 9999,
          background: toastType === "error" ? "#DC2626" : "#10B981", color: "white", padding: "12px 24px", borderRadius: "8px",
          fontWeight: 600, fontSize: "14px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
          display: "flex", alignItems: "center", gap: "8px", animation: "fadeInDown 0.3s ease"
        }}>
          {toastType === "error" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />} {toast}
        </div>
      )}

      <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ margin: "0 0 8px", fontSize: "28px", fontWeight: 800, letterSpacing: "-0.02em" }}>
            Security & Firewall
          </h1>
          <p style={{ margin: 0, color: "var(--text-dim, #6B7280)", fontSize: "15px" }}>
            Configure platform-wide security policies, rate limits, and WAF rules.
          </p>
        </div>
        <button 
          onClick={handleSave}
          disabled={loading || !hasChanges}
          style={{
            background: hasChanges ? "#111827" : "#6B7280",
            color: "white",
            border: "none",
            padding: "12px 24px",
            borderRadius: "10px",
            fontWeight: 600,
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: (loading || !hasChanges) ? "not-allowed" : "pointer",
            opacity: hasChanges ? 1 : 0.6,
            transition: "all 0.2s"
          }}
        >
          {loading ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
          {hasChanges ? "Save Configuration" : "Settings Saved"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px" }}>
        
        {/* Anti-Bot & WAF */}
        <SecuritySection icon={ShieldAlert} title="Web Application Firewall (WAF) & Anti-Bot" description="Protect the billing platform from DDoS attacks, brute force login attempts, and malicious bots." color="#8B5CF6">
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h4 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 600, color: "var(--text)" }}>Cloudflare Turnstile (Captcha)</h4>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-dim)" }}>Require bot verification on login, signup, and password reset forms.</p>
              </div>
              <Toggle enabled={securitySettings.cloudflareTurnstile} onChange={() => toggleSetting('cloudflareTurnstile')} />
            </div>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h4 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 600, color: "var(--text)" }}>Global Rate Limiting</h4>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-dim)" }}>Limit API requests to 100 per IP address per minute to prevent abuse.</p>
              </div>
              <Toggle enabled={securitySettings.rateLimiting} onChange={() => toggleSetting('rateLimiting')} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h4 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 600, color: "var(--text)" }}>Block Tor Exit Nodes</h4>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-dim)" }}>Automatically block incoming requests from known Tor network exit nodes.</p>
              </div>
              <Toggle enabled={securitySettings.blockTorExitNodes} onChange={() => toggleSetting('blockTorExitNodes')} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "20px" }}>
              <div>
                <h4 style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 600, color: "var(--text)" }}>Maximum Login Attempts</h4>
                <p style={{ margin: "0 0 12px", fontSize: "13px", color: "var(--text-dim)" }}>Number of failed attempts before an IP is temporarily locked out (15 mins).</p>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <input 
                    type="range" 
                    min="3" max="10" 
                    value={securitySettings.maxLoginAttempts}
                    onChange={(e) => updateSetting('maxLoginAttempts', parseInt(e.target.value))}
                    style={{ width: "200px" }}
                  />
                  <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)" }}>{securitySettings.maxLoginAttempts} attempts</span>
                </div>
              </div>
            </div>
          </div>
        </SecuritySection>

        {/* Access & Sessions */}
        <SecuritySection icon={Key} title="Authentication & Session Policies" description="Control how users authenticate and how long their sessions remain active." color="#3B82F6">
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div>
              <h4 style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 600, color: "var(--text)" }}>Two-Factor Authentication (2FA) Enforcement</h4>
              <p style={{ margin: "0 0 12px", fontSize: "13px", color: "var(--text-dim)" }}>Determine which user tiers must have 2FA enabled to access the platform.</p>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                {[
                  { id: "none", label: "Optional for all" },
                  { id: "admins_only", label: "Enforced for Admins Only" },
                  { id: "all", label: "Enforced for Everyone" }
                ].map(opt => (
                  <label key={opt.id} style={{
                    display: "flex", alignItems: "center", gap: "8px", padding: "12px 16px", 
                    border: `1px solid ${securitySettings.twoFactorEnforcement === opt.id ? "#3B82F6" : "var(--border)"}`, 
                    borderRadius: "8px", cursor: "pointer", 
                    background: securitySettings.twoFactorEnforcement === opt.id ? "rgba(59, 130, 246, 0.05)" : "var(--bg-surface)",
                    transition: "all 0.2s"
                  }}>
                    <input 
                      type="radio" 
                      name="2fa" 
                      checked={securitySettings.twoFactorEnforcement === opt.id}
                      onChange={() => updateSetting('twoFactorEnforcement', opt.id)}
                      style={{ accentColor: "#3B82F6" }}
                    />
                    <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text)" }}>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
              <h4 style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 600, color: "var(--text)" }}>Session Timeout Duration</h4>
              <p style={{ margin: "0 0 12px", fontSize: "13px", color: "var(--text-dim)" }}>Automatically log out inactive users after this amount of time.</p>
              <select 
                value={securitySettings.sessionTimeoutMins}
                onChange={(e) => updateSetting('sessionTimeoutMins', parseInt(e.target.value))}
                style={{
                  padding: "10px 16px", borderRadius: "8px", border: "1px solid var(--border)",
                  background: "var(--bg-elev)", fontSize: "14px", color: "var(--text)", outline: "none", width: "100%", maxWidth: "300px"
                }}
              >
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={60}>1 Hour</option>
                <option value={120}>2 Hours</option>
                <option value={1440}>24 Hours</option>
                <option value={10080}>7 Days</option>
              </select>
            </div>
          </div>
        </SecuritySection>

        {/* IP Ban List */}
        <SecuritySection icon={Network} title="IP Address Ban List" description="Manually block specific IP addresses from accessing any part of the platform." color="#DC2626">
          <div style={{ background: "var(--bg-elev)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border)" }}>
            <form onSubmit={handleAddIp} style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
              <input 
                type="text" 
                placeholder="Enter IP address (e.g., 192.168.1.1)" 
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
                style={{
                  flex: 1, padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--border)",
                  background: "var(--bg-surface)", fontSize: "14px", outline: "none"
                }}
              />
              <button 
                type="submit"
                disabled={!newIp || banLoading}
                style={{
                  padding: "12px 24px", background: "#DC2626", color: "white", border: "none", 
                  borderRadius: "8px", fontWeight: 600, fontSize: "14px", 
                  cursor: (!newIp || banLoading) ? "not-allowed" : "pointer",
                  opacity: (!newIp || banLoading) ? 0.5 : 1,
                  display: "flex", alignItems: "center", gap: "8px"
                }}
              >
                {banLoading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                Ban IP
              </button>
            </form>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {bannedIps.length === 0 ? (
                <p style={{ margin: 0, fontSize: "14px", color: "var(--text-dim)", textAlign: "center", padding: "20px" }}>No IP addresses currently banned.</p>
              ) : (
                bannedIps.map(ip => (
                  <div key={ip} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <Globe size={16} color="#DC2626" />
                      <span style={{ fontSize: "14px", fontFamily: "monospace", color: "var(--text)" }}>{ip}</span>
                    </div>
                    <button 
                      onClick={() => handleRemoveIp(ip)}
                      style={{ background: "transparent", border: "none", color: "#DC2626", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}
                    >
                      Unban
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </SecuritySection>

      </div>
    </div>
  );
}
