// routes/admin.routes.js
import { Router } from "express";
import { config } from "../config.js";
import { auth as mockAuth } from "../adapters/auth.mock.js";
import { auth as realAuth } from "../adapters/auth.real.js";
import { db as mockDb } from "../adapters/db.mock.js";
import { db as realDb } from "../adapters/db.real.js";
import { getDb } from "../lib/firebase.js";
import { Timestamp } from "firebase-admin/firestore";

const router = Router();
const auth = config.prototype ? mockAuth : realAuth;
const db = config.prototype ? mockDb : realDb;

const collections = {
  users: "users",
  jobs: "jobs",
  bids: "bids",
};

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

function normalizeFirestoreRecord(docSnap, idKey = "id") {
  if (!docSnap?.exists) return null;
  const data = docSnap.data() || {};

  for (const key of Object.keys(data)) {
    if (data[key] instanceof Timestamp) {
      data[key] = data[key].toDate().toISOString();
    }
  }

  if (data.jobID && !data.jobId) data.jobId = data.jobID;
  delete data.jobID;

  return { [idKey]: docSnap.id, ...data };
}

async function requireAdmin(req, res) {
  const session = await auth.verify(req);
  if (!session) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }

  let user = null;
  if (session.uid) user = await db.user.get(session.uid);
  if (!user && session.email)
    user = await db.user.findByEmail(String(session.email).toLowerCase());
  if (!user && req.header("x-user-id"))
    user = await db.user.get(req.header("x-user-id"));

  if (!user) {
    res.status(404).json({ error: "user_not_found" });
    return null;
  }

  if (user.uid && session.uid !== user.uid) session.uid = user.uid;

  if (String(user.userType).toLowerCase() !== "admin") {
    res.status(403).json({ error: "admin_only" });
    return null;
  }

  return { session, user };
}

async function listAllUsersReal() {
  const snapshot = await getDb().collection(collections.users).get();
  return snapshot.docs
    .map((d) => normalizeFirestoreRecord(d, "uid"))
    .filter(Boolean);
}

async function deleteUserReal(uid) {
  const ref = getDb().collection(collections.users).doc(uid);
  const snap = await ref.get();
  if (!snap.exists) return false;

  await ref.delete();

  const bidsSnap = await getDb()
    .collection(collections.bids)
    .where("providerId", "==", uid)
    .get();

  if (!bidsSnap.empty) {
    const batch = getDb().batch();
    bidsSnap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  return true;
}

async function listAllBidsReal() {
  const snapshot = await getDb().collection(collections.bids).get();
  return snapshot.docs.map((d) => normalizeFirestoreRecord(d)).filter(Boolean);
}

router.get("/users", async (req, res, next) => {
  try {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;

    if (typeof db.user.list === "function") {
      const users = await db.user.list();
      return res.json({ users: users.map(sanitizeUser) });
    }

    if (config.prototype) {
      return res.status(501).json({
        error: "not_implemented",
        detail: "db.user.list() missing in prototype mode (db.mock).",
      });
    }

    const users = await listAllUsersReal();
    return res.json({ users: users.map(sanitizeUser) });
  } catch (e) {
    next(e);
  }
});

router.get("/users/:uid", async (req, res, next) => {
  try {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;

    const user = await db.user.get(req.params.uid);
    if (!user) return res.status(404).json({ error: "not_found" });

    return res.json({ user: sanitizeUser(user) });
  } catch (e) {
    next(e);
  }
});

router.patch("/users/:uid", async (req, res, next) => {
  try {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;

    const uid = req.params.uid;
    const existing = await db.user.get(uid);
    if (!existing) return res.status(404).json({ error: "not_found" });

    // Keep this conservative: don't allow passwordHash updates via admin
    const allowed = new Set([
      "firstName",
      "lastName",
      "email",
      "userType",
      "emailVerification",
      "kycStatus",
      "kycSessionId",
    ]);

    const patch = {};
    for (const [k, v] of Object.entries(req.body || {})) {
      if (allowed.has(k) && v !== undefined) patch[k] = v;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "no_update_fields" });
    }

    patch.updatedAt = new Date().toISOString();

    const updated = await db.user.update(uid, patch);
    if (!updated) return res.status(404).json({ error: "not_found" });

    return res.json({ user: sanitizeUser(updated) });
  } catch (e) {
    next(e);
  }
});

