import { useEffect, useState } from "react";
import {
  Form,
  TextInput,
  Button,
  InlineNotification,
  PasswordInput,
} from "@carbon/react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { setSession } from "../services/session";
import "../styles/pages/login.css";

export default function Login() {
  // Authenticates the user, caches verification requirements, and routes based on email/KYC status.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const nav = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.signupComplete) {
      setInfo(location.state.signupComplete);
    }
  }, [location.state]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setSubmitting(true);
    try {
      const data = await api.login(email, password);
      setSession(data);

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
    <div className="container auth-container">
      <Form onSubmit={submit}>
        <div className="auth-logo">
          <img src="/Images/OpenBidLogo.svg" alt="OpenBid logo" />
          <span>OpenBid</span>
        </div>
        <h2>Sign in</h2>
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
        <Button
          type="submit"
          className="auth-form-actions"
          disabled={submitting}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
        <div className="auth-inline-link">
          <Link to="/signup">Need an account? Sign up</Link>
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
  );
}
