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
import reviewsRoutes from "./routes/reviews.routes.js";
import portfolioRoutes from "./routes/portfolio.routes.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_, res) =>
  res.json({ ok: true, prototype: config.prototype })
);

app.use("/api/auth", authRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/bids", bidsRoutes);
app.use("/api/password", passwordRoutes);
app.use("/api/auth/duo", duoRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/portfolio", portfolioRoutes);

// Webhook handler for Stripe Identity (only when not in prototype)
if (!config.prototype) {
  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const sig = req.headers["stripe-signature"];
      let event;

      try {
        const stripe = (await import("stripe")).default;
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

      // Handle the event
      if (event.type === "identity.verification_session.verified") {
        const verificationSession = event.data.object;
        const userId = verificationSession.metadata?.user_id;
        if (userId) {
          // Update user status in database
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

app.use((err, req, res, next) => {
  console.error("[server] error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(config.port, () => {
  console.log(
    `[server] listening on :${config.port} PROTOTYPE=${config.prototype}`
  );
});
