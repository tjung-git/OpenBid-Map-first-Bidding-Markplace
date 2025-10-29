import dotenv from "dotenv";
dotenv.config();

export const config = {
  prototype: (process.env.PROTOTYPE || "TRUE").toUpperCase() === "TRUE",
  port: Number(process.env.PORT || 4000),

  appUrl:
    (process.env.APP_URL && process.env.APP_URL.replace(/\/+$/, "")) ||
    "http://localhost:5173",

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    apiKey: process.env.FIREBASE_WEB_API_KEY,
  },

  emailVerificationRedirect:
    (process.env.EMAIL_VERIFICATION_REDIRECT &&
      process.env.EMAIL_VERIFICATION_REDIRECT.replace(/\/+$/, "")) ||
    (process.env.APP_URL && process.env.APP_URL.replace(/\/+$/, "")) ||
    "http://localhost:5173/login",

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY_FOR_TESTING,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },

  duo: {
    clientId: process.env.DUO_CLIENT_ID,
    clientSecret: process.env.DUO_CLIENT_SECRET,
    apiHost: process.env.DUO_API_HOST,
    redirectUri: process.env.DUO_REDIRECT_URI,
  },
};
