import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { defineSecret } from "firebase-functions/params";

const secretParams = {
  prototype: defineSecret("PROTOTYPE"),
  appName: defineSecret("APP_NAME"),
  appUrl: defineSecret("APP_URL"),
  emailVerificationRedirect: defineSecret("EMAIL_VERIFICATION_REDIRECT"),
  duoClientId: defineSecret("DUO_CLIENT_ID"),
  duoClientSecret: defineSecret("DUO_CLIENT_SECRET"),
  duoApiHost: defineSecret("DUO_API_HOST"),
  duoRedirectUri: defineSecret("DUO_REDIRECT_URI"),
  stripeSecretKeyForTesting: defineSecret("STRIPE_SECRET_KEY_FOR_TESTING"),
  stripeSecretKeyForProd: defineSecret("STRIPE_SECRET_KEY_FOR_PROD"),
  stripeWebhookSecret: defineSecret("STRIPE_WEBHOOK_SECRET"),
  firebaseProjectId: defineSecret("APP_FIREBASE_PROJECT_ID"),
  firebaseClientEmail: defineSecret("APP_FIREBASE_CLIENT_EMAIL"),
  firebasePrivateKey: defineSecret("APP_FIREBASE_PRIVATE_KEY"),
  firebaseWebApiKey: defineSecret("APP_FIREBASE_WEB_API_KEY"),
};

const secretList = Object.values(secretParams);

setGlobalOptions({
  region: "us-central1",
  memory: "1GiB",
  timeoutSeconds: 120,
  secrets: secretList,
});

let cachedApp;
let secretsLoaded = false;

function loadSecrets() {
  if (secretsLoaded) return;

  const setIfValue = (key, value) => {
    if (value !== undefined && value !== null) {
      process.env[key] = value;
    }
  };

  setIfValue("PROTOTYPE", secretParams.prototype.value());
  setIfValue("APP_NAME", secretParams.appName.value());
  setIfValue("APP_URL", secretParams.appUrl.value());
  setIfValue(
    "EMAIL_VERIFICATION_REDIRECT",
    secretParams.emailVerificationRedirect.value()
  );
  setIfValue("DUO_CLIENT_ID", secretParams.duoClientId.value());
  setIfValue("DUO_CLIENT_SECRET", secretParams.duoClientSecret.value());
  setIfValue("DUO_API_HOST", secretParams.duoApiHost.value());
  setIfValue("DUO_REDIRECT_URI", secretParams.duoRedirectUri.value());
  setIfValue(
    "STRIPE_SECRET_KEY_FOR_TESTING",
    secretParams.stripeSecretKeyForTesting.value()
  );
  setIfValue(
    "STRIPE_SECRET_KEY_FOR_PROD",
    secretParams.stripeSecretKeyForProd.value()
  );
  setIfValue(
    "STRIPE_WEBHOOK_SECRET",
    secretParams.stripeWebhookSecret.value()
  );
  setIfValue(
    "FIREBASE_PROJECT_ID",
    secretParams.firebaseProjectId.value()
  );
  setIfValue(
    "FIREBASE_CLIENT_EMAIL",
    secretParams.firebaseClientEmail.value()
  );
  setIfValue(
    "FIREBASE_PRIVATE_KEY",
    secretParams.firebasePrivateKey.value()
  );
  setIfValue(
    "FIREBASE_WEB_API_KEY",
    secretParams.firebaseWebApiKey.value()
  );

  secretsLoaded = true;
}

async function getApp() {
  if (!cachedApp) {
    loadSecrets();
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
