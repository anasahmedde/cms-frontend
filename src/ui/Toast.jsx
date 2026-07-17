// Toast — app-wide notifications. Wrap the app in <ToastProvider>; call
// useToast() → { success(msg), error(msg, {retryLabel, onRetry}), info(msg) }.
// Bottom-right stack, auto-dismiss 4s (errors 8s), manual dismiss, max 5 shown.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import "./kit-overlays.css";

const ToastContext = createContext(null);
const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
const MAX_VISIBLE = 5;
const EXIT_MS = 180;

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  useEffect(() => {
    const timers = timersRef.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  const dismiss = useCallback((id) => {
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
    }, EXIT_MS);
  }, []);

  const push = useCallback(
    (tone, message, opts = {}) => {
      const id = nextId++;
      setToasts((list) => [...list, { id, tone, message, ...opts }].slice(-MAX_VISIBLE));
      timersRef.current[id] = setTimeout(() => dismiss(id), tone === "error" ? 8000 : 4000);
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      success: (message) => push("success", message),
      error: (message, { retryLabel, onRetry } = {}) => push("error", message, { retryLabel, onRetry }),
      info: (message) => push("info", message),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="ui-toast-stack" aria-label="Notifications">
          {toasts.map((t) => {
            const Icon = ICONS[t.tone] || Info;
            return (
              <div
                key={t.id}
                className={`ui-toast ui-toast-${t.tone}${t.leaving ? " ui-toast-leaving" : ""}`}
                role={t.tone === "error" ? "alert" : "status"}
              >
                <Icon size={16} className="ui-toast-icon" aria-hidden="true" />
                <div className="ui-toast-body">
                  <div className="ui-toast-message">{t.message}</div>
                  {t.onRetry ? (
                    <button
                      type="button"
                      className="ui-toast-retry"
                      onClick={() => {
                        dismiss(t.id);
                        t.onRetry();
                      }}
                    >
                      {t.retryLabel || "Retry"}
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="ui-toast-dismiss"
                  aria-label="Dismiss notification"
                  onClick={() => dismiss(t.id)}
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
