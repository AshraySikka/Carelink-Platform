// Sign in page with the show and hide password eye toggle.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { homePathFor, useAuth } from "../auth.jsx";
import { useToast } from "../toast.jsx";

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await login(email, password);
      navigate(homePathFor(user.role));
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo"><img src="/favicon.svg" alt="" />CareLink</div>
        <div className="card">
          <h1>Sign in</h1>
          <p className="sub">Accounts are invite only. Contact your CareLink administrator if you need access.</p>
          <form onSubmit={submit}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <label htmlFor="password">Password</label>
            <div className="password-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "\u{1F648}" : "\u{1F441}"}
              </button>
            </div>
            <button className="btn" style={{ width: "100%", marginTop: 18 }} disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <p className="center small" style={{ marginTop: 16 }}>
            <Link to="/forgot-password">Forgot password?</Link>
          </p>
          <p className="muted small center" style={{ marginTop: 6 }}>
            Received an invite link? Open it to set your password.
          </p>
        </div>
      </div>
    </div>
  );
}
