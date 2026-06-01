import React, { useState } from 'react';
import { 
  Settings, Mail, Palette, Globe, Save, RefreshCw, 
  CheckCircle2, Building, MessageSquare, CreditCard,
  Bell, Smartphone
} from 'lucide-react';

const SettingsSection = ({ icon: Icon, title, description, children, color = "#F97316" }) => (
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

const InputGroup = ({ label, description, type = "text", value, onChange, placeholder }) => (
  <div style={{ marginBottom: "20px" }}>
    <label style={{ display: "block", margin: "0 0 6px", fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>{label}</label>
    {description && <p style={{ margin: "0 0 10px", fontSize: "13px", color: "var(--text-dim)" }}>{description}</p>}
    <input 
      type={type} 
      value={value} 
      onChange={onChange} 
      placeholder={placeholder}
      style={{
        width: "100%", maxWidth: "500px", padding: "12px 16px", borderRadius: "8px", 
        border: "1px solid var(--border)", background: "var(--bg-surface)", 
        fontSize: "14px", color: "var(--text)", outline: "none", boxSizing: "border-box",
        transition: "border-color 0.2s"
      }}
      onFocus={(e) => e.currentTarget.style.borderColor = "#F97316"}
      onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
    />
  </div>
);

const ToggleRow = ({ label, description, enabled, onChange }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: "1px solid var(--border)" }}>
    <div style={{ paddingRight: "20px" }}>
      <h4 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 600, color: "var(--text)" }}>{label}</h4>
      <p style={{ margin: 0, fontSize: "13px", color: "var(--text-dim)" }}>{description}</p>
    </div>
    <button 
      onClick={onChange}
      style={{
        width: "44px", height: "24px", borderRadius: "12px", flexShrink: 0,
        background: enabled ? "#10B981" : "var(--border, #E5E7EB)",
        border: "none", cursor: "pointer", position: "relative",
        transition: "background 0.3s ease"
      }}
    >
      <div style={{
        position: "absolute", top: "2px", left: enabled ? "22px" : "2px",
        width: "20px", height: "20px", borderRadius: "50%", background: "white",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)", transition: "left 0.3s ease"
      }}/>
    </button>
  </div>
);

