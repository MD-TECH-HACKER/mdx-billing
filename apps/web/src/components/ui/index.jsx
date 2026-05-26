// Themed primitive UI components used across the dashboard.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  Minus,
  Plus,
  Search as SearchIcon,
  X,
  AlertTriangle,
} from "lucide-react";

/* ===================== Button ===================== */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}) {
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-base",
  };
  const cls =
    variant === "primary"
      ? "t-btn-primary font-semibold"
      : variant === "danger"
        ? "t-btn-danger font-semibold"
        : variant === "ghost"
          ? "t-text hover:bg-[var(--bg-elev)] rounded-xl"
          : "t-btn font-medium";
  return (
    <button
      className={`${cls} ${sizes[size]} inline-flex items-center justify-center gap-2 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ===================== Card ===================== */
export function Card({ className = "", children, ...rest }) {
  return (
    <div className={`t-card p-4 md:p-5 ${className}`} {...rest}>
      {children}
    </div>
  );
}

/* ===================== Input ===================== */
export function Input({ className = "", ...rest }) {
  return (
    <input
      className={`t-input w-full px-3 py-2.5 text-sm ${className}`}
      {...rest}
    />
  );
}
export function Textarea({ className = "", ...rest }) {
  return (
    <textarea
      className={`t-input w-full px-3 py-2.5 text-sm resize-none ${className}`}
      {...rest}
    />
  );
}

/* ===================== Search Input ===================== */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
}) {
  return (
    <div
      className={`t-input flex items-center gap-2 px-3 py-2 ${className}`}
      style={{ borderRadius: "0.75rem" }}
    >
      <SearchIcon className="w-4 h-4 t-dim" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none text-sm t-text placeholder:t-dim2"
      />
      {value ? (
        <button
          onClick={() => onChange("")}
          className="w-5 h-5 rounded-full flex items-center justify-center t-dim hover:t-text"
          aria-label="Clear"
        >
          <X className="w-3 h-3" />
        </button>
      ) : null}
    </div>
  );
}

/* ===================== Select (custom dropdown) ===================== */
export function Select({
  value,
  onChange,
  options, // [{ value, label, icon?, prefix? }]
  placeholder = "Select...",
  className = "",
  align = "left",
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const ref = useRef(null);
  const menuRef = useRef(null);
  const updatePosition = () => {
    if (!ref.current || typeof window === "undefined") return;
    const rect = ref.current.getBoundingClientRect();
    const width = Math.max(rect.width, 180);
    const left =
      align === "right"
        ? Math.max(8, rect.right - width)
        : Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const below = rect.bottom + 6;
    const above = rect.top - 262;
    const top =
      below + 260 <= window.innerHeight || above < 8
        ? Math.min(below, window.innerHeight - 72)
        : Math.max(8, above);
    setPosition({ left, top, width });
  };
  useEffect(() => {
    const h = (e) => {
      if (
        ref.current &&
        !ref.current.contains(e.target) &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, align]);
  const selected = options.find((o) => o.value === value);
  const dropdown =
    open && position
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] max-h-64 overflow-y-auto t-card p-1 shadow-2xl"
            style={{
              left: position.left,
              top: position.top,
              width: position.width,
            }}
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left ${active ? "t-accent-soft" : "hover:bg-[var(--bg-elev)] t-text"}`}
                >
                  {opt.prefix ? (
                    <span
                      className={`font-semibold ${active ? "" : "t-accent-text"} w-6`}
                    >
                      {opt.prefix}
                    </span>
                  ) : null}
                  <span className="flex-1">{opt.label}</span>
                  {active ? <Check className="w-4 h-4" /> : null}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="t-input w-full px-3 py-2.5 text-sm flex items-center gap-2 cursor-pointer"
      >
        <span className="flex-1 text-left truncate">
          {selected ? (
            <span className="flex items-center gap-2">
              {selected.prefix ? (
                <span className="t-accent-text font-semibold">
                  {selected.prefix}
                </span>
              ) : null}
              {selected.label}
            </span>
          ) : (
            <span className="t-dim2">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 t-dim transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {dropdown}
    </div>
  );
}

export function AppLoader({
  label = "Loading MDX Billing...",
  fullScreen = false,
}) {
  return (
    <div
      className={`${fullScreen ? "min-h-screen" : "min-h-[240px]"} flex items-center justify-center p-6 rounded-3xl`}
      style={{ background: "#f6f7fb" }}
    >
      <div
        className="px-6 py-5 text-center max-w-xs w-full"
        style={{
          background: "#ffffff",
          borderRadius: "1.25rem",
          border: "1px solid #e5e7eb",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)",
        }}
      >
        <img src="/logo.png" alt="MDX" className="mx-auto mb-3 w-12 h-12 rounded-full shadow-lg object-cover" />
        <div className="font-semibold" style={{ color: "#111827" }}>{label}</div>
        <div
          className="mt-4 h-1.5 rounded-full overflow-hidden"
          style={{ background: "#f3f4f6" }}
        >
          <div
            className="h-full w-1/2 rounded-full animate-pulse"
            style={{ background: "#F97316" }}
          />
        </div>
      </div>
    </div>
  );
}

