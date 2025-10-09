import { Router } from "express";
import { config } from "../config.js";
import { auth as mockAuth } from "../adapters/auth.mock.js";
import { auth as realAuth } from "../adapters/auth.real.js";
import { db as mockDb } from "../adapters/db.mock.js";
import { db as realDb } from "../adapters/db.real.js";

const router = Router();
const auth = config.prototype ? mockAuth : realAuth;
const db = config.prototype ? mockDb : realDb;

router.get("/", async (req, res, next) => {
  try {
    const jobs = await db.job.list();
    res.json({ jobs });
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const s = await auth.verify(req);
    if (!s) return res.status(401).json({ error: "unauthorized" });
    const u = await db.user.get(s.uid);
    if (u?.kycStatus !== "verified")
      return res.status(403).json({ error: "KYC required" });
    const { title, description, budgetAmount, location } = req.body;
    const job = await db.job.create({
      posterId: s.uid,
      title,
      description,
      budgetAmount,
      location,
    });
    res.json({ job });
  } catch (e) {
    next(e);
  }
});

router.get("/:jobId", async (req, res, next) => {
  try {
    const job = await db.job.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: "not found" });
    res.json({ job });
  } catch (e) {
    next(e);
  }
});

export default router;
