// Two step password reset: request a 6 digit code by email (sent through
// SendGrid, or printed to the backend console if SendGrid is not set up),
// then enter the code with a new password.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { homePathFor, useAuth } from "../auth.jsx";
import { useToast } from "../toast.jsx";

export default function ForgotPassword() {
  const { adoptSession } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState("request"); // request, verify
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function requestCode(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/auth/password-reset/request/", { method: "POST", body: { email } });
      toast("If that email has an account, a code is on its way.", "success");
      setStep("verify");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e) {
    e.preventDefault();
    if (password.length < 8) return toast("Password must be at least 8 characters.", "error");
    if (password !== confirm) return toast("Passwords do not match.", "error");
    setBusy(true);
    try {
      const data = await api("/auth/password-reset/verify/", { method: "POST", body: { email, code, password } });
      adoptSession(data);
      toast("Password reset. Welcome back.", "success");
      navigate(homePathFor(data.user.role));
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
          {step === "request" ? (
            <>
              <h1>Reset your password</h1>
              <p className="sub">Enter your email and we will send a 6 digit code.</p>
              <form onSubmit={requestCode}>
                <label>Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                <button className="btn" style={{ width: "100%", marginTop: 18 }} disabled={busy}>
                  {busy ? "Sending..." : "Send code"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1>Enter your code</h1>
              <p className="sub">Sent to {email}. Codes expire after 10 minutes.</p>
              <form onSubmit={verifyCode}>
                <label>6 digit code</label>
                <input required maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
                <label>New password</label>
                <div className="password-wrap">
                  <input type={showPassword ? "text" : "password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                  <button type="button" className="eye-btn" onClick={() => setShowPassword((v) => !v)} aria-label="Toggle password visibility">{showPassword ? "\u{1F648}" : "\u{1F441}"}</button>
                </div>
                <label>Confirm password</label>
                <input type={showPassword ? "text" : "password"} required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
                <button className="btn" style={{ width: "100%", marginTop: 18 }} disabled={busy}>
                  {busy ? "Saving..." : "Reset password"}
                </button>
              </form>
              <button className="btn ghost small" style={{ marginTop: 10 }} onClick={() => setStep("request")}>Use a different email</button>
            </>
          )}
          <p className="muted small center" style={{ marginTop: 16 }}>
            <Link to="/login">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}