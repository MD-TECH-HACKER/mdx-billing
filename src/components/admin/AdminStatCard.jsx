import React from 'react';
import { Loader2 } from "lucide-react";

export default function AdminStatCard({ title, value, icon: Icon, color = "#F97316", loading = false }) {
  return (
    <div style={{
      background: "var(--bg-surface, #ffffff)",
      borderRadius: "16px",
      padding: "24px",
      border: "1px solid var(--border, #E5E7EB)",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      display: "flex",
      alignItems: "center",
      gap: "20px",
      transition: "transform 0.2s, box-shadow 0.2s",
      cursor: "default"
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = "translateY(-2px)";
      e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.06)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
    }}>
      <div style={{
        width: "56px",
        height: "56px",
        borderRadius: "12px",
        background: `${color}1A`, // 10% opacity hex
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: color,
        flexShrink: 0
      }}>
        {Icon && <Icon size={28} strokeWidth={2} />}
      </div>
      <div>
        <p style={{ margin: 0, fontSize: "14px", fontWeight: 500, color: "var(--text-dim, #6B7280)", marginBottom: "4px" }}>
          {title}
        </p>
        {loading ? (
          <Loader2 size={24} style={{ color, animation: "spin 1s linear infinite" }} />
        ) : (
          <h3 style={{ margin: 0, fontSize: "28px", fontWeight: 700, color: "var(--text, #111827)", letterSpacing: "-0.02em" }}>
            {value}
          </h3>
        )}
      </div>
    </div>
  );
}
