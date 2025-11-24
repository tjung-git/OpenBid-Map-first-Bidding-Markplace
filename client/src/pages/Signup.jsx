import { useState } from "react";
import { Form, TextInput, Button, InlineNotification } from "@carbon/react";
import { api } from "../services/api";
import { useNavigate } from "react-router-dom";
import "../styles/pages/auth.css";

const INITIAL_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

export default function Signup() {
  // Handles account creation and immediately redirects to login with a reminder to verify email.
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const passwordsMatch =
    form.password.length > 0 && form.password === form.confirmPassword;

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!passwordsMatch) {
      setError("Passwords must match.");
      return;
    }
    setSubmitting(true);
    try {
      const { firstName, lastName, email, password, confirmPassword } = form;
      await api.signup({
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
      });
      const message =
        "Account created. Please verify your email before signing in.";
      try {
        sessionStorage.setItem("signup_notice", message);
      } catch (err) {
        console.warn("[Signup] unable to persist notice", err);
      }
      navigate("/login", {
        replace: true,
        state: { signupComplete: message },
      });
    } catch (err) {
      const message =
        err?.data?.error || "Unable to create account. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page-layout">
      <div className="auth-layout-intro">
        <div className="auth-intro-card">
          <div className="auth-intro-logo">
            <img src="/Images/OpenBidLogo.svg" alt="OpenBid logo" />
            <span>OpenBid</span>
          </div>
          <h1 className="auth-intro-title">Join OpenBid today</h1>
          <p className="auth-intro-text">
            Create an account to discover nearby projects, collaborate with trusted
            professionals, and manage every bid from a single dashboard.
          </p>
          <ul className="auth-intro-highlights">
            <li>Explore jobs on a live map before you bid</li>
            <li>Compare offers quickly with clear contractor details</li>
            <li>Secure payments when the work is delivered</li>
          </ul>
        </div>
      </div>
      <div className="auth-layout-form">
        <div className="auth-form-card">
          <Form className="auth-form" onSubmit={submit}>
            <div className="auth-logo">
              <img src="/Images/OpenBidLogo.svg" alt="OpenBid logo" />
              <span>OpenBid</span>
            </div>
            <h2>Create your account</h2>
            <TextInput
              id="firstName"
              labelText="First name"
              value={form.firstName}
              onChange={(e) => updateField("firstName", e.target.value)}
              required
            />
            <TextInput
              id="lastName"
              labelText="Last name"
              value={form.lastName}
              onChange={(e) => updateField("lastName", e.target.value)}
              required
            />
            <TextInput
              id="email"
              labelText="Email"
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              required
            />
            <TextInput
              id="password"
              labelText="Password"
              type="password"
              value={form.password}
              onChange={(e) => updateField("password", e.target.value)}
              helperText="Minimum 8 characters"
              required
            />
            <TextInput
              id="confirmPassword"
              labelText="Confirm password"
              type="password"
              value={form.confirmPassword}
              onChange={(e) => updateField("confirmPassword", e.target.value)}
              invalid={
                form.confirmPassword.length > 0 && !passwordsMatch
              }
              invalidText="Passwords must match"
              required
            />
            <div className="auth-action-row">
              <Button
                type="submit"
                className="auth-form-actions"
                disabled={
                  submitting || (form.confirmPassword && !passwordsMatch)
                }
              >
                {submitting ? "Creating…" : "Create account"}
              </Button>
              <Button
                kind="tertiary"
                className="auth-inline-link"
                onClick={() => navigate("/login")}
                disabled={submitting}
              >
                Already have an account? Sign in
              </Button>
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
          </Form>
        </div>
      </div>
    </div>
  );
}
