import { Router } from "express";
import { config } from "../config.js";
import { auth as mockAuth } from "../adapters/auth.mock.js";
import { auth as realAuth } from "../adapters/auth.real.js";
import { db as mockDb } from "../adapters/db.mock.js";
import { db as realDb } from "../adapters/db.real.js";

const router = Router();
const auth = config.prototype ? mockAuth : realAuth;
const db = config.prototype ? mockDb : realDb;

async function requireContractor(req, res) {
  const session = await auth.verify(req);
  if (!session) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }

  const user = await db.user.get(session.uid);
  if (!user) {
    res.status(404).json({ error: "user_not_found" });
    return null;
  }

  if ((user.userType || "").toLowerCase() !== "contractor") {
    res.status(403).json({ error: "contractor_only" });
    return null;
  }

  return { session, user };
}

router.get("/", async (req, res, next) => {
  try {
    const filterMine = String(req.query.mine || "false").toLowerCase() === "true";
    let uid = null;

    if (filterMine) {
      const context = await requireContractor(req, res);
      if (!context) return;
      uid = context.user.uid;
    } else {
      const session = await auth.verify(req);
      if (!session) return res.status(401).json({ error: "unauthorized" });
      uid = session.uid;
    }

    const jobs = await db.job.list();
    const filtered = filterMine
      ? jobs.filter((job) => job.posterId === uid)
      : jobs;
    res.json({ jobs: filtered });
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const context = await requireContractor(req, res);
    if (!context) return;
    if (context.user.kycStatus !== "verified") {
      return res.status(403).json({ error: "KYC required" });
    }
    const { title, description, budgetAmount, location } = req.body;
    const job = await db.job.create({
      posterId: context.user.uid,
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
    const session = await auth.verify(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });
    const job = await db.job.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: "not found" });
    res.json({ job });
  } catch (e) {
    next(e);
  }
});

export default router;
