// Global theme CSS — injected once at app root.
// Defines theme tokens (light/dark/glass) + accent variables + scrollbar.
export default function ThemeStyles() {
  return (
    <style jsx global>{`
      :root {
        --accent: #F97316;
        --accent-rgb: 249, 115, 22;
        --accent-light: #FB923C;
        --accent-dark: #EA580C;
      }

      /* ============ GLASS THEME (default — premium prism) ============ */
      [data-theme="glass"] {
        --bg-page: linear-gradient(
          135deg,
          #0f0c29 0%,
          #302b63 50%,
          #24243e 100%
        );
        --bg-surface: rgba(255, 255, 255, 0.1);
        --bg-surface-strong: rgba(255, 255, 255, 0.15);
        --bg-elev: rgba(255, 255, 255, 0.08);
        --bg-input: rgba(255, 255, 255, 0.1);
        --bg-input-focus: rgba(255, 255, 255, 0.15);
        --border: rgba(255, 255, 255, 0.2);
        --border-strong: rgba(255, 255, 255, 0.3);
        --text: #ffffff;
        --text-muted: rgba(255, 255, 255, 0.7);
        --text-dim: rgba(255, 255, 255, 0.5);
        --text-dim2: rgba(255, 255, 255, 0.4);
        --shadow: 0 20px 60px -15px rgba(0, 0, 0, 0.5);
        --card-blur: 24px;
        --radius-card: 1.25rem;
        --success: #10b981;
        --danger: #f43f5e;
        --warning: #f59e0b;
      }

      /* ============ DARK THEME (solid dark) ============ */
      [data-theme="dark"] {
        --bg-page: linear-gradient(180deg, #0a0a0f 0%, #0f0f1a 100%);
        --bg-surface: #16161f;
        --bg-surface-strong: #1c1c28;
        --bg-elev: #1f1f2e;
        --bg-input: #1c1c28;
        --bg-input-focus: #24243a;
        --border: rgba(255, 255, 255, 0.08);
        --border-strong: rgba(255, 255, 255, 0.16);
        --text: #f5f5f7;
        --text-muted: rgba(245, 245, 247, 0.7);
        --text-dim: rgba(245, 245, 247, 0.5);
        --text-dim2: rgba(245, 245, 247, 0.4);
        --shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.6);
        --card-blur: 0px;
        --radius-card: 1rem;
        --success: #10b981;
        --danger: #f43f5e;
        --warning: #f59e0b;
      }

      /* ============ LIGHT THEME (clean SaaS) ============ */
      [data-theme="light"] {
        --bg-page: #f6f7fb;
        --bg-surface: #ffffff;
        --bg-surface-strong: #ffffff;
        --bg-elev: #f9fafb;
        --bg-input: #ffffff;
        --bg-input-focus: #ffffff;
        --border: #e5e7eb;
        --border-strong: #d1d5db;
        --text: #111827;
        --text-muted: #4b5563;
        --text-dim: #6b7280;
        --text-dim2: #9ca3af;
        --shadow: 0 1px 3px rgba(0, 0, 0, 0.05),
          0 4px 16px -4px rgba(0, 0, 0, 0.04);
        --card-blur: 0px;
        --radius-card: 0.875rem;
        --success: #059669;
        --danger: #e11d48;
        --warning: #d97706;
      }

      html,
      body {
        background: var(--bg-page);
        color: var(--text);
        min-height: 100%;
      }
      body {
        background: var(--bg-page);
        background-attachment: fixed;
      }

      /* themed cards & inputs */
      .t-card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        backdrop-filter: blur(var(--card-blur));
        -webkit-backdrop-filter: blur(var(--card-blur));
        box-shadow: var(--shadow);
        color: var(--text);
      }
      .t-card-strong {
        background: var(--bg-surface-strong);
      }
      .t-elev {
        background: var(--bg-elev);
      }
      .t-input {
        background: var(--bg-input);
        border: 1px solid var(--border);
        color: var(--text);
        border-radius: 0.75rem;
        transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
      }
      .t-input::placeholder {
        color: var(--text-dim2);
      }
      .t-input:focus {
        outline: none;
        border-color: var(--accent);
        background: var(--bg-input-focus);
        box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.18);
      }
      .t-text {
        color: var(--text);
      }
      .t-muted {
        color: var(--text-muted);
      }
      .t-dim {
        color: var(--text-dim);
      }
      .t-dim2 {
        color: var(--text-dim2);
      }
      .t-border {
        border-color: var(--border);
      }
      .t-divider {
        border-top: 1px solid var(--border);
      }

      .t-btn {
        background: var(--bg-elev);
        color: var(--text);
        border: 1px solid var(--border);
        border-radius: 0.75rem;
        transition: background 0.15s, transform 0.05s;
      }
      .t-btn:hover {
        background: var(--bg-surface-strong);
      }
      .t-btn:active {
        transform: translateY(1px);
      }
      .t-btn-primary {
        background: linear-gradient(
          135deg,
          var(--accent),
          var(--accent-dark)
        );
        color: white;
        border: 1px solid transparent;
        border-radius: 0.75rem;
        box-shadow: 0 6px 20px -8px rgba(var(--accent-rgb), 0.6);
        transition: opacity 0.15s, transform 0.05s, box-shadow 0.15s;
      }
      .t-btn-primary:hover {
        opacity: 0.93;
        box-shadow: 0 8px 24px -8px rgba(var(--accent-rgb), 0.7);
      }
      .t-btn-primary:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .t-btn-danger {
        background: rgba(244, 63, 94, 0.12);
        color: var(--danger);
        border: 1px solid rgba(244, 63, 94, 0.3);
        border-radius: 0.75rem;
      }
      .t-btn-danger:hover {
        background: rgba(244, 63, 94, 0.2);
      }
      .t-accent-text {
        color: var(--accent);
      }
      .t-accent-bg {
        background: var(--accent);
      }
      .t-accent-border {
        border-color: var(--accent);
      }
      .t-accent-soft {
        background: rgba(var(--accent-rgb), 0.14);
        color: var(--accent);
        border: 1px solid rgba(var(--accent-rgb), 0.25);
      }
      .t-success-bg {
        background: rgba(16, 185, 129, 0.14);
        color: var(--success);
        border: 1px solid rgba(16, 185, 129, 0.3);
      }
      .t-danger-bg {
        background: rgba(244, 63, 94, 0.14);
        color: var(--danger);
        border: 1px solid rgba(244, 63, 94, 0.3);
      }
      .t-warn-bg {
        background: rgba(245, 158, 11, 0.14);
        color: var(--warning);
        border: 1px solid rgba(245, 158, 11, 0.3);
      }

      /* Page-wide prism background only for glass theme */
      .prism-bg {
        position: fixed;
        inset: 0;
        z-index: -1;
        pointer-events: none;
      }
      [data-theme="glass"] .prism-bg::before {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
      }
      [data-theme="glass"] .prism-bg::after {
        content: "";
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 0% 0%, rgba(168, 85, 247, 0.35), transparent 40%),
          radial-gradient(circle at 100% 0%, rgba(236, 72, 153, 0.25), transparent 40%),
          radial-gradient(circle at 50% 100%, rgba(59, 130, 246, 0.3), transparent 45%);
      }
      [data-theme="dark"] .prism-bg {
        background: var(--bg-page);
      }
      [data-theme="light"] .prism-bg {
        background: var(--bg-page);
      }

      /* Public welcome page is always light so the APK landing screen stays readable. */
      .welcome-page {
        background:
          radial-gradient(circle at top left, rgba(var(--accent-rgb), 0.14), transparent 34rem),
          linear-gradient(180deg, #ffffff 0%, #f8fafc 44%, #eef2ff 100%);
        color: #111827;
      }
      .welcome-page .prism-bg {
        background:
          radial-gradient(circle at top right, rgba(99, 102, 241, 0.12), transparent 28rem),
          linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      }
      .welcome-page .t-text {
        color: #111827;
      }
      .welcome-page .t-muted {
        color: #4b5563;
      }
      .welcome-page .t-dim {
        color: #64748b;
      }
      .welcome-page .t-dim2 {
        color: #94a3b8;
      }
      .welcome-page .t-elev,
      .welcome-page .t-card {
        background: rgba(255, 255, 255, 0.92);
        border-color: rgba(203, 213, 225, 0.95);
        box-shadow: 0 18px 45px -30px rgba(15, 23, 42, 0.35);
      }
      .welcome-page .t-btn {
        background: #ffffff;
        color: #111827;
        border-color: #dbe3ef;
        box-shadow: 0 12px 28px -24px rgba(15, 23, 42, 0.55);
      }
      .welcome-page .t-btn:hover {
        background: #f8fafc;
      }

      /* skeleton */
      @keyframes mdx-pulse {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 1; }
      }
      .t-skeleton {
        background: var(--bg-elev);
        border-radius: 0.75rem;
        animation: mdx-pulse 1.4s ease-in-out infinite;
      }

      /* scrollbar */
      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb {
        background: var(--border-strong);
        border-radius: 8px;
      }
      ::-webkit-scrollbar-thumb:hover { background: var(--accent); }

      /* Print styles */
      @media print {
        html, body { background: white !important; color: black !important; }
        .no-print { display: none !important; }
        .print-only { display: block !important; }
      }
      .print-only { display: none; }
    `}</style>
  );
}
