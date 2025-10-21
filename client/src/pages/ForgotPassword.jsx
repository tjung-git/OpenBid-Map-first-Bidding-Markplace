import { useState } from "react";
import {
  Form,
  TextInput,
  Button,
  InlineNotification,
} from "@carbon/react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import "../styles/pages/login.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setInfo("");
    setSubmitting(true);
    try {
      await api.forgotPassword(email);
      setInfo("Password reset link sent. Check your inbox.");
    } catch (err) {
      const message =
        err?.data?.error === "email_not_found"
          ? "Email does not exist. Unable to reset password."
          : err?.data?.error === "firebase_reset_failed"
          ? "Unable to request a reset right now. Please try again later."
          : "Unable to request a password reset. Please try again.";
      setError(message);
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
        <h2>Reset your password</h2>
        <TextInput
          id="email"
          labelText="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Button
          type="submit"
          className="auth-form-actions"
          disabled={submitting}
        >
          {submitting ? "Sending…" : "Send reset link"}
        </Button>
        <div className="auth-inline-link">
          <Link to="/login">Back to login</Link>
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
            title="Check your email"
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
