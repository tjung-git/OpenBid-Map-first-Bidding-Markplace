import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config.js";
import authRoutes from "./routes/auth.routes.js";
import kycRoutes from "./routes/kyc.routes.js";
import jobsRoutes from "./routes/jobs.routes.js";
import bidsRoutes from "./routes/bids.routes.js";
import { db as mockDb } from "./adapters/db.mock.js";
import { db as realDb } from "./adapters/db.real.js";

const app = express();
const db = config.prototype ? mockDb : realDb;
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_, res) =>
  res.json({ ok: true, prototype: config.prototype })
);

// Simple Firestore connectivity check used during bring-up.
app.get("/api/firebase-check", async (_req, res) => {
  if (config.prototype) {
    console.log("[firebase-check] Prototype mode; skipping Firestore ping.");
    return res.json({ ok: true, prototype: true, message: "Prototype mode" });
  }

  try {
    await db.job.list();
    console.log("[firebase-check] Firestore connection verified.");
    res.json({ ok: true, prototype: false });
  } catch (error) {
    console.error("[firebase-check] Firestore connection failed:", error);
    res.status(500).json({ ok: false, error: "Firestore connection failed" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/bids", bidsRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(config.port, () => {
  console.log(
    `[server] listening on :${config.port} PROTOTYPE=${config.prototype}`
  );
});
