import dotenv from "dotenv";
dotenv.config();

export const config = {
  prototype: (process.env.PROTOTYPE || "TRUE").toUpperCase() === "TRUE",
  port: process.env.PORT || 4000,
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    apiKey: process.env.FIREBASE_WEB_API_KEY,
  },
  // URL Firebase should redirect to after email verification completes.
  emailVerificationRedirect:
    process.env.EMAIL_VERIFICATION_REDIRECT ||
    process.env.APP_URL ||
    "http://localhost:5176/login", // your local host/login
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    identityTemplate: process.env.STRIPE_IDENTITY_VERIFICATION_TEMPLATE,
  },
  duo: {
    clientId: process.env.DUO_CLIENT_ID,
    clientSecret: process.env.DUO_CLIENT_SECRET,
    apiHost: process.env.DUO_API_HOST,
  },
};
