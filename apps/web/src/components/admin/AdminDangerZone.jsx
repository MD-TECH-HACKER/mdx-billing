import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from "lucide-react";

export default function AdminDangerZone({ title, description, buttonText, onConfirm, expectedText = "CLEAN PRODUCTION" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (inputText !== expectedText) return;
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
      setIsOpen(false);
      setInputText("");
    }
  };

  return (
    <div style={{
      border: "1px solid rgba(220, 38, 38, 0.2)",
      borderRadius: "16px",
      padding: "24px",
      background: "rgba(220, 38, 38, 0.02)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "24px",
      flexWrap: "wrap"
    }}>
      <div style={{ flex: "1 1 300px" }}>
        <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertTriangle size={18} style={{ color: "#DC2626" }} />
          {title}
        </h4>
        <p style={{ margin: "8px 0 0", fontSize: "14px", color: "var(--text-dim, #6B7280)", maxWidth: "600px", lineHeight: 1.5 }}>
          {description}
        </p>
      </div>

      <div>
        <button
          onClick={() => setIsOpen(true)}
          style={{
            background: "#DC2626",
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: "8px",
            fontWeight: 600,
            fontSize: "14px",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#B91C1C"}
          onMouseLeave={(e) => e.currentTarget.style.background = "#DC2626"}
        >
          {buttonText}
        </button>
      </div>

      {isOpen && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          backdropFilter: "blur(4px)"
        }}>
          <div style={{
            background: "var(--bg-surface, #ffffff)",
            width: "90%",
            maxWidth: "480px",
            borderRadius: "20px",
            padding: "32px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
          }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "20px", fontWeight: 700, color: "#DC2626", display: "flex", alignItems: "center", gap: "10px" }}>
              <AlertTriangle size={24} />
              Danger Zone
            </h3>
            <p style={{ margin: "0 0 24px", fontSize: "15px", color: "var(--text-dim, #6B7280)", lineHeight: 1.5 }}>
              This action cannot be undone. To proceed, please type <strong>{expectedText}</strong> below to confirm.
            </p>

            <input 
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={expectedText}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "1px solid var(--border, #E5E7EB)",
                fontSize: "15px",
                background: "var(--bg-elev, #F9FAFB)",
                marginBottom: "24px",
                boxSizing: "border-box",
                outline: "none",
                fontFamily: "monospace",
                color: "var(--text)"
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = "#DC2626"}
              onBlur={(e) => e.currentTarget.style.borderColor = "var(--border, #E5E7EB)"}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                onClick={() => { setIsOpen(false); setInputText(""); }}
                disabled={loading}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "1px solid var(--border, #E5E7EB)",
                  background: "transparent",
                  color: "var(--text)",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: loading ? "not-allowed" : "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={inputText !== expectedText || loading}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: inputText === expectedText ? "#DC2626" : "rgba(220, 38, 38, 0.5)",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: inputText === expectedText && !loading ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                {loading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : null}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
