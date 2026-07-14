// App root: providers + router. Pages live in src/pages; shared pieces in
// src/ui, src/lib, and the per-domain directories (see docs/plans/ux-revamp.md
// in the cms-release-1 repo).
import React from "react";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./lib/theme";
import { AuthProvider } from "./lib/auth";
import { ToastProvider } from "./ui/Toast";
import AppRoutes from "./routes";

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
