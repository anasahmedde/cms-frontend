// Theme context. Tokens live in src/ui/tokens.css keyed off
// <html data-theme="dark|light">; this provider owns that attribute and the
// "digix_theme" localStorage persistence.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const THEME_KEY = "digix_theme";

const ThemeContext = createContext({ isDark: false, toggle: () => {} });

function storedIsDark() {
  try {
    return localStorage.getItem(THEME_KEY) === "dark";
  } catch {
    return false;
  }
}

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(storedIsDark);

  // Apply on mount and on every change so tokens.css picks the right theme.
  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    try {
      localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    } catch {
      /* private mode — theme just won't persist */
    }
  }, [isDark]);

  const toggle = useCallback(() => setIsDark((d) => !d), []);
  const value = useMemo(() => ({ isDark, toggle }), [isDark, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
