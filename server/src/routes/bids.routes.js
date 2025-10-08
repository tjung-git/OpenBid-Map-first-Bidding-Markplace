import { Router } from "express";
import { config } from "../config.js";
import { auth as mockAuth } from "../adapters/auth.mock.js";
import { auth as realAuth } from "../adapters/auth.real.js";
import { db as mockDb } from "../adapters/db.mock.js";
import { db as realDb } from "../adapters/db.real.js";

const router = Router();
const auth = config.prototype ? mockAuth : realAuth;
const db = config.prototype ? mockDb : realDb;

router.get("/:jobId", async (req, res, next) => {
  try {
    const bids = await db.bid.listByJob(req.params.jobId);
    res.json({ bids });
  } catch (e) {
    next(e);
  }
});

router.post("/:jobId", async (req, res, next) => {
  try {
    const s = await auth.verify(req);
    if (!s) return res.status(401).json({ error: "unauthorized" });
    const u = await db.user.get(s.uid);
    if (u?.kycStatus !== "verified")
      return res.status(403).json({ error: "KYC required" });
    const { amount, note } = req.body;
    const bid = await db.bid.create({
      jobId: req.params.jobId,
      providerId: s.uid,
      amount,
      note,
    });
    res.json({ bid });
  } catch (e) {
    next(e);
  }
});

export default router;
