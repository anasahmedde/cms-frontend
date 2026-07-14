// Split-panel login: navy brand panel + form card. Backend error strings are
// surfaced verbatim; navigation happens once auth state confirms the user.
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, Eye, EyeOff, LogIn } from "lucide-react";
import Button from "../ui/Button";
import IconButton from "../ui/IconButton";
import { Field, Input } from "../ui/Field";
import { useAuth } from "../lib/auth";
import "../shell/shell.css";

export default function Login() {
  const { user, login, isPlatform, isImpersonating } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const from = location.state?.from;
    const dest = from
      ? `${from.pathname || from}${from.search || ""}`
      : isPlatform && !isImpersonating
        ? "/platform"
        : "/";
    navigate(dest, { replace: true });
  }, [user, isPlatform, isImpersonating, location.state, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setError("");
    setLoading(true);
    const res = await login(username.trim(), password);
    setLoading(false);
    if (!res?.ok) setError(res?.message || "Login failed");
  };

  return (
    <div className="ui-login">
      <div className="ui-login-brand">
        <div className="ui-login-slides" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`ui-login-slide ui-login-slide-${n}`}
              style={{ backgroundImage: `url(/login/slide-${n}.jpg)` }}
            />
          ))}
          <div className="ui-login-slide-overlay" />
        </div>
        <div className="ui-login-brand-content">
          <div className="ui-login-wordmark">DIGIX</div>
          <div className="ui-login-accent" aria-hidden="true" />
          <p className="ui-login-tagline">Digital signage, managed.</p>
          <p className="ui-login-tagline-sub">
            One dashboard for every screen — content, layouts, and live fleet health.
          </p>
        </div>
      </div>
      <div className="ui-login-side">
        <form className="ui-login-card" onSubmit={handleSubmit} noValidate>
          <div>
            <h1 className="ui-login-title">Sign in</h1>
            <p className="ui-login-sub">Use your DIGIX account to continue.</p>
          </div>
          {error ? (
            <div className="ui-login-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}
          <Field label="Username" htmlFor="login-username">
            <Input
              id="login-username"
              name="username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
            />
          </Field>
          <Field label="Password" htmlFor="login-password">
            <div className="ui-login-password">
              <Input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
              <span className="ui-login-eye">
                <IconButton
                  label={showPassword ? "Hide password" : "Show password"}
                  icon={showPassword ? EyeOff : Eye}
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowPassword((s) => !s);
                  }}
                />
              </span>
            </div>
          </Field>
          <div className="ui-login-submit">
            <Button type="submit" variant="primary" loading={loading} icon={LogIn}>
              Sign in
            </Button>
          </div>
        </form>
        <p className="ui-login-footer">© 2026 DIGIX</p>
      </div>
    </div>
  );
}
