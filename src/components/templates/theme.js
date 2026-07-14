// Token-backed replacement for the legacy useTheme() object. Every value is a
// CSS variable from src/ui/tokens.css, so the designer follows light/dark mode
// automatically and inline styles keep working untouched.
export const T = {
  bg: "var(--bg)",
  card: "var(--card)",
  cardAlt: "var(--elevated)",
  headerBg: "var(--card)",
  text: "var(--text)",
  textSecondary: "var(--text-muted)",
  border: "var(--border)",
  inputBg: "var(--input-bg)",
  inputBorder: "var(--border)",
  tableBg: "var(--card)",
  tableHeader: "var(--table-head)",
  tableRowHover: "var(--row-hover)",
  accent: "var(--accent)",
  accentHover: "var(--accent-strong)",
  success: "var(--success)",
  warning: "var(--warn)",
  danger: "var(--danger)",
  info: "var(--info)",
  sidebar: "var(--sidebar-bg)",
  sidebarHover: "var(--sidebar-hover)",
  sidebarActive: "var(--sidebar-active)",
};
