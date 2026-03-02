import { config } from "../config.js";
import { auth as mockAuth } from "../adapters/auth.mock.js";
import { auth as realAuth } from "../adapters/auth.real.js";
import { db as mockDb } from "../adapters/db.mock.js";
import { db as realDb } from "../adapters/db.real.js";

const auth = config.prototype ? mockAuth : realAuth;
const db = config.prototype ? mockDb : realDb;

async function resolveUserFromRequest(req, session) {
  let user = null;

  if (session?.uid) user = await db.user.get(session.uid);

  if (!user && session?.email) {
    user = await db.user.findByEmail(session.email.toLowerCase());
  }

  // prototype helpers / fallback
  if (!user && req.header("x-user-id")) {
    user = await db.user.get(req.header("x-user-id"));
  }
  if (!user && req.header("x-mock-uid")) {
    user = await db.user.get(req.header("x-mock-uid"));
  }

  return user;
}

/**
 * Allow only these roles (e.g. requireRole("admin"))
 */
export function requireRole(...allowedRoles) {
  const allowed = new Set(allowedRoles.map((r) => String(r).toLowerCase()));

  return async (req, res, next) => {
    try {
      const session = await auth.verify(req);
      if (!session) return res.status(401).json({ error: "unauthorized" });

      const user = await resolveUserFromRequest(req, session);
      if (!user) return res.status(404).json({ error: "user_not_found" });

      const role = String(user.userType || "").toLowerCase();
      if (!allowed.has(role)) {
        return res.status(403).json({ error: "forbidden", role });
      }

      // make downstream handlers easier
      req.user = user;
      req.session = session;

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Block these roles (e.g. forbidRole("admin") for non-admin-only routes)
 */
export function forbidRole(...blockedRoles) {
  const blocked = new Set(blockedRoles.map((r) => String(r).toLowerCase()));

  return async (req, res, next) => {
    try {
      const session = await auth.verify(req);
      if (!session) return res.status(401).json({ error: "unauthorized" });

      const user = await resolveUserFromRequest(req, session);
      if (!user) return res.status(404).json({ error: "user_not_found" });

      const role = String(user.userType || "").toLowerCase();
      if (blocked.has(role)) {
        return res.status(403).json({ error: "forbidden", role });
      }

      req.user = user;
      req.session = session;

      next();
    } catch (err) {
      next(err);
    }
  };
}
