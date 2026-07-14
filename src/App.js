// App root: providers + router. Pages live in src/pages (new) and
// src/components (legacy, being ported wave by wave — see
// docs/plans/ux-revamp.md in the cms-release-1 repo).
import React from "react";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider, useTheme as useNewTheme } from "./lib/theme";
import { AuthProvider, useAuth as useNewAuth } from "./lib/auth";
import { ToastProvider } from "./ui/Toast";
import AppRoutes from "./routes";
import { legacyThemes } from "./legacy/legacyTheme";

// ---- Compatibility exports for unported components -------------------------
// components/templates/* still `import { useTheme } from "../../App"` and read
// `{ theme, isDark }`. Keep these adapters until the last legacy consumer dies.
export function useTheme() {
  const { isDark, toggle } = useNewTheme();
  return { isDark, toggle, theme: legacyThemes[isDark ? "dark" : "light"] };
}

export function useAuth() {
  return useNewAuth();
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
