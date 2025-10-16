import { useState } from "react";
import {
  Form,
  TextInput,
  Button,
  Select,
  SelectItem,
  InlineNotification,
} from "@carbon/react";
import { api } from "../services/api";
import { useNavigate } from "react-router-dom";
import "../styles/pages/auth.css";

const INITIAL_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  userType: "bidder",
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

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.signup(form);
      const message =
        "Account created. Please verify your email before signing in.";
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
    <div className="container auth-form-container">
      <Form onSubmit={submit}>
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
        <Select
          id="userType"
          labelText="Account type"
          value={form.userType}
          onChange={(e) => updateField("userType", e.target.value)}
          required
        >
          <SelectItem value="bidder" text="Bidder" />
          <SelectItem value="contractor" text="Contractor" />
        </Select>
        <div className="auth-action-row">
          <Button
            type="submit"
            className="auth-form-actions"
            disabled={submitting}
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
  );
}
