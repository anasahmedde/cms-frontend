// Legacy theme objects consumed by unported components (templates/* import
// useTheme from ../../App and read .theme). Values mirror the old App.js
// palette. Delete when the last legacy consumer is ported.

const BRAND = {
  primary: "#0a1628",
  primaryLight: "#1e3a5f",
  accent: "#f59e0b",
  accentHover: "#d97706",
  accentLight: "#fbbf24",
  gradient: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
  gradientBlue: "linear-gradient(135deg, #0a1628 0%, #1e3a5f 100%)",
};

export const legacyThemes = {
  light: {
    bg: "#f0f4f8",
    card: "#fff",
    cardAlt: "#f9fafb",
    sidebar: BRAND.primary,
    sidebarHover: "rgba(245, 158, 11, 0.15)",
    sidebarActive: "rgba(245, 158, 11, 0.25)",
    text: "#1e293b",
    textSecondary: "#64748b",
    border: "#e5e7eb",
    headerBg: "#fff",
    inputBg: "#fff",
    inputBorder: "#e5e7eb",
    tableBg: "#fff",
    tableRowHover: "#f9fafb",
    tableHeader: "#f9fafb",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    info: "#3b82f6",
    accent: BRAND.accent,
    accentHover: BRAND.accentHover,
  },
  dark: {
    bg: "#0f172a",
    card: "#1e293b",
    cardAlt: "#334155",
    sidebar: BRAND.primary,
    sidebarHover: "rgba(245, 158, 11, 0.15)",
    sidebarActive: "rgba(245, 158, 11, 0.25)",
    text: "#f1f5f9",
    textSecondary: "#94a3b8",
    border: "#475569",
    headerBg: "#1e293b",
    inputBg: "#334155",
    inputBorder: "#475569",
    tableBg: "#1e293b",
    tableRowHover: "#334155",
    tableHeader: "#334155",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    info: "#3b82f6",
    accent: BRAND.accent,
    accentHover: BRAND.accentHover,
  },
};

export { BRAND as LEGACY_BRAND };
