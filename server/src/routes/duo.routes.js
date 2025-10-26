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
    redirectUrl: process.env.DUO_REDIRECT_URI,
  });
}

// 1) Start Duo (browser redirect)
router.get("/start", (req, res) => {
  const state = String(req.query.state || "");
  const pending = getValid(state);
  if (!pending) return res.status(400).json({ error: "invalid_or_expired_state" });

  const client = duoClient();
  const username = pending.email || pending.uid;

  // SDK signature is (username, state)
  const authUrl = client.createAuthUrl(username, state);
  return res.redirect(authUrl);
});

// 2) Duo callback
router.get("/callback", async (req, res, next) => {
  try {
    const client = duoClient();
    const { state, code } = req.query;

    const pending = getValid(String(state || ""));
    if (!pending) return res.status(400).send("Login expired. Please sign in again.");

    const username = pending.email || pending.uid;

    // SDK signature is (duoCode, username)
    const result = await client.exchangeAuthorizationCodeFor2FAResult(code, username);
    if (result.result !== "allow") {
      remove(String(state));
      return res.redirect(`${process.env.APP_URL}/login?mfa=denied`);
    }

    const otc = crypto.randomBytes(24).toString("hex");
    putWithTTL(otc, { ...pending, duoOk: true }, 60 * 1000);
    remove(String(state));

    return res.redirect(`${process.env.APP_URL}/login/finish?code=${otc}`);
  } catch (err) {
    next(err);
  }
});

// 3) Finalize
router.post("/finalize", async (req, res) => {
  const { code } = req.body || {};
  const pending = getValid(String(code || ""));
  if (!pending || !pending.duoOk) {
    return res.status(400).json({ error: "invalid_or_expired_code" });
  }
  remove(String(code));
  return res.json(pending.sessionPayload);
});

export default router;
