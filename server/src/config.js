import dotenv from "dotenv";
dotenv.config();

const env = (primary, fallback) =>
  process.env[primary] || process.env[fallback];

export const config = {
  prototype: (process.env.PROTOTYPE || "TRUE").toUpperCase() === "TRUE",
  port: Number(process.env.PORT || 4000),

  appUrl:
    (process.env.APP_URL && process.env.APP_URL.replace(/\/+$/, "")) ||
    "http://localhost:5173",

  firebase: {
    projectId: env("FIREBASE_PROJECT_ID", "APP_FIREBASE_PROJECT_ID"),
    clientEmail: env("FIREBASE_CLIENT_EMAIL", "APP_FIREBASE_CLIENT_EMAIL"),
    privateKey: env("FIREBASE_PRIVATE_KEY", "APP_FIREBASE_PRIVATE_KEY")?.replace(
      /\\n/g,
      "\n",
    ),
    apiKey: env("FIREBASE_WEB_API_KEY", "APP_FIREBASE_WEB_API_KEY"),
    storageBucket:
      (env("FIREBASE_STORAGE_BUCKET", "APP_FIREBASE_STORAGE_BUCKET")
        ? env("FIREBASE_STORAGE_BUCKET", "APP_FIREBASE_STORAGE_BUCKET")
            .replace(/^gs:\/\//, "")
            .replace(/\/+$/, "")
        : undefined) ||
      (env("FIREBASE_PROJECT_ID", "APP_FIREBASE_PROJECT_ID")
        ? `${env("FIREBASE_PROJECT_ID", "APP_FIREBASE_PROJECT_ID")}.appspot.com`
        : undefined),
  },

  emailVerificationRedirect:
    (process.env.EMAIL_VERIFICATION_REDIRECT &&
      process.env.EMAIL_VERIFICATION_REDIRECT.replace(/\/+$/, "")) ||
    (process.env.APP_URL && process.env.APP_URL.replace(/\/+$/, "")) ||
    "http://localhost:5173/login",

  stripe: {
    secretKey:
      process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY_FOR_PROD ||
      process.env.STRIPE_SECRET_KEY_FOR_TESTING,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },

  duo: {
    clientId: process.env.DUO_CLIENT_ID,
    clientSecret: process.env.DUO_CLIENT_SECRET,
    apiHost: process.env.DUO_API_HOST,
    redirectUri: process.env.DUO_REDIRECT_URI,
  },
};
