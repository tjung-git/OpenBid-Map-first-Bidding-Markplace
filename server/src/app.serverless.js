import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config.js";
import authRoutes from "./routes/auth.routes.js";
import kycRoutes from "./routes/kyc.routes.js";
import jobsRoutes from "./routes/jobs.routes.js";
import bidsRoutes from "./routes/bids.routes.js";
import passwordRoutes from "./routes/password.routes.js";
import duoRoutes from "./routes/duo.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import messagesRoutes from "./routes/messages.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import reviewsRoutes from "./routes/reviews.routes.js";
import portfolioRoutes from "./routes/portfolio.routes.js";
import paymentsRoutes from "./routes/payments.routes.js";
import { db as mockDb } from "./adapters/db.mock.js";
import { db as realDb } from "./adapters/db.real.js";
import { requireRole, forbidRole } from "./middleware/requireRole.js";

function registerRoutes(app) {
  app.get("/api/health", (_, res) =>
    res.json({ ok: true, prototype: config.prototype })
  );

  app.use("/api/auth", authRoutes);
  app.use("/api/auth/duo", duoRoutes);
  app.use("/api/kyc", forbidRole("admin"), kycRoutes);
  app.use("/api/jobs", forbidRole("admin"), jobsRoutes);
  app.use("/api/bids", forbidRole("admin"), bidsRoutes);
  app.use("/api/password", forbidRole("admin"), passwordRoutes);
  app.use("/api/upload", forbidRole("admin"), uploadRoutes);
  app.use("/api/messages", forbidRole("admin"), messagesRoutes);
  app.use("/api/admin", requireRole("admin"), adminRoutes);
  app.use("/api/reviews", forbidRole("admin"), reviewsRoutes);
  app.use("/api/portfolio", forbidRole("admin"), portfolioRoutes);
  app.use("/api/payments", forbidRole("admin"), paymentsRoutes);
}

function registerStripeWebhook(app) {
  if (config.prototype) return;

  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const sig = req.headers["stripe-signature"];
      let event;

      try {
        const stripeModule = await import("stripe");
        const stripe = stripeModule.default;
        const stripeClient = new stripe(config.stripe.secretKey);
        event = stripeClient.webhooks.constructEvent(
          req.body,
          sig,
          config.stripe.webhookSecret
        );
      } catch (err) {
        console.log(`Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      if (event.type === "identity.verification_session.verified") {
        const verificationSession = event.data.object;
        const userId = verificationSession.metadata?.user_id;
        if (userId) {
          const { db } = await import("./adapters/db.real.js");
          const user = await db.user.get(userId);
          if (user) {
            await db.user.upsert({
              ...user,
              kycStatus: "verified",
            });
          }
        }
      }

      res.json({ received: true });
    }
  );
}

export function createServerlessApp() {
  const app = express();

  // Ensure DB adapter selection matches standard server entrypoint
  const db = config.prototype ? mockDb : realDb;
  app.locals.db = db;
  app.set("io", null);

  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(morgan("dev"));

  registerRoutes(app);
  registerStripeWebhook(app);

  app.use((err, req, res, next) => {
    console.error("[serverless] error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  });

  return app;
}

export const app = createServerlessApp();