router.delete("/users/:uid", async (req, res, next) => {
  try {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;

    const uid = req.params.uid;

    if (ctx.user?.uid && ctx.user.uid === uid) {
      return res.status(409).json({ error: "cannot_delete_self" });
    }
    if (typeof db.user.delete === "function") {
      const ok = await db.user.delete(uid);
      if (!ok) return res.status(404).json({ error: "not_found" });
      return res.status(204).end();
    }

    if (config.prototype) {
      return res.status(501).json({
        error: "not_implemented",
        detail: "db.user.delete() missing in prototype mode (db.mock).",
      });
    }

    const ok = await deleteUserReal(uid);
    if (!ok) return res.status(404).json({ error: "not_found" });
    return res.status(204).end();
  } catch (e) {
    next(e);
  }
});

router.get("/jobs", async (req, res, next) => {
  try {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;

    const jobs = await db.job.list();
    return res.json({ jobs });
  } catch (e) {
    next(e);
  }
});

router.get("/jobs/:jobId", async (req, res, next) => {
  try {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;

    const job = await db.job.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: "not_found" });

    return res.json({ job });
  } catch (e) {
    next(e);
  }
});

router.patch("/jobs/:jobId", async (req, res, next) => {
  try {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;

    const jobId = req.params.jobId;
    const existing = await db.job.get(jobId);
    if (!existing) return res.status(404).json({ error: "not_found" });

    const allowed = new Set([
      "title",
      "description",
      "budgetAmount",
      "location",
      "status",
      "posterId",
      "awardedBidId",
      "awardedProviderId",
      "awardedAt",
    ]);

    const patch = {};
    for (const [k, v] of Object.entries(req.body || {})) {
      if (allowed.has(k) && v !== undefined) patch[k] = v;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "no_update_fields" });
    }

    const updated = await db.job.update(jobId, patch);
    if (!updated) return res.status(404).json({ error: "not_found" });

    return res.json({ job: updated });
  } catch (e) {
    next(e);
  }
});

router.delete("/jobs/:jobId", async (req, res, next) => {
  try {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;

    const ok = await db.job.delete(req.params.jobId);
    if (!ok) return res.status(404).json({ error: "not_found" });

    return res.status(204).end();
  } catch (e) {
    next(e);
  }
});

router.get("/bids", async (req, res, next) => {
  try {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;

    if (typeof db.bid.list === "function") {
      const bids = await db.bid.list();
      return res.json({ bids });
    }

    if (config.prototype) {
      return res.status(501).json({
        error: "not_implemented",
        detail: "db.bid.list() missing in prototype mode (db.mock).",
      });
    }

    const bids = await listAllBidsReal();
    bids.sort((a, b) => {
      const aCreated = new Date(a.bidCreatedAt || a.createdAt || 0).getTime();
      const bCreated = new Date(b.bidCreatedAt || b.createdAt || 0).getTime();
      return bCreated - aCreated;
    });

    return res.json({ bids });
  } catch (e) {
    next(e);
  }
});

router.get("/bids/:bidId", async (req, res, next) => {
  try {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;

    const bid = await db.bid.get(req.params.bidId);
    if (!bid) return res.status(404).json({ error: "not_found" });

    return res.json({ bid });
  } catch (e) {
    next(e);
  }
});

router.get("/bids/by-job/:jobId", async (req, res, next) => {
  try {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;

    const bids = await db.bid.listByJob(req.params.jobId);
    return res.json({ bids });
  } catch (e) {
    next(e);
  }
});

router.get("/bids/by-user/:uid", async (req, res, next) => {
  try {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;

    const bids = await db.bid.listByUser(req.params.uid);
    return res.json({ bids });
  } catch (e) {
    next(e);
  }
});

router.patch("/bids/:bidId", async (req, res, next) => {
  try {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;

    const bidId = req.params.bidId;
    const existing = await db.bid.get(bidId);
    if (!existing) return res.status(404).json({ error: "not_found" });

    const allowed = new Set([
      "amount",
      "note",
      "status",
      "statusNote",
      "bidClosedAt",
      "providerId",
      "bidderName",
      "contractorId",
      "contractorName",
      "jobId",
      "jobTitle",
      "jobDescription",
      "jobBudgetAmount",
      "jobLocation",
    ]);

    const patch = {};
    for (const [k, v] of Object.entries(req.body || {})) {
      if (allowed.has(k) && v !== undefined) patch[k] = v;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "no_update_fields" });
    }

    // Your db.bid.update writes updatedAt serverTimestamp; keep bidUpdatedAt consistent with your app
    patch.bidUpdatedAt = new Date().toISOString();

    const updated = await db.bid.update(bidId, patch);
    if (!updated) return res.status(404).json({ error: "not_found" });

    return res.json({ bid: updated });
  } catch (e) {
    next(e);
  }
});

router.delete("/bids/:bidId", async (req, res, next) => {
  try {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;

    const ok = await db.bid.delete(req.params.bidId);
    if (!ok) return res.status(404).json({ error: "not_found" });

    return res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
