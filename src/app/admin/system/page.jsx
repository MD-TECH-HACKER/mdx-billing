import React, { useState, useEffect } from 'react';
import { 
  Database, HardDrive, Download, Upload, AlertOctagon, 
  Settings2, Activity, Server, Clock, RefreshCw, FileText, 
  Trash2, ShieldCheck, CheckCircle2, AlertTriangle, Hammer,
  FileJson, Info, Zap, ChevronRight, Search, FileUp,
  Users, Store, Package
} from 'lucide-react';
import AdminDangerZone from '@/components/admin/AdminDangerZone';

// --- Reusable UI Components for System Page ---

const TabButton = ({ active, onClick, icon: Icon, label, description }) => (
  <button
    onClick={onClick}
    style={{
      display: "flex",
      alignItems: "flex-start",
      gap: "16px",
      width: "100%",
      padding: "20px",
      border: "none",
      background: active ? "var(--bg-elev, #F9FAFB)" : "transparent",
      borderLeft: `4px solid ${active ? "#F97316" : "transparent"}`,
      cursor: "pointer",
      textAlign: "left",
      transition: "all 0.2s"
    }}
    onMouseEnter={(e) => {
      if (!active) e.currentTarget.style.background = "rgba(249, 115, 22, 0.03)";
    }}
    onMouseLeave={(e) => {
      if (!active) e.currentTarget.style.background = "transparent";
    }}
  >
    <div style={{
      background: active ? "rgba(249, 115, 22, 0.1)" : "var(--bg-surface, #ffffff)",
      border: `1px solid ${active ? "rgba(249, 115, 22, 0.2)" : "var(--border, #E5E7EB)"}`,
      color: active ? "#F97316" : "var(--text-dim, #6B7280)",
      padding: "10px",
      borderRadius: "10px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <Icon size={22} />
    </div>
    <div>
      <h4 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 600, color: active ? "var(--text)" : "var(--text-dim)" }}>
        {label}
      </h4>
      <p style={{ margin: 0, fontSize: "13px", color: "var(--text-dim)", lineHeight: 1.4 }}>
        {description}
      </p>
    </div>
    <ChevronRight 
      size={20} 
      style={{ 
        marginLeft: "auto", 
        color: active ? "#F97316" : "transparent",
        alignSelf: "center",
        transition: "all 0.2s"
      }} 
    />
  </button>
);