/* ===================== Quantity Stepper ===================== */
export function QtyStepper({
  value,
  onChange,
  min = 1,
  max = Infinity,
  size = "md",
  className = "",
}) {
  const sz = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const txt = size === "sm" ? "text-xs w-6" : "text-sm w-8";
  const dec = () => onChange(Math.max(min, (parseInt(value) || min) - 1));
  const inc = () => onChange(Math.min(max, (parseInt(value) || min) + 1));
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-xl t-elev border t-border p-1 ${className}`}
    >
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        className={`${sz} rounded-lg t-card-strong hover:bg-[var(--bg-input-focus)] flex items-center justify-center t-text disabled:opacity-40`}
      >
        <Minus className="w-3 h-3" />
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value);
          if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
        className={`bg-transparent text-center font-semibold t-text ${txt} outline-none`}
        style={{ MozAppearance: "textfield" }}
      />
      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        className={`${sz} rounded-lg t-card-strong hover:bg-[var(--bg-input-focus)] flex items-center justify-center t-text disabled:opacity-40`}
      >
        <Plus className="w-3 h-3" />
      </button>
      <style jsx>{`
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

/* ===================== Toggle Switch ===================== */
export function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative w-11 h-6 rounded-full transition-colors"
        style={{
          background: checked ? "var(--accent)" : "var(--bg-elev)",
          border: "1px solid var(--border)",
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform"
          style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
        />
      </button>
      {label ? <span className="text-sm t-text">{label}</span> : null}
    </label>
  );
}

/* ===================== Tabs ===================== */
export function Tabs({ value, onChange, options, className = "" }) {
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-xl t-elev p-1 border t-border ${className}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${active ? "t-accent-bg text-white shadow" : "t-muted hover:t-text"}`}
            style={active ? { background: "var(--accent)" } : {}}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ===================== Badge ===================== */
export function Badge({ children, tone = "neutral", className = "" }) {
  const tones = {
    neutral: "t-elev t-muted border t-border",
    accent: "t-accent-soft",
    success: "t-success-bg",
    danger: "t-danger-bg",
    warning: "t-warn-bg",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ===================== Modal ===================== */
export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-3 py-0 sm:py-6">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${maxWidth} t-card t-card-strong p-5 sm:p-6 rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto`}
      >
        {title ? (
          <div className="flex items-center justify-between mb-4">
            <h2 className="t-text text-lg font-bold">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg t-elev hover:bg-[var(--bg-input-focus)] flex items-center justify-center t-text"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

/* ===================== Confirm Dialog ===================== */
export function ConfirmDialog({
  open,
  title = "Are you sure?",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
  onConfirm,
  onClose,
}) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-sm">
      <div className="text-center">
        <div
          className={`w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center ${destructive ? "t-danger-bg" : "t-accent-soft"}`}
        >
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="t-text text-lg font-bold">{title}</h3>
        {message ? <p className="t-muted text-sm mt-1">{message}</p> : null}
        <div className="flex gap-2 mt-5">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            className="flex-1"
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ===================== Skeleton ===================== */
export function Skeleton({ className = "", style = {} }) {
  return <div className={`t-skeleton ${className}`} style={style} />;
}

/* ===================== Color Swatch picker ===================== */
export function ColorSwatch({ colors, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => {
        const active = c.color === value;
        return (
          <button
            key={c.color}
            type="button"
            onClick={() => onChange(c.color)}
            title={c.name}
            className="relative w-9 h-9 rounded-xl border-2 transition"
            style={{
              backgroundColor: c.color,
              borderColor: active ? "var(--text)" : "var(--border)",
              boxShadow: active
                ? `0 0 0 3px rgba(var(--accent-rgb), 0.25)`
                : "none",
            }}
          >
            {active ? (
              <Check className="w-4 h-4 text-white absolute inset-0 m-auto drop-shadow" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
