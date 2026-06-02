import React, { useEffect, useState } from "react";
import {
  Settings,
  Mail,
  Globe,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Building,
  DatabaseBackup,
} from "lucide-react";
import { CURRENCIES } from "@/utils/currency";
import { TIMEZONE_OPTIONS } from "@/utils/timezones";
import { Select } from "@/components/ui";

const DEFAULT_SETTINGS = {
  platformName: "MDX Billing App",
  supportEmail: "support@mdx-billing.app",
  senderEmail: "receipts@mdx-billing.app",
  enableEmailReceipts: true,
  allowNewSignups: true,
  maintenanceMode: false,
  currencyDefault: "INR",
  timezoneDefault: "Asia/Kolkata",
  enforce2FA: false,
  autoBackup: true,
  backupIntervalHours: 5,
  telegramBotToken: "",
  telegramChatId: "",
  telegramBotTokenConfigured: false,
  telegramChatIdConfigured: false,
};

const fieldStyle = {
  width: "100%",
  maxWidth: "500px",
  padding: "12px 16px",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  background: "var(--bg-surface)",
  fontSize: "14px",
  color: "var(--text)",
  outline: "none",
  boxSizing: "border-box",
};

const SettingsSection = ({ icon: Icon, title, description, children, color = "#F97316" }) => (
  <div style={{
    background: "var(--bg-surface, #ffffff)",
    borderRadius: "12px",
    border: "1px solid var(--border, #E5E7EB)",
    padding: "28px",
    marginBottom: "24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  }}>
    <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "24px", borderBottom: "1px solid var(--border, #E5E7EB)", paddingBottom: "24px" }}>
      <div style={{ background: `${color}1A`, color, padding: "12px", borderRadius: "12px" }}>
        <Icon size={24} />
      </div>
      <div>
        <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 700, color: "var(--text)" }}>{title}</h3>
        <p style={{ margin: 0, fontSize: "14px", color: "var(--text-dim)", lineHeight: 1.5, maxWidth: "680px" }}>{description}</p>
      </div>
    </div>
    {children}
  </div>
);

const InputGroup = ({ label, description, type = "text", value, onChange, min, max, placeholder, autoComplete = "off" }) => (
  <div style={{ marginBottom: "20px" }}>
    <label style={{ display: "block", margin: "0 0 6px", fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>{label}</label>
    {description && <p style={{ margin: "0 0 10px", fontSize: "13px", color: "var(--text-dim)" }}>{description}</p>}
    <input type={type} min={min} max={max} value={value ?? ""} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete} style={fieldStyle} />
  </div>
);

const SelectGroup = ({ label, description, value, onChange, options }) => (
  <div style={{ marginBottom: "20px" }}>
    <label style={{ display: "block", margin: "0 0 6px", fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>{label}</label>
    {description && <p style={{ margin: "0 0 10px", fontSize: "13px", color: "var(--text-dim)" }}>{description}</p>}
    <div style={{ maxWidth: "500px" }}>
      <Select value={value} onChange={onChange} options={options} />
    </div>
  </div>
);

const ToggleRow = ({ label, description, enabled, onChange }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: "1px solid var(--border)" }}>
    <div style={{ paddingRight: "20px" }}>
      <h4 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 600, color: "var(--text)" }}>{label}</h4>
      <p style={{ margin: 0, fontSize: "13px", color: "var(--text-dim)" }}>{description}</p>
    </div>
    <button
      type="button"
      onClick={onChange}
      style={{
        width: "44px", height: "24px", borderRadius: "12px", flexShrink: 0,
        background: enabled ? "#10B981" : "var(--border, #E5E7EB)",
        border: "none", cursor: "pointer", position: "relative",
        transition: "background 0.3s ease",
      }}
      aria-pressed={enabled}
    >
      <div style={{
        position: "absolute", top: "2px", left: enabled ? "22px" : "2px",
        width: "20px", height: "20px", borderRadius: "50%", background: "white",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)", transition: "left 0.3s ease",
      }}/>
    </button>
  </div>
);

const BackupMetric = ({ label, value }) => (
  <div style={{ padding: "14px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg-elev, #f8fafc)" }}>
    <div style={{ fontSize: "12px", color: "var(--text-dim)", marginBottom: "6px" }}>{label}</div>
    <div style={{ fontSize: "14px", color: "var(--text)", fontWeight: 700, wordBreak: "break-word" }}>{value || "Not available"}</div>
  </div>
);

