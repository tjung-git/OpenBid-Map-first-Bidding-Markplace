// routes/admin.routes.js
import { Router } from "express";
import { config } from "../config.js";
import { auth as mockAuth } from "../adapters/auth.mock.js";
import { auth as realAuth } from "../adapters/auth.real.js";
import { db as mockDb } from "../adapters/db.mock.js";
import { db as realDb } from "../adapters/db.real.js";
import { getDb } from "../lib/firebase.js";
import { Timestamp } from "firebase-admin/firestore";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();
router.use(requireRole("admin"));
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

async function resolveUserFromSession(req, session) {
  let user = null;

  if (session?.uid) user = await db.user.get(session.uid);

  if (!user && session?.email) {
    user = await db.user.findByEmail(String(session.email).toLowerCase());
  }

  if (!user && req.header("x-user-id")) {
    user = await db.user.get(req.header("x-user-id"));
  }
  if (!user && req.header("x-mock-uid")) {
    user = await db.user.get(req.header("x-mock-uid"));
  }

  return user;
}

async function requireAdmin(req, res) {
  const session = await auth.verify(req);
  if (!session) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }

  const user = await resolveUserFromSession(req, session);

  if (!user) {
    res.status(404).json({ error: "user_not_found" });
    return null;
  }

  if (user.uid && session.uid !== user.uid) session.uid = user.uid;

  if (String(user.userType || "").toLowerCase() !== "admin") {
    res.status(403).json({ error: "admin_only" });
    return null;
  }

  return { session, user };
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isIsoDateString(v) {
  if (typeof v !== "string") return false;
  const t = Date.parse(v);
  return Number.isFinite(t);
}

function isNonEmptyString(v, max = 500) {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}

function isStringOrEmpty(v, max = 500) {
  return v === "" || v === null || v === undefined || isNonEmptyString(v, max);
}

