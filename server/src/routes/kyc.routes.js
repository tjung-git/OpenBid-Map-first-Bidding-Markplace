import { Router } from "express";
import { config } from "../config.js";
import { auth as mockAuth } from "../adapters/auth.mock.js";
import { auth as realAuth } from "../adapters/auth.real.js";
import { kyc as mockKyc } from "../adapters/kyc.mock.js";
import { createRealKyc } from "../adapters/kyc.real.js";
import { db as mockDb } from "../adapters/db.mock.js";
import { db as realDb } from "../adapters/db.real.js";

const router = Router();
const auth = config.prototype ? mockAuth : realAuth;
const db = config.prototype ? mockDb : realDb;
const kyc = config.prototype ? mockKyc : createRealKyc(db);

router.post("/verification", async (req, res, next) => {
  try {
    const s = await auth.verify(req);
    if (!s) return res.status(401).json({ error: "unauthorized" });
    const r = await kyc.verification(s.uid);
    res.json(r);
  } catch (e) {
    next(e);
  }
});

router.get("/status", async (req, res, next) => {
  try {
    const s = await auth.verify(req);
    if (!s) return res.status(401).json({ error: "unauthorized" });
    const r = await kyc.status(s.uid);
    res.json(r);
  } catch (e) {
    next(e);
  }
});

// prototype helper to mark KYC passed
if (config.prototype) {
  router.post("/force-pass", async (req, res, next) => {
    try {
      const s = await auth.verify(req);
      if (!s) return res.status(401).json({ error: "unauthorized" });
      await mockKyc.forcePass(s.uid);
      const u = await db.user.get(s.uid);
      db.user.upsert({ ...u, kycStatus: "verified" });
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
}

export default router;
