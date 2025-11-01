import { useEffect, useState, useRef } from "react";
import {
  Form,
  TextInput,
  Button,
  InlineNotification,
  PasswordInput,
} from "@carbon/react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { setSession, setUser } from "../services/session";
import "../styles/pages/login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const nav = useNavigate();
  const location = useLocation();

  // Prevent double-run in React 18 StrictMode and page remounts
  const duoHandledRef = useRef(false);

  // Show denied banner if Duo says ?mfa=denied
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("mfa") === "denied") {
      setError("You denied the Duo prompt. Please approve to continue.");
      nav(location.pathname, { replace: true });
    }
  }, [location.search, location.pathname, nav]);

  // Handle Duo success: /login or /login/finish with ?code=otc_...
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    if (!code) return;

    // Guard: only handle this code once
    if (duoHandledRef.current) return;
    duoHandledRef.current = true;
    if (sessionStorage.getItem(`duo_handled_${code}`)) return;
    sessionStorage.setItem(`duo_handled_${code}`, "1");

    (async () => {
      try {
        const finalized = await api.duoFinalize(code);
        setSession(finalized);
        setUser(finalized.user, finalized.requirements);
        nav("/jobs", { replace: true });
      } catch (e) {
        setError("Multi-factor finalization failed. Please sign in again.");
        nav("/login", { replace: true });
      }
    })();
  }, [location.search, nav]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setSubmitting(true);
    try {
      const data = await api.login(email, password);

      // If MFA required, go start Duo (server will redirect back with ?code=...)
      if (data?.mfa?.required && data?.mfa?.startUrl) {
        window.location.assign(data.mfa.startUrl);
        return;
      }

      setSession(data);

      const selectedRole = "bidder";
      const currentRole = (data.user?.userType || "").toLowerCase();

      if (currentRole !== selectedRole) {
        try {
          const roleResp = await api.updateRole(selectedRole);
          setUser(roleResp.user, roleResp.requirements ?? data.requirements);
        } catch (roleErr) {
          console.error("[Login] role switch failed", roleErr);
          setError("Unable to apply selected role. Please try again.");
          return;
        }
      } else {
        setUser(data.user, data.requirements);
      }

      if (!data.requirements.emailVerified) {
        setError(
          "Please verify your email address using the link we sent before logging in."
        );
        return;
      }

      nav("/jobs");
    } catch (err) {
      if (err?.status === 403 && err?.data?.error === "verification_required") {
        const details = err.data || {};
        if (details.emailVerification !== "verified") {
          setError("Please verify your email before logging in.");
        } else if (details.kycStatus !== "verified") {
          setError("Complete required verification steps before logging in.");
        } else {
          setError("Verification steps are incomplete.");
        }
      } else if (err?.status === 401) {
        setError("Incorrect email or password.");
      } else if (err?.status === 404) {
        setError("No account found for that email.");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card login-card">
        <div className="auth-card-header">
          <div className="auth-logo">
            <img src="/Images/OpenBidLogo.svg" alt="OpenBid logo" />
            <span>OpenBid</span>
          </div>
          <h2>Sign in</h2>
        </div>
        <Form className="auth-card-form" onSubmit={submit}>
          <TextInput
            id="email"
            labelText="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <PasswordInput
            id="password"
            labelText="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
          <div className="auth-links-row">
            <Link to="/signup">Need an account? Sign up</Link>
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
          {error && (
            <InlineNotification
              title="Error"
              subtitle={error}
              kind="error"
              lowContrast
              className="auth-notification"
            />
          )}
          {info && (
            <InlineNotification
              title="Success"
              subtitle={info}
              kind="success"
              lowContrast
              className="auth-notification"
            />
          )}
        </Form>
      </div>
    </div>
  );
}