function isValidEmail(v) {
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (s.length < 3 || s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function asNumber(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function validateUserPatch(patch) {
  const errors = {};
  const out = {};

  const allowed = new Set([
    "firstName",
    "lastName",
    "email",
    "userType",
    "emailVerification",
    "kycStatus",
    "kycSessionId",
  ]);

  for (const [k, v] of Object.entries(patch || {})) {
    if (!allowed.has(k) || v === undefined) continue;

    if (k === "firstName" || k === "lastName") {
      if (v === null || v === "") {
        out[k] = "";
        continue;
      }
      if (!isNonEmptyString(v, 60)) errors[k] = "must_be_string_max_60";
      else out[k] = String(v).trim();
      continue;
    }

    if (k === "email") {
      if (v === null || v === "") {
        out[k] = "";
        continue;
      }
      if (!isValidEmail(v)) errors[k] = "must_be_valid_email";
      else out[k] = String(v).trim().toLowerCase();
      continue;
    }

    if (k === "userType") {
      if (v === null || v === "") {
        out[k] = "";
        continue;
      }
      const s = String(v).toLowerCase();
      const allowedRoles = new Set(["admin", "contractor", "bidder"]);
      if (!allowedRoles.has(s)) errors[k] = "invalid_userType";
      else out[k] = s;
      continue;
    }

    if (k === "emailVerification") {
      if (v === null || v === "") {
        out[k] = "";
        continue;
      }
      const s = String(v).toLowerCase();
      const allowedVals = new Set(["verified", "pending"]);
      if (!allowedVals.has(s)) errors[k] = "invalid_emailVerification";
      else out[k] = s;
      continue;
    }

    if (k === "kycStatus") {
      if (v === null || v === "") {
        out[k] = "";
        continue;
      }
      const s = String(v).toLowerCase();
      const allowedVals = new Set(["pending", "verified", "rejected"]);
      if (!allowedVals.has(s)) errors[k] = "invalid_kycStatus";
      else out[k] = s;
      continue;
    }

    if (k === "kycSessionId") {
      if (v === null || v === "") {
        out[k] = null;
        continue;
      }
      if (!isNonEmptyString(v, 200)) errors[k] = "must_be_string_max_200";
      else out[k] = String(v);
      continue;
    }
  }

  return { out, errors };
}

function validateLocation(v) {
  if (v === null || v === "") return { ok: true, value: "" };
  if (typeof v === "string") return { ok: true, value: v };
  if (!isPlainObject(v))
    return { ok: false, error: "location_must_be_object_or_string" };

  const out = {};
  if ("address" in v) {
    if (v.address === null || v.address === "") out.address = "";
    else if (!isNonEmptyString(v.address, 200))
      return { ok: false, error: "location.address_invalid" };
    else out.address = String(v.address);
  }

  if ("lat" in v) {
    const lat = asNumber(v.lat);
    if (lat === null || lat < -90 || lat > 90)
      return { ok: false, error: "location.lat_invalid" };
    out.lat = lat;
  }

  if ("lng" in v) {
    const lng = asNumber(v.lng);
    if (lng === null || lng < -180 || lng > 180)
      return { ok: false, error: "location.lng_invalid" };
    out.lng = lng;
  }

  if (Object.keys(out).length === 0)
    return { ok: false, error: "location_empty" };
  return { ok: true, value: out };
}

function validateJobPatch(patch) {
  const errors = {};
  const out = {};

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

  for (const [k, v] of Object.entries(patch || {})) {
    if (!allowed.has(k) || v === undefined) continue;

    if (k === "title") {
      if (v === null || v === "") {
        out.title = "";
        continue;
      }
      if (!isNonEmptyString(v, 120)) errors.title = "must_be_string_max_120";
      else out.title = String(v).trim();
      continue;
    }

    if (k === "description") {
      if (v === null || v === "") {
        out.description = "";
        continue;
      }
      if (typeof v !== "string" || v.length > 5000)
        errors.description = "must_be_string_max_5000";
      else out.description = v;
      continue;
    }

    if (k === "budgetAmount") {
      if (v === null || v === "") {
        out.budgetAmount = null;
        continue;
      }
      const n = asNumber(v);
      if (n === null || n < 0 || n > 1_000_000_000)
        errors.budgetAmount = "must_be_number_0_to_1e9";
      else out.budgetAmount = n;
      continue;
    }

    if (k === "location") {
      const loc = validateLocation(v);
      if (!loc.ok) errors.location = loc.error;
      else out.location = loc.value;
      continue;
    }

    if (k === "status") {
      if (v === null || v === "") {
        out.status = "";
        continue;
      }
      const s = String(v).toLowerCase();
      const allowedVals = new Set([
        "open",
        "completed",
        "awarded",
        "cancelled",
        "in_progress",
      ]);
      if (!allowedVals.has(s)) errors.status = "invalid_status";
      else out.status = s;
      continue;
    }

    if (k === "posterId") {
      if (v === null || v === "") {
        out.posterId = "";
        continue;
      }
      if (!isNonEmptyString(v, 80)) errors.posterId = "must_be_string_max_80";
      else out.posterId = String(v);
      continue;
    }

    if (k === "awardedBidId") {
      if (v === null || v === "") {
        out.awardedBidId = null;
        continue;
      }
      if (!isNonEmptyString(v, 120))
        errors.awardedBidId = "must_be_string_max_120";
      else out.awardedBidId = String(v);
      continue;
    }

    if (k === "awardedProviderId") {
      if (v === null || v === "") {
        out.awardedProviderId = null;
        continue;
      }
      if (!isNonEmptyString(v, 120))
        errors.awardedProviderId = "must_be_string_max_120";
      else out.awardedProviderId = String(v);
      continue;
    }

    if (k === "awardedAt") {
      if (v === null || v === "") {
        out.awardedAt = null;
        continue;
      }
      if (!isIsoDateString(v)) errors.awardedAt = "must_be_iso_date_string";
      else out.awardedAt = new Date(v).toISOString();
      continue;
    }
  }

  return { out, errors };
}

function validateBidPatch(patch) {
  const errors = {};
  const out = {};

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

  for (const [k, v] of Object.entries(patch || {})) {
    if (!allowed.has(k) || v === undefined) continue;

    if (k === "amount" || k === "jobBudgetAmount") {
      if (v === null || v === "") {
        out[k] = null;
        continue;
      }
      const n = asNumber(v);
      if (n === null || n < 0 || n > 1_000_000_000)
        errors[k] = "must_be_number_0_to_1e9";
      else out[k] = n;
      continue;
    }

    if (k === "note" || k === "statusNote" || k === "jobTitle") {
      if (v === null || v === "") {
        out[k] = "";
        continue;
      }
      if (typeof v !== "string" || v.length > 2000)
        errors[k] = "must_be_string_max_2000";
      else out[k] = v;
      continue;
    }

    if (k === "bidderName" || k === "contractorName") {
      if (v === null || v === "") {
        out[k] = "";
        continue;
      }
      if (!isNonEmptyString(v, 120)) errors[k] = "must_be_string_max_120";
      else out[k] = String(v).trim();
      continue;
    }

    if (k === "providerId" || k === "contractorId" || k === "jobId") {
      if (v === null || v === "") {
        out[k] = "";
        continue;
      }
      if (!isNonEmptyString(v, 120)) errors[k] = "must_be_string_max_120";
      else out[k] = String(v);
      continue;
    }

    if (k === "jobDescription") {
      if (v === null || v === "") {
        out.jobDescription = "";
        continue;
      }
      if (typeof v !== "string" || v.length > 5000)
        errors.jobDescription = "must_be_string_max_5000";
      else out.jobDescription = v;
      continue;
    }

    if (k === "jobLocation") {
      const loc = validateLocation(v);
      if (!loc.ok) errors.jobLocation = loc.error;
      else out.jobLocation = loc.value;
      continue;
    }

    if (k === "status") {
      if (v === null || v === "") {
        out.status = "";
        continue;
      }
      const s = String(v).toLowerCase();
      const allowedVals = new Set([
        "active",
        "declined",
        "accepted",
        "cancelled",
      ]);
      if (!allowedVals.has(s)) errors.status = "invalid_status";
      else out.status = s;
      continue;
    }

    if (k === "bidClosedAt") {
      if (v === null || v === "") {
        out.bidClosedAt = null;
        continue;
      }
      if (!isIsoDateString(v)) errors.bidClosedAt = "must_be_iso_date_string";
      else out.bidClosedAt = new Date(v).toISOString();
      continue;
    }
  }

  return { out, errors };
}

async function listAllUsersReal() {
  const snapshot = await getDb().collection(collections.users).get();
  return snapshot.docs
    .map((d) => normalizeFirestoreRecord(d, "uid"))
    .filter(Boolean);
}

async function deleteUserReal(uid) {
  const dbRef = getDb();

  const ref = dbRef.collection(collections.users).doc(uid);
  const snap = await ref.get();
  if (!snap.exists) return false;

  await ref.delete();

  const bidsSnap = await dbRef
    .collection(collections.bids)
    .where("providerId", "==", uid)
    .get();

  if (!bidsSnap.empty) {
    const batch = dbRef.batch();
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

    if (!config.prototype) {
      const users = await listAllUsersReal();
      return res.json({ users: users.map(sanitizeUser) });
    }

    return res.status(501).json({
      error: "not_implemented",
      detail: "db.user.list() missing in prototype mode (db.mock).",
    });
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

    const { out, errors } = validateUserPatch(req.body || {});
    if (Object.keys(errors).length) {
      return res.status(400).json({ error: "invalid_fields", fields: errors });
    }

    if (Object.keys(out).length === 0) {
      return res.status(400).json({ error: "no_update_fields" });
    }

    out.updatedAt = new Date().toISOString();

    const updated = await db.user.update(uid, out);
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

    const target = await db.user.get(uid);
    if (!target) return res.status(404).json({ error: "not_found" });

    if ((target.userType || "").toLowerCase() === "admin") {
      return res.status(409).json({ error: "cannot_delete_admin" });
    }

    if (typeof db.user.delete === "function") {
      const ok = await db.user.delete(uid);
      if (!ok) return res.status(404).json({ error: "not_found" });
      return res.status(204).end();
    }

    if (!config.prototype) {
      const ok = await deleteUserReal(uid);
      if (!ok) return res.status(404).json({ error: "not_found" });
      return res.status(204).end();
    }

    return res.status(501).json({
      error: "not_implemented",
      detail: "db.user.delete() missing in prototype mode (db.mock).",
    });
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

    const { out, errors } = validateJobPatch(req.body || {});
    if (Object.keys(errors).length) {
      return res.status(400).json({ error: "invalid_fields", fields: errors });
    }

    if (Object.keys(out).length === 0) {
      return res.status(400).json({ error: "no_update_fields" });
    }

    const updated = await db.job.update(jobId, out);
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
      bids.sort((a, b) => {
        const aCreated = new Date(a.bidCreatedAt || a.createdAt || 0).getTime();
        const bCreated = new Date(b.bidCreatedAt || b.createdAt || 0).getTime();
        return bCreated - aCreated;
      });
      return res.json({ bids });
    }

    if (!config.prototype) {
      const bids = await listAllBidsReal();
      bids.sort((a, b) => {
        const aCreated = new Date(a.bidCreatedAt || a.createdAt || 0).getTime();
        const bCreated = new Date(b.bidCreatedAt || b.createdAt || 0).getTime();
        return bCreated - aCreated;
      });
      return res.json({ bids });
    }

    return res.status(501).json({
      error: "not_implemented",
      detail: "db.bid.list() missing in prototype mode (db.mock).",
    });
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

    const { out, errors } = validateBidPatch(req.body || {});
    if (Object.keys(errors).length) {
      return res.status(400).json({ error: "invalid_fields", fields: errors });
    }

    if (Object.keys(out).length === 0) {
      return res.status(400).json({ error: "no_update_fields" });
    }

    out.bidUpdatedAt = new Date().toISOString();

    const updated = await db.bid.update(bidId, out);
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
