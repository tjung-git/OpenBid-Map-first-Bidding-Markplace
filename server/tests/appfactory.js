import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import authRoutes from "../src/routes/auth.routes.js";
import jobsRoutes from "../src/routes/jobs.routes.js";
import bidsRoutes from "../src/routes/bids.routes.js";
import passwordRoutes from "../src/routes/password.routes.js";
import duoRoutes from "../src/routes/duo.routes.js";
import { config } from "../src/config.js";

export function makeTestApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(morgan("tiny"));

  app.get("/api/health", (_, res) =>
    res.json({ ok: true, prototype: config.prototype })
  );

  app.use("/api/auth", authRoutes);
  app.use("/api/jobs", jobsRoutes);
  app.use("/api/bids", bidsRoutes);
  app.use("/api/password", passwordRoutes);
  app.use("/api/auth/duo", duoRoutes);

  app.use((err, req, res, next) => {
    console.error("[test app] error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  });

  return app;
}
