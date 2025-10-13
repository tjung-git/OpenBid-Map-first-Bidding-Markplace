import { config } from "../config.js";

const API_BASE = "https://identitytoolkit.googleapis.com/v1";

class FirebaseIdentityError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "FirebaseIdentityError";
    this.status = status;
    this.code = code;
  }
}

function apiKey() {
  const key = config.firebase.apiKey;
  if (!key) {
    throw new Error(
      "Missing Firebase Web API key. Set FIREBASE_WEB_API_KEY to enable Auth REST calls."
    );
  }
  return key;
}

async function request(path, payload) {
  const response = await fetch(`${API_BASE}/${path}?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message || `${path} failed`;
    throw new FirebaseIdentityError(message, response.status, body?.error?.code);
  }

  return body;
}

// Sign up users through the REST API so Firebase issues verification emails automatically.
export async function signUpWithEmailPassword(email, password) {
  const body = await request("accounts:signUp", {
    email,
    password,
    returnSecureToken: true,
  });
  return {
    uid: body.localId,
    idToken: body.idToken,
    refreshToken: body.refreshToken,
  };
}

// Trigger Firebase's built-in verification email for the newly issued ID token.
export async function sendVerificationEmail(idToken) {
  if (!idToken) {
    throw new Error("idToken required to send verification email");
  }
  const payload = {
    requestType: "VERIFY_EMAIL",
    idToken,
  };
  if (config.emailVerificationRedirect) {
    payload.continueUrl = config.emailVerificationRedirect;
  }
  await request("accounts:sendOobCode", payload);
}

export async function deleteAccount(idToken) {
  if (!idToken) return;
  try {
    await request("accounts:delete", { idToken });
  } catch (error) {
    console.error("[auth] Failed to roll back Firebase Auth account", error);
  }
}

export { FirebaseIdentityError };
