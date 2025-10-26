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

app.use("/api/auth", authRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/bids", bidsRoutes);
app.use("/api/password", passwordRoutes);
app.use("/api/auth/duo", duoRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(config.port, () => {
  console.log(
    `[server] listening on :${config.port} PROTOTYPE=${config.prototype}`
  );
});
