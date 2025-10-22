import { Router } from "express";
import { config } from "../config.js";
import { db as mockDb } from "../adapters/db.mock.js";
import { db as realDb } from "../adapters/db.real.js";
import {
  FirebaseIdentityError,
  sendPasswordResetEmail,
} from "../lib/firebaseIdentity.js";

const router = Router();
const db = config.prototype ? mockDb : realDb;

router.post("/forgot", async (req, res, next) => {
  try {
    const emailRaw = req.body?.email || "";
    const email = String(emailRaw).trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "email required" });
    }

    const user = await db.user.findByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "email_not_found" });
    }

    if (config.prototype) {
      // Prototype mode does not integrate with Firebase. Pretend success.
      return res.json({ ok: true });
    }

    try {
      await sendPasswordResetEmail(email);
      return res.json({ ok: true });
    } catch (error) {
      if (error instanceof FirebaseIdentityError) {
        if (error.message === "EMAIL_NOT_FOUND") {
          return res.status(404).json({ error: "email_not_found" });
        }
        console.error("[auth] Password reset request failed:", error.message);
        return res.status(502).json({ error: "firebase_reset_failed" });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

export default router;