export default function AdminSettings() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [toast, setToast] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [backup, setBackup] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const refreshSettings = async () => {
    setFetching(true);
    try {
      const [settingsResponse, backupResponse] = await Promise.all([
        fetch("/api/admin/settings"),
        fetch("/api/admin/backups/status"),
      ]);
      const settingsData = await settingsResponse.json().catch(() => ({}));
      const backupData = await backupResponse.json().catch(() => ({}));
      if (!settingsResponse.ok) throw new Error(settingsData.error || "Failed to load settings");
      setSettings({ ...DEFAULT_SETTINGS, ...(settingsData.settings || {}) });
      setBackup(backupData);
    } catch (error) {
      showToast(error.message || "Could not load settings", "error");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Failed to save settings");
      setSettings({ ...DEFAULT_SETTINGS, ...(data.settings || {}) });
      showToast("Platform settings saved.");
      await refreshSettings();
    } catch (error) {
      showToast(error.message || "Could not save settings", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const currencyOptions = CURRENCIES.map((currency) => ({
    value: currency.code,
    label: `${currency.name} (${currency.code})`,
  }));
  const backupStatus = backup?.lastRun?.ok === true ? "Last run succeeded" : backup?.lastRun?.ok === false ? "Last run failed" : "No run recorded";

  return (
    <div style={{ animation: "fadeIn 0.5s ease", paddingBottom: "60px", opacity: fetching ? 0.7 : 1 }}>
      {toast && (
        <div style={{
          position: "fixed", top: "24px", right: "24px", zIndex: 9999,
          background: toast.type === "error" ? "#EF4444" : "#10B981", color: "white", padding: "12px 24px", borderRadius: "8px",
          fontWeight: 600, fontSize: "14px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
          display: "flex", alignItems: "center", gap: "8px", animation: "fadeInDown 0.3s ease",
        }}>
          {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />} {toast.message}
        </div>
      )}

      <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ margin: "0 0 8px", fontSize: "28px", fontWeight: 800 }}>
            Platform Settings
          </h1>
          <p style={{ margin: 0, color: "var(--text-dim, #6B7280)", fontSize: "15px" }}>
            Configure global defaults, platform access, and backup delivery.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={loading || fetching}
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
            cursor: loading || fetching ? "not-allowed" : "pointer",
          }}
        >
          {loading ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
          Save Changes
        </button>
      </div>

      <SettingsSection icon={Building} title="General Information" description="Basic information displayed to all users." color="#3B82F6">
        <InputGroup label="Platform Name" value={settings.platformName} onChange={(event) => handleChange("platformName", event.target.value)} />
        <InputGroup label="Support Email" description="User support contact shown in public platform messages." value={settings.supportEmail} onChange={(event) => handleChange("supportEmail", event.target.value)} />
      </SettingsSection>

      <SettingsSection icon={Mail} title="Email & Communication" description="Transactional email defaults used by platform-controlled messages." color="#8B5CF6">
        <InputGroup label="Default Sender Email" value={settings.senderEmail} onChange={(event) => handleChange("senderEmail", event.target.value)} />
        <ToggleRow label="Enable Email Receipts" description="Allow shops to send digital receipts to customers via email." enabled={!!settings.enableEmailReceipts} onChange={() => handleChange("enableEmailReceipts", !settings.enableEmailReceipts)} />
      </SettingsSection>

      <SettingsSection icon={Globe} title="Localization & Formats" description="Set regional defaults for new shops." color="#F59E0B">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
          <SelectGroup label="Default Currency" value={settings.currencyDefault || "INR"} onChange={(value) => handleChange("currencyDefault", value)} options={currencyOptions} />
          <SelectGroup label="Default Timezone" value={settings.timezoneDefault || "Asia/Kolkata"} onChange={(value) => handleChange("timezoneDefault", value)} options={TIMEZONE_OPTIONS} />
        </div>
      </SettingsSection>

      <SettingsSection icon={Settings} title="Platform Features" description="Enable or disable core functionality platform-wide." color="#10B981">
        <ToggleRow label="Allow New Signups" description="When disabled, public signup buttons are blocked." enabled={!!settings.allowNewSignups} onChange={() => handleChange("allowNewSignups", !settings.allowNewSignups)} />
        <ToggleRow label="Enforce 2FA for Shop Owners" description="Require two-factor authentication for users managing a shop." enabled={!!settings.enforce2FA} onChange={() => handleChange("enforce2FA", !settings.enforce2FA)} />
        <ToggleRow label="Automated Telegram Backups" description="Run database and upload-folder backups on the configured interval." enabled={!!settings.autoBackup} onChange={() => handleChange("autoBackup", !settings.autoBackup)} />
        <ToggleRow label="Maintenance Mode" description="Blocks logged-in non-admin traffic and displays the maintenance page." enabled={!!settings.maintenanceMode} onChange={() => handleChange("maintenanceMode", !settings.maintenanceMode)} />
        <InputGroup label="Backup Interval Hours" type="number" min="1" max="168" value={settings.backupIntervalHours || 5} onChange={(event) => handleChange("backupIntervalHours", Number(event.target.value) || 5)} />
      </SettingsSection>

      <SettingsSection icon={DatabaseBackup} title="Telegram Backups" description="Backup archive status and delivery configuration." color="#0EA5E9">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px", marginBottom: "20px" }}>
          <InputGroup
            label="Telegram Bot Token"
            type="password"
            value={settings.telegramBotToken || ""}
            placeholder={settings.telegramBotTokenConfigured ? "Configured - enter a new token to replace" : "Paste bot token"}
            description="Saved in platform settings. It is never returned to the browser after saving."
            onChange={(event) => handleChange("telegramBotToken", event.target.value)}
          />
          <InputGroup
            label="Telegram Chat ID"
            value={settings.telegramChatId || ""}
            placeholder={settings.telegramChatIdConfigured ? "Configured - enter a new chat id to replace" : "Paste chat id"}
            description="Telegram user, group, or channel chat id that receives backups."
            onChange={(event) => handleChange("telegramChatId", event.target.value)}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
          <BackupMetric label="Telegram Bot" value={backup?.telegramConfigured ? `Configured (${backup.tokenSource || "saved"})` : "Not configured"} />
          <BackupMetric label="Telegram Chat" value={backup?.chatConfigured ? `Configured (${backup.chatSource || "saved"})` : "Not configured"} />
          <BackupMetric label="Interval" value={`${backup?.intervalHours || settings.backupIntervalHours || 5} hours`} />
          <BackupMetric label="Status" value={backupStatus} />
          <BackupMetric label="Last Run" value={backup?.lastRun?.finishedAt || backup?.lastRun?.startedAt} />
          <BackupMetric label="Last Archive" value={backup?.lastRun?.archiveName} />
        </div>
        {backup?.lastRun?.error ? (
          <div style={{ marginTop: "12px", color: "#B91C1C", fontSize: "13px" }}>
            {backup.lastRun.error}
          </div>
        ) : null}
      </SettingsSection>
    </div>
  );
}
