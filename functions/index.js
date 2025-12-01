import "dotenv/config";
import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2/options";

setGlobalOptions({
  region: "us-central1",
  memory: "1GiB",
  timeoutSeconds: 120,
});

let cachedApp;
let envLoaded = false;

const envMappings = [
  { target: "PROTOTYPE", sources: ["PROTOTYPE"] },
  { target: "APP_NAME", sources: ["APP_NAME"] },
  { target: "APP_URL", sources: ["APP_URL"] },
  {
    target: "EMAIL_VERIFICATION_REDIRECT",
    sources: ["EMAIL_VERIFICATION_REDIRECT"],
  },
  { target: "DUO_CLIENT_ID", sources: ["DUO_CLIENT_ID"] },
  { target: "DUO_CLIENT_SECRET", sources: ["DUO_CLIENT_SECRET"] },
  { target: "DUO_API_HOST", sources: ["DUO_API_HOST"] },
  { target: "DUO_REDIRECT_URI", sources: ["DUO_REDIRECT_URI"] },
  {
    target: "STRIPE_SECRET_KEY_FOR_TESTING",
    sources: ["STRIPE_SECRET_KEY_FOR_TESTING"],
  },
  {
    target: "STRIPE_SECRET_KEY_FOR_PROD",
    sources: ["STRIPE_SECRET_KEY_FOR_PROD"],
  },
  {
    target: "STRIPE_WEBHOOK_SECRET",
    sources: ["STRIPE_WEBHOOK_SECRET"],
  },
  {
    target: "FIREBASE_PROJECT_ID",
    sources: ["FIREBASE_PROJECT_ID", "APP_FIREBASE_PROJECT_ID"],
  },
  {
    target: "FIREBASE_CLIENT_EMAIL",
    sources: ["FIREBASE_CLIENT_EMAIL", "APP_FIREBASE_CLIENT_EMAIL"],
  },
  {
    target: "FIREBASE_PRIVATE_KEY",
    sources: ["FIREBASE_PRIVATE_KEY", "APP_FIREBASE_PRIVATE_KEY"],
  },
  {
    target: "FIREBASE_WEB_API_KEY",
    sources: ["FIREBASE_WEB_API_KEY", "APP_FIREBASE_WEB_API_KEY"],
  },
];

function loadEnv() {
  if (envLoaded) return;

  const setIfMissing = (target, value) => {
    if (
      process.env[target] === undefined &&
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      process.env[target] = value;
    }
  };

  envMappings.forEach(({ target, sources }) => {
    sources.some((source) => {
      const value = process.env[source];
      setIfMissing(target, value);
      return process.env[target] !== undefined;
    });
  });

  envLoaded = true;
}

async function getApp() {
  if (!cachedApp) {
    loadEnv();
    const module = await import("openbid-server/src/app.serverless.js");
    cachedApp = module.app;
  }
  return cachedApp;
}

export const api = onRequest(async (req, res) => {
  try {
    const app = await getApp();
    app(req, res);
  } catch (error) {
    console.error("[functions] failed to initialize app", error);
    res.status(500).json({ error: "Function initialization error" });
  }
});
