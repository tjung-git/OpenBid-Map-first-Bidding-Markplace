import { Router } from "express";
import { config } from "../config.js";
import { auth as mockAuth } from "../adapters/auth.mock.js";
import { auth as realAuth } from "../adapters/auth.real.js";
import { db as mockDb } from "../adapters/db.mock.js";
import { db as realDb } from "../adapters/db.real.js";

const router = Router();
const auth = config.prototype ? mockAuth : realAuth;
const db = config.prototype ? mockDb : realDb;

router.post("/login", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "email required" });
    const user = await auth.signIn(email);
    // ensure user in DB
    db.user.upsert({
      uid: user.uid,
      email: user.email,
      name: user.name,
      kycStatus: "pending",
    });
    // prototype: return uid header the client will send on subsequent requests
    res.json({ user, prototype: config.prototype });
  } catch (e) {
    next(e);
  }
});

router.get("/me", async (req, res, next) => {
  try {
    const session = await auth.verify(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });
    const user = await db.user.get(session.uid);
    res.json({ user, prototype: config.prototype });
  } catch (e) {
    next(e);
  }
});

export default router;
