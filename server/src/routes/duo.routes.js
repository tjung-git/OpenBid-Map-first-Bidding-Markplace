import { Router } from "express";
import crypto from "crypto";
import { Client } from "@duosecurity/duo_universal";
import { config } from "../config.js";
import { getValid, putWithTTL, remove } from "../lib/duoState.js";

const router = Router();

function duoClient() {
  return new Client({
    clientId: config.duo.clientId,
    clientSecret: config.duo.clientSecret,
    apiHost: config.duo.apiHost,
    redirectUrl: config.duo.redirectUri || process.env.DUO_REDIRECT_URI,
  });
}

function appUrl(req) {
  const explicit = (config.appUrl || process.env.APP_URL || "").trim();
  if (/^https?:\/\//i.test(explicit)) return explicit.replace(/\/+$/, "");

  const ref = req.get("referer");
  if (ref) {
    try {
      const u = new URL(ref);
      return `${u.protocol}//${u.host}`;
    } catch {}
  }

  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.get("host") || "localhost:5173";
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function issueOtcFor(state, payload) {
  const otc = crypto.randomBytes(16).toString("hex");
  putWithTTL(otc, payload, 5 * 60 * 1000);
  return otc;
}

function normalizeVerdict(result) {
  if (typeof result?.success === "boolean") return result.success ? "ALLOW" : "DENY";
  const top = result?.auth_result ?? result?.result ?? result?.status;
  if (typeof top === "string") return top.toUpperCase();
  if (typeof top === "boolean") return top ? "ALLOW" : "DENY";
  if (top && typeof top === "object") {
    const candidates = [top.result, top.status, top.decision, top.outcome, top.verdict];
    for (const c of candidates) {
      if (typeof c === "string") return c.toUpperCase();
      if (typeof c === "boolean") return c ? "ALLOW" : "DENY";
    }
  }
  try {
    const s = JSON.stringify(result);
    const m = s.match(/"(?:auth_result|result|status|decision|outcome|verdict)"\s*:\s*"(ALLOW|DENY|SUCCESS|APPROVED|ALLOW_WITH_TRUST)"/i);
    if (m && m[1]) return m[1].toUpperCase();
  } catch {}
  return "";
}

function isAllowed(v) {
  return new Set(["ALLOW", "SUCCESS", "APPROVED", "ALLOW_WITH_TRUST"]).has(v);
}

// GET /api/auth/duo/start
router.get("/start", async (req, res) => {
  const appState = String(req.query.state || "");
  const pending = getValid(appState);
  if (!pending) return res.status(400).json({ error: "invalid_or_expired_state" });

  const client = duoClient();
  const duoState = client.generateState();

  const username = pending.email || pending.uid || "user";
  putWithTTL(duoState, { ...pending, __duoUsername: username }, 5 * 60 * 1000);

  try {
    const authUrl = await client.createAuthUrl(username, duoState);
    return res.redirect(authUrl);
  } catch (e) {
    console.error("[duo] createAuthUrl failed:", e);
    return res.status(500).json({ error: "duo_auth_url_failed" });
  }
});

// GET /api/auth/duo/callback
router.get("/callback", async (req, res) => {
  const state = String(req.query.state || "");
  const duoCode = String(req.query.duo_code || req.query.code || "");
  const base = appUrl(req);

  if (!state || !duoCode) {
    return res.redirect(`${base}/login?mfa=denied`);
  }

  const pending = getValid(state);
  if (!pending) {
    return res.redirect(`${base}/login?mfa=denied`);
  }

  const client = duoClient();
  const username = pending.__duoUsername || pending.email || pending.uid || "user";

  try {
    const result =
      (await client.exchangeAuthorizationCodeFor2FAResult?.(duoCode, username)) ??
      (await client.exchangeAuthorizationCodeFor2faResult?.(duoCode, username));

    const verdict = normalizeVerdict(result);
    console.log("[duo] preferred_username:", result?.preferred_username);
    console.log("[duo] normalized verdict:", verdict);

    if (isAllowed(verdict)) {
      const otc = issueOtcFor(state, { ...pending, duoOk: true });
      // const redirectTo = `${base}/login/finish?code=${otc}`;
      const redirectTo = `${base}/login?code=${otc}`;
      console.log("[duo] redirecting to:", redirectTo);
      return res.redirect(redirectTo);
    }
  } catch (e) {
    console.error("[duo] exchange failed:", e);
  }

  return res.redirect(`${base}/login?mfa=denied`);
});

// POST /api/auth/duo/finalize
router.post("/finalize", async (req, res) => {
  const code = String(req.body?.code || "");
  const data = getValid(code);
  if (!code || !data || !data.duoOk) {
    return res.status(400).json({ error: "invalid_or_expired_code" });
  }
  remove(code);
  return res.json(data.sessionPayload || {});
});

export default router;