export default function AdminSettings() {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const [settings, setSettings] = useState({
    platformName: "MDX Billing App",
    supportEmail: "support@mdx-billing.app",
    resendApiKey: "re_8o2HDAH2_HgStjKbLEKdQKitmWg2jmeuD",
    senderEmail: "receipts@mdxbilling.app",
    enableEmailReceipts: true,
    enableSmsNotifications: false,
    enableGstFeatures: true,
    allowNewSignups: true,
    maintenanceMode: false,
    currencyDefault: "INR",
  });

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      showToast("Platform settings saved successfully.");
    }, 1000);
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div style={{ animation: "fadeIn 0.5s ease", paddingBottom: "60px" }}>
      {toast && (
        <div style={{
          position: "fixed", top: "24px", right: "24px", zIndex: 9999,
          background: "#10B981", color: "white", padding: "12px 24px", borderRadius: "8px",
          fontWeight: 600, fontSize: "14px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
          display: "flex", alignItems: "center", gap: "8px", animation: "fadeInDown 0.3s ease"
        }}>
          <CheckCircle2 size={18} /> {toast}
        </div>
      )}

      <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ margin: "0 0 8px", fontSize: "28px", fontWeight: 800, letterSpacing: "-0.02em" }}>
            Platform Settings
          </h1>
          <p style={{ margin: 0, color: "var(--text-dim, #6B7280)", fontSize: "15px" }}>
            Configure global defaults, communication providers, and platform behaviors.
          </p>
        </div>
        <button 
          onClick={handleSave}
          disabled={loading}
          style={{
            background: "#F97316",
            color: "white",
            border: "none",
            padding: "12px 24px",
            borderRadius: "10px",
            fontWeight: 600,
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.2s"
          }}
          onMouseEnter={e => { if(!loading) e.currentTarget.style.background = "#EA580C" }}
          onMouseLeave={e => { if(!loading) e.currentTarget.style.background = "#F97316" }}
        >
          {loading ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
          Save Changes
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px" }}>
        
        {/* General Settings */}
        <SettingsSection icon={Building} title="General Information" description="Basic information about the platform displayed to all users." color="#3B82F6">
          <InputGroup 
            label="Platform Name" 
            value={settings.platformName} 
            onChange={(e) => handleChange("platformName", e.target.value)} 
          />
          <InputGroup 
            label="Support Email" 
            description="Where users should email if they encounter issues."
            value={settings.supportEmail} 
            onChange={(e) => handleChange("supportEmail", e.target.value)} 
          />
        </SettingsSection>

        {/* Email & Communication */}
        <SettingsSection icon={Mail} title="Email & Communication" description="Configure the Resend API for transactional emails." color="#8B5CF6">
          <InputGroup 
            label="Resend API Key" 
            type="password"
            value={settings.resendApiKey} 
            onChange={(e) => handleChange("resendApiKey", e.target.value)} 
          />
          <InputGroup 
            label="Default Sender Email" 
            description="The verified domain email address used for sending receipts."
            value={settings.senderEmail} 
            onChange={(e) => handleChange("senderEmail", e.target.value)} 
          />
          <div style={{ marginTop: "24px" }}>
            <ToggleRow 
              label="Enable Email Receipts" 
              description="Allow shops to send digital receipts to customers via email."
              enabled={settings.enableEmailReceipts} 
              onChange={() => handleChange("enableEmailReceipts", !settings.enableEmailReceipts)} 
            />
          </div>
        </SettingsSection>

        {/* Localization Settings */}
        <SettingsSection icon={Globe} title="Localization & Formats" description="Set regional defaults for new shops and users." color="#F59E0B">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <InputGroup 
              label="Default Currency" 
              value={settings.currencyDefault || "INR"} 
              onChange={(e) => handleChange("currencyDefault", e.target.value)} 
            />
            <InputGroup 
              label="Default Timezone" 
              value={settings.timezoneDefault || "Asia/Kolkata"} 
              onChange={(e) => handleChange("timezoneDefault", e.target.value)} 
            />
          </div>
        </SettingsSection>

        {/* Feature Toggles */}
        <SettingsSection icon={Settings} title="Platform Features" description="Enable or disable core functionalities platform-wide." color="#10B981">
          <div style={{ display: "flex", flexDirection: "column" }}>
            <ToggleRow 
              label="GST / Tax Features" 
              description="Enable Indian GST compliance features and reporting for all shops."
              enabled={settings.enableGstFeatures} 
              onChange={() => handleChange("enableGstFeatures", !settings.enableGstFeatures)} 
            />
            <ToggleRow 
              label="Allow New Signups" 
              description="When disabled, only administrators can invite new users to the platform."
              enabled={settings.allowNewSignups} 
              onChange={() => handleChange("allowNewSignups", !settings.allowNewSignups)} 
            />
            <ToggleRow 
              label="Enforce 2FA for Shop Owners" 
              description="Require two-factor authentication for all users managing a shop."
              enabled={settings.enforce2FA || false} 
              onChange={() => handleChange("enforce2FA", !settings.enforce2FA)} 
            />
            <ToggleRow 
              label="Automated Daily Backups" 
              description="Run automated database dumps at 3:00 AM every day."
              enabled={settings.autoBackup || true} 
              onChange={() => handleChange("autoBackup", !settings.autoBackup)} 
            />
            <ToggleRow 
              label="Maintenance Mode" 
              description="Blocks all non-admin traffic and displays a 'System Maintenance' page."
              enabled={settings.maintenanceMode} 
              onChange={() => handleChange("maintenanceMode", !settings.maintenanceMode)} 
            />
          </div>
        </SettingsSection>

      </div>
    </div>
  );
}
