// Theme system: light, dark, glass + accent color
// Persists locally for instant first paint, syncs to server when shop loads.

const THEME_KEY = "mdx_theme";
const ACCENT_KEY = "mdx_accent";

export const THEMES = ["light", "dark", "glass"];

export const ACCENTS = [
  { name: "Orange", color: "#F97316" },
  { name: "Violet", color: "#8b5cf6" },
  { name: "Indigo", color: "#6366f1" },
  { name: "Blue", color: "#3b82f6" },
  { name: "Cyan", color: "#06b6d4" },
  { name: "Emerald", color: "#10b981" },
  { name: "Amber", color: "#f59e0b" },
  { name: "Pink", color: "#ec4899" },
  { name: "Rose", color: "#f43f5e" },
];

// Convert HEX to RGB triple
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return [249, 115, 22];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function shade(hex, percent) {
  const [r, g, b] = hexToRgb(hex);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const nr = Math.round((t - r) * p + r);
  const ng = Math.round((t - g) * p + g);
  const nb = Math.round((t - b) * p + b);
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

export function getStoredTheme() {
  if (typeof window === "undefined") return "light";
  try {
    const v = localStorage.getItem(THEME_KEY);
    return THEMES.includes(v) ? v : "light";
  } catch {
    return "light";
  }
}

export function getStoredAccent() {
  if (typeof window === "undefined") return "#F97316";
  try {
    return localStorage.getItem(ACCENT_KEY) || "#F97316";
  } catch {
    return "#F97316";
  }
}

export function applyTheme(theme, accent) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const t = THEMES.includes(theme) ? theme : "light";
  const a = accent || "#F97316";
  root.setAttribute("data-theme", t);
  root.style.setProperty("--accent", a);
  root.style.setProperty("--accent-rgb", hexToRgb(a).join(", "));
  root.style.setProperty("--accent-light", shade(a, 25));
  root.style.setProperty("--accent-dark", shade(a, -20));

  try {
    localStorage.setItem(THEME_KEY, t);
    localStorage.setItem(ACCENT_KEY, a);
  } catch {}

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("theme-changed", { detail: { theme: t, accent: a } }),
    );
  }
}

export function initTheme() {
  applyTheme(getStoredTheme(), getStoredAccent());
}