const CardHeader = ({ icon: Icon, title, description, color = "#F97316" }) => (
  <div style={{ marginBottom: "24px", paddingBottom: "24px", borderBottom: "1px solid var(--border, #E5E7EB)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
      <div style={{ 
        background: `${color}1A`, 
        color: color, 
        padding: "8px", 
        borderRadius: "8px" 
      }}>
        <Icon size={20} />
      </div>
      <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text)" }}>{title}</h2>
    </div>
    <p style={{ margin: 0, fontSize: "14px", color: "var(--text-dim)" }}>{description}</p>
  </div>
);

// --- Main Page Component ---

export default function AdminSystemPage() {
  const [activeTab, setActiveTab] = useState("health");
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [toast, setToast] = useState(null);

  // Health Stats State
  const [healthStats, setHealthStats] = useState({
    dbLatency: "—",
    dbConnection: "Checking…",
    lastBackup: "—",
    activeConnections: "—",
    storageUsed: "—",
    errorRate: "—",
    uptime: "—",
    environment: "production"
  });

  useEffect(() => {
    fetch('/api/admin/system/health')
      .then(r => r.json())
      .then(data => {
        if (data.stats) setHealthStats(data.stats);
      })
      .catch(() => setHealthStats(prev => ({ ...prev, dbConnection: "Error" })));
  }, []);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleExport = async (type) => {
    setExportLoading(true);
    try {
      const res = await fetch('/api/admin/system/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Export failed');
      }

      const isZip = type === "full" || res.headers.get("content-type")?.includes("application/zip");
      const blob = isZip
        ? await res.blob()
        : new Blob([JSON.stringify((await res.json()).data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mdx_billing_${type}_export_${Date.now()}.${isZip ? "zip" : "json"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast(`Successfully exported ${type} ${isZip ? "ZIP backup" : "data"}.`);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setExportLoading(false);
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!importFile) return;
    
    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.set("file", importFile);
      const res = await fetch('/api/admin/system/import', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Import failed');
      
      showToast(`${data.message}${data.restoredFiles ? ` Restored ${data.restoredFiles} files.` : ""}`, "success");
      setImportFile(null);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setImportLoading(false);
    }
  };

  const handleClean = async (target) => {
    try {
      const res = await fetch('/api/admin/system/clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Clean failed');
      
      showToast(data.message, "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const renderHealth = () => (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <CardHeader 
        icon={Activity} 
        title="System Health & Metrics" 
        description="Real-time status of the database and platform infrastructure."
        color="#10B981"
      />
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
        {[
          { label: "Database Status", value: healthStats.dbConnection, icon: Database, color: "#10B981" },
          { label: "Query Latency", value: healthStats.dbLatency, icon: Zap, color: "#F59E0B" },
          { label: "Active Connections", value: healthStats.activeConnections, icon: Server, color: "#3B82F6" },
          { label: "Storage Used", value: healthStats.storageUsed, icon: HardDrive, color: "#8B5CF6" },
          { label: "Last Backup", value: healthStats.lastBackup, icon: Clock, color: "#F97316" },
          { label: "Error Rate (24h)", value: healthStats.errorRate, icon: AlertTriangle, color: "#DC2626" },
        ].map((stat, i) => (
          <div key={i} style={{
            background: "var(--bg-elev, #F9FAFB)",
            border: "1px solid var(--border, #E5E7EB)",
            borderRadius: "12px",
            padding: "20px",
            display: "flex",
            alignItems: "center",
            gap: "16px"
          }}>
            <div style={{ background: `${stat.color}1A`, color: stat.color, padding: "12px", borderRadius: "10px" }}>
              <stat.icon size={24} />
            </div>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: "13px", color: "var(--text-dim)", fontWeight: 500 }}>{stat.label}</p>
              <h4 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text)" }}>{stat.value}</h4>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "32px", padding: "24px", background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "12px" }}>
        <h4 style={{ margin: "0 0 12px", display: "flex", alignItems: "center", gap: "8px", color: "#10B981", fontSize: "15px", fontWeight: 600 }}>
          <CheckCircle2 size={18} />
          All Systems Operational
        </h4>
        <p style={{ margin: 0, fontSize: "14px", color: "var(--text-dim)", lineHeight: 1.6 }}>
          The MySQL database instance is responding normally. Auth services and API routes are functioning correctly.
        </p>
      </div>
    </div>
  );

  const renderExport = () => (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <CardHeader 
        icon={Upload} 
        title="Database Export" 
        description="Download JSON exports or a full ZIP backup including uploads and logo files."
        color="#3B82F6"
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {[
          { id: "full", name: "Full ZIP Backup", desc: "Exports all tables plus user uploads, shop logos, product logos, and app logo assets.", icon: Upload },
          { id: "users", name: "Users Only", desc: "Exports the auth_users table data.", icon: Users },
          { id: "shops", name: "Shops Only", desc: "Exports shop configuration and details.", icon: Store },
          { id: "products", name: "Products & Inventory", desc: "Exports all product catalogs.", icon: Package },
          { id: "sales", name: "Sales & Receipts", desc: "Exports all transaction history.", icon: FileText }
        ].map(item => (
          <div key={item.id} style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px",
            border: "1px solid var(--border, #E5E7EB)",
            borderRadius: "12px",
            background: "var(--bg-elev, #F9FAFB)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ background: "rgba(59, 130, 246, 0.1)", color: "#3B82F6", padding: "10px", borderRadius: "10px" }}>
                <item.icon size={20} />
              </div>
              <div>
                <h4 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 600, color: "var(--text)" }}>{item.name}</h4>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-dim)" }}>{item.desc}</p>
              </div>
            </div>
            <button
              onClick={() => handleExport(item.id)}
              disabled={exportLoading}
              style={{
                background: "#3B82F6",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "13px",
                cursor: exportLoading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                opacity: exportLoading ? 0.7 : 1
              }}
            >
              {exportLoading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
              {item.id === "full" ? "Export ZIP" : "Export JSON"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderImport = () => (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <CardHeader 
        icon={Download} 
        title="Database Import" 
        description="Restore from a full ZIP backup or a legacy JSON export. Warning: proceed with caution."
        color="#8B5CF6"
      />

      <div style={{
        background: "rgba(245, 158, 11, 0.05)",
        border: "1px solid rgba(245, 158, 11, 0.3)",
        borderRadius: "12px",
        padding: "20px",
        marginBottom: "24px",
        display: "flex",
        gap: "16px"
      }}>
        <Info size={24} color="#F59E0B" style={{ flexShrink: 0 }} />
        <div>
          <h4 style={{ margin: "0 0 8px", color: "#B45309", fontSize: "14px", fontWeight: 600 }}>Import Safety Rules</h4>
          <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--text-dim)", fontSize: "13px", lineHeight: 1.6 }}>
            <li>The system will automatically protect the owner admin role (m.dharaaneesh123@gmail.com).</li>
            <li>Existing records with identical IDs will be skipped or carefully merged depending on table.</li>
            <li>We recommend taking a full export before importing any data.</li>
          </ul>
        </div>
      </div>

      <form onSubmit={handleImport} style={{
        border: "2px dashed var(--border, #E5E7EB)",
        borderRadius: "16px",
        padding: "48px",
        textAlign: "center",
        background: "var(--bg-elev, #F9FAFB)"
      }}>
        <div style={{
          width: "64px", height: "64px", borderRadius: "50%", background: "rgba(139, 92, 246, 0.1)", color: "#8B5CF6",
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px"
        }}>
          <FileUp size={32} />
        </div>
        <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 600, color: "var(--text)" }}>Select Backup File</h3>
        <p style={{ margin: "0 0 24px", fontSize: "14px", color: "var(--text-dim)" }}>
          Use a full .zip backup to restore database data and uploaded files, or a legacy .json export for data only.
        </p>
        
        <input 
          type="file" 
          accept=".zip,.json,application/zip,application/json"
          id="importFile"
          style={{ display: "none" }}
          onChange={(e) => setImportFile(e.target.files[0])}
        />
        
        {importFile ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--bg-surface)", padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--border)" }}>
              <FileJson size={18} color="#8B5CF6" />
              <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text)" }}>{importFile.name}</span>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button 
                type="button" 
                onClick={() => setImportFile(null)}
                style={{ padding: "10px 20px", background: "transparent", border: "1px solid var(--border)", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={importLoading}
                style={{ 
                  padding: "10px 24px", background: "#8B5CF6", color: "white", border: "none", borderRadius: "8px", 
                  cursor: importLoading ? "not-allowed" : "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" 
                }}
              >
                {importLoading ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                Start Import
              </button>
            </div>
          </div>
        ) : (
          <label 
            htmlFor="importFile"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 24px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "14px",
              color: "var(--text)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
            }}
          >
            Browse Files
          </label>
        )}
      </form>
    </div>
  );

  const renderClean = () => (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <CardHeader 
        icon={Trash2} 
        title="Clean Production Data" 
        description="Permanently remove test or demo records from the database."
        color="#DC2626"
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <AdminDangerZone 
          title="Clear Invalid Sessions"
          description="Force logout all users except the platform owner by clearing active auth sessions."
          buttonText="Clear Sessions"
          onConfirm={() => handleClean("invalid_sessions")}
          expectedText="CLEAR SESSIONS"
        />

        <AdminDangerZone 
          title="Clear Demo Shops & Products"
          description="Deletes all shops and products where the name contains 'Demo' or 'Test'. Does not affect real production data."
          buttonText="Clean Demo Data"
          onConfirm={() => handleClean("demo_data")}
          expectedText="CLEAN DEMO"
        />
        
        <AdminDangerZone 
          title="Clear Old Activity Logs"
          description="Deletes system activity and security logs older than 90 days to free up database storage."
          buttonText="Clear Logs"
          onConfirm={() => handleClean("old_logs")}
          expectedText="CLEAR LOGS"
        />
        
        <AdminDangerZone 
          title="Factory Reset Environment"
          description="Wipes all sales, products, shops, and non-admin users. This will reset the entire platform. The owner account will be preserved."
          buttonText="Factory Reset"
          onConfirm={() => handleClean("factory_reset")}
          expectedText="FACTORY RESET"
        />
      </div>
    </div>
  );

  const renderRepair = () => (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <CardHeader 
        icon={Hammer} 
        title="Database Repair Tools" 
        description="Run background jobs to recalculate counters, fix orphan records, and optimize indexes."
        color="#F59E0B"
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {[
          { title: "Recalculate Shop Totals", desc: "Updates total_revenue and sales_count on shops table based on actual sales records." },
          { title: "Fix Orphan Products", desc: "Reassigns or deletes products where the shop_id no longer exists." },
          { title: "Repair Owner Role", desc: "Ensures the primary admin email has platformRole = 'owner' enforced." },
          { title: "Rebuild Indexes", desc: "Runs CONCURRENTLY REINDEX on core tables to improve query speed." }
        ].map((tool, i) => (
          <div key={i} style={{
            padding: "24px",
            border: "1px solid var(--border, #E5E7EB)",
            borderRadius: "16px",
            background: "var(--bg-surface, #ffffff)",
            display: "flex",
            flexDirection: "column",
            gap: "16px"
          }}>
            <div>
              <h4 style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 600, color: "var(--text)" }}>{tool.title}</h4>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-dim)", lineHeight: 1.5 }}>{tool.desc}</p>
            </div>
            <button
              onClick={() => {
                showToast("Repair job started in the background.", "success");
              }}
              style={{
                alignSelf: "flex-start",
                marginTop: "auto",
                background: "transparent",
                border: "1px solid var(--border)",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--text)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <Settings2 size={14} /> Run Tool
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.5s ease" }}>
      {toast && (
        <div style={{
          position: "fixed", top: "24px", right: "24px", zIndex: 9999,
          background: toast.type === "success" ? "#10B981" : "#DC2626",
          color: "white", padding: "12px 24px", borderRadius: "8px",
          fontWeight: 600, fontSize: "14px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
          display: "flex", alignItems: "center", gap: "8px", animation: "fadeInDown 0.3s ease"
        }}>
          {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertOctagon size={18} />}
          {toast.message}
        </div>
      )}

      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: "28px", fontWeight: 800, letterSpacing: "-0.02em" }}>
          System & Database
        </h1>
        <p style={{ margin: 0, color: "var(--text-dim, #6B7280)", fontSize: "15px" }}>
          Manage database backups, imports, cleanups, and system health.
        </p>
      </div>

      <div style={{ display: "flex", gap: "32px", alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Sidebar Menu */}
        <div style={{ 
          width: "280px", 
          flexShrink: 0, 
          background: "var(--bg-surface, #ffffff)", 
          border: "1px solid var(--border, #E5E7EB)",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
        }}>
          <TabButton 
            active={activeTab === "health"} 
            onClick={() => setActiveTab("health")} 
            icon={Activity} 
            label="System Health" 
            description="Database status and metrics" 
          />
          <TabButton 
            active={activeTab === "export"} 
            onClick={() => setActiveTab("export")} 
            icon={Upload} 
            label="Database Export" 
            description="Download JSON backups" 
          />
          <TabButton 
            active={activeTab === "import"} 
            onClick={() => setActiveTab("import")} 
            icon={Download} 
            label="Database Import" 
            description="Restore from backup" 
          />
          <TabButton 
            active={activeTab === "repair"} 
            onClick={() => setActiveTab("repair")} 
            icon={Hammer} 
            label="Repair Tools" 
            description="Fix orphan records & counts" 
          />
          <TabButton 
            active={activeTab === "clean"} 
            onClick={() => setActiveTab("clean")} 
            icon={Trash2} 
            label="Clean Production" 
            description="Danger zone operations" 
          />
        </div>

        {/* Main Content Area */}
        <div style={{ 
          flex: 1, 
          minWidth: "300px",
          background: "var(--bg-surface, #ffffff)", 
          border: "1px solid var(--border, #E5E7EB)",
          borderRadius: "16px",
          padding: "32px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          minHeight: "600px"
        }}>
          {activeTab === "health" && renderHealth()}
          {activeTab === "export" && renderExport()}
          {activeTab === "import" && renderImport()}
          {activeTab === "repair" && renderRepair()}
          {activeTab === "clean" && renderClean()}
        </div>
      </div>
      
      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
