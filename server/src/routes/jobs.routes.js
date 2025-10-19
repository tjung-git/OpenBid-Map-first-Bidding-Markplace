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

  let user = null;
  if (session.uid) {
    user = await db.user.get(session.uid);
  }
  if (!user && session.email) {
    user = await db.user.findByEmail(session.email.toLowerCase());
  }
  if (!user && req.header("x-user-id")) {
    user = await db.user.get(req.header("x-user-id"));
  }
  if (!user) {
    res.status(404).json({ error: "user_not_found" });
    return null;
  }

  if (user.uid && session.uid !== user.uid) {
    session.uid = user.uid;
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
    let contractor = null;
    if (job.posterId) {
      const contractorRecord = await db.user.get(job.posterId);
      if (contractorRecord) {
        const {
          passwordHash,
          kycStatus,
          emailVerification,
          ...rest
        } = contractorRecord;
        contractor = {
          uid: contractorRecord.uid,
          firstName: contractorRecord.firstName,
          lastName: contractorRecord.lastName,
          email: contractorRecord.email,
          userType: contractorRecord.userType,
          ...rest,
        };
      }
    }
    res.json({ job, contractor });
  } catch (e) {
    next(e);
  }
});

router.patch("/:jobId", async (req, res, next) => {
  try {
    const context = await requireContractor(req, res);
    if (!context) return;
    if (context.user.kycStatus !== "verified") {
      return res.status(403).json({ error: "KYC required" });
    }
    const jobId = req.params.jobId;
    const job = await db.job.get(jobId);
    if (!job) return res.status(404).json({ error: "not found" });
    if (job.posterId !== context.user.uid) {
      return res.status(403).json({ error: "forbidden" });
    }
    const fields = ["title", "description", "budgetAmount", "location", "status"];
    const patch = {};
    for (const key of fields) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "no_update_fields" });
    }
    const updated = await db.job.update(jobId, patch);
    res.json({ job: updated });
  } catch (e) {
    next(e);
  }
});

router.delete("/:jobId", async (req, res, next) => {
  try {
    const context = await requireContractor(req, res);
    if (!context) return;
    if (context.user.kycStatus !== "verified") {
      return res.status(403).json({ error: "KYC required" });
    }
    const jobId = req.params.jobId;
    const job = await db.job.get(jobId);
    if (!job) return res.status(404).json({ error: "not found" });
    if (job.posterId !== context.user.uid) {
      return res.status(403).json({ error: "forbidden" });
    }
    const deleted = await db.job.delete(jobId);
    if (!deleted) return res.status(404).json({ error: "not found" });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
