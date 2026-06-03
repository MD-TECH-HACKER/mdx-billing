import { Link, useLocation } from "react-router";
import { 
  LayoutDashboard, 
  Users, 
  Store, 
  Activity, 
  ShieldAlert, 
  Database, 
  Settings, 
  LogOut,
  ArrowLeft
} from "lucide-react";

export default function AdminSidebar() {
  const location = useLocation();

  const links = [
    { name: "Overview", path: "/admin", icon: LayoutDashboard },
    { name: "Users", path: "/admin/users", icon: Users },
    { name: "Shops", path: "/admin/shops", icon: Store },
    { name: "Activity", path: "/admin/activity", icon: Activity },
    { name: "Security", path: "/admin/security", icon: ShieldAlert },
    { name: "System", path: "/admin/system", icon: Database },
    { name: "Settings", path: "/admin/settings", icon: Settings },
  ];

  return (
    <aside style={{
      width: "260px",
      background: "var(--bg-surface, #ffffff)",
      borderRight: "1px solid var(--border, #E5E7EB)",
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      position: "sticky",
      top: 0,
      flexShrink: 0
    }}>
      <div style={{ padding: "24px", borderBottom: "1px solid var(--border, #E5E7EB)" }}>
        <h2 style={{ 
          fontSize: "18px", 
          fontWeight: 700, 
          color: "var(--text)", 
          margin: 0, 
          display: "flex", 
          alignItems: "center", 
          gap: "10px",
          letterSpacing: "-0.02em"
        }}>
          <div style={{
            background: "rgba(249, 115, 22, 0.1)",
            padding: "6px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <ShieldAlert style={{ color: "#F97316", width: "20px", height: "20px" }} />
          </div>
          Admin Panel
        </h2>
      </div>

      <nav style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto" }}>
        {links.map((link) => {
          // Exact match for Overview, prefix match for others to keep them highlighted
          const isActive = link.path === "/admin" 
            ? location.pathname === "/admin" 
            : location.pathname.startsWith(link.path);
            
          return (
            <Link
              key={link.path}
              to={link.path}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 14px",
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: isActive ? 600 : 500,
                fontSize: "14px",
                color: isActive ? "#F97316" : "var(--text-dim, #6B7280)",
                background: isActive ? "rgba(249, 115, 22, 0.1)" : "transparent",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = "var(--bg-elev, #F3F4F6)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              <link.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              {link.name}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: "16px", borderTop: "1px solid var(--border, #E5E7EB)", display: "flex", flexDirection: "column", gap: "4px" }}>
        <Link
          to="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "10px 14px",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: 500,
            fontSize: "14px",
            color: "var(--text-dim, #6B7280)",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elev, #F3F4F6)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          <ArrowLeft size={18} />
          Back to App
        </Link>
        <Link
          to="/account/logout"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "10px 14px",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: 500,
            fontSize: "14px",
            color: "#DC2626",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(220, 38, 38, 0.1)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          <LogOut size={18} />
          Logout
        </Link>
      </div>
    </aside>
  );
}
