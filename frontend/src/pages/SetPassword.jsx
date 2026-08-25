// Invite activation and password reset, reached from the signed link the
// admin shares. Both fields have the eye toggle.
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { homePathFor, useAuth } from "../auth.jsx";
import { useToast } from "../toast.jsx";

export default function SetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { adoptSession } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (password.length < 8) return toast("Password must be at least 8 characters.", "error");
    if (password !== confirm) return toast("Passwords do not match.", "error");
    setBusy(true);
    try {
      const data = await api("/auth/set-password/", { method: "POST", body: { token, password } });
      adoptSession(data);
      toast("Password set. Welcome to CareLink.", "success");
      navigate(homePathFor(data.user.role));
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-wrap">
        <div className="auth-card card">
          <h1>Link missing</h1>
          <p className="sub">This page needs the invite link from your administrator. Ask them to resend it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo"><img src="/favicon.svg" alt="" />CareLink</div>
        <div className="card">
          <h1>Set your password</h1>
          <p className="sub">Choose a password of at least 8 characters to activate your account.</p>
          <form onSubmit={submit}>
            <label>New password</label>
            <div className="password-wrap">
              <input type={show1 ? "text" : "password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              <button type="button" className="eye-btn" onClick={() => setShow1((v) => !v)} aria-label="Toggle password visibility">{show1 ? "\u{1F648}" : "\u{1F441}"}</button>
            </div>
            <label>Confirm password</label>
            <div className="password-wrap">
              <input type={show2 ? "text" : "password"} required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
              <button type="button" className="eye-btn" onClick={() => setShow2((v) => !v)} aria-label="Toggle password visibility">{show2 ? "\u{1F648}" : "\u{1F441}"}</button>
            </div>
            <button className="btn" style={{ width: "100%", marginTop: 18 }} disabled={busy}>
              {busy ? "Saving..." : "Activate account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
