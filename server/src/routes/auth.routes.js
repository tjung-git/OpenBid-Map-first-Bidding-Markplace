import { Router } from "express";
import bcrypt from "bcryptjs";
import { config } from "../config.js";
import { auth as mockAuth } from "../adapters/auth.mock.js";
import { auth as realAuth } from "../adapters/auth.real.js";
import { db as mockDb } from "../adapters/db.mock.js";
import { db as realDb } from "../adapters/db.real.js";
import { getAuthClient } from "../lib/firebase.js";
import {
  deleteAccount,
  FirebaseIdentityError,
  sendVerificationEmail,
  signUpWithEmailPassword,
} from "../lib/firebaseIdentity.js";
const router = Router();
const auth = config.prototype ? mockAuth : realAuth;
const db = config.prototype ? mockDb : realDb;

const USER_TYPES = new Set(["bidder", "contractor"]);
const MIN_PASSWORD_LENGTH = 8;

const validatePasswordStrength = (password) =>
  typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH;

const hashPassword = (password) => bcrypt.hash(password, 10);
const verifyPassword = (password, hash) =>
  hash ? bcrypt.compare(password, hash) : false;

const sanitizeUser = (user) => {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
};

router.post("/signup", async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, userType } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ error: "firstName and lastName required" });
    }

    if (!email) {
      return res.status(400).json({ error: "email required" });
    }

    if (!password) {
      return res.status(400).json({ error: "password required" });
    }

    if (!validatePasswordStrength(password)) {
      return res
        .status(400)
        .json({ error: "password must be at least 8 characters" });
    }

    const userTypeNormalized = userType?.toLowerCase();
    if (!USER_TYPES.has(userTypeNormalized)) {
      return res
        .status(400)
        .json({ error: "userType must be 'bidder' or 'contractor'" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.user.findByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: "email already registered" });
    }

    const passwordHash = await hashPassword(password);

    let uid = `proto_${Date.now()}`;
    let firebaseIdToken;
    let createdAccount;

    if (!config.prototype) {
      try {
        // Use Firebase Identity Toolkit so Firebase sends its own verification email.
        createdAccount = await signUpWithEmailPassword(normalizedEmail, password);
        uid = createdAccount.uid;
        firebaseIdToken = createdAccount.idToken;
        await sendVerificationEmail(createdAccount.idToken);
      } catch (error) {
        if (createdAccount?.idToken) {
          await deleteAccount(createdAccount.idToken);
        }
        if (error instanceof FirebaseIdentityError) {
          if (error.message === "EMAIL_EXISTS") {
            return res
              .status(409)
              .json({ error: "email already registered" });
          }
          console.error("[auth] Firebase identity error:", error.message);
          return res.status(500).json({ error: "firebase_identity_error" });
        }
        console.error("[auth] Signup error:", error);
        return next(error);
      }
    }

    const nowIso = new Date().toISOString();
    const userRecord = {
      uid,
      firstName,
      lastName,
      email: normalizedEmail,
      userType: userTypeNormalized,
      emailVerification: config.prototype ? "verified" : "pending",
      kycStatus: config.prototype ? "verified" : "pending",
      passwordHash,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    try {
      const created = await db.user.create(userRecord);
      res.status(201).json({
        user: sanitizeUser(created),
      });
    } catch (error) {
      if (!config.prototype && firebaseIdToken) {
        await deleteAccount(firebaseIdToken);
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.user.findByEmail(normalizedEmail);
    if (!user) {
      return res.status(404).json({ error: "user not found" });
    }

    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    if (!config.prototype) {
      try {
        // Pull latest verification state from Firebase Auth so Firestore stays in sync.
        const firebaseAuth = getAuthClient();
        const authUser = await firebaseAuth.getUser(user.uid);
        if (
          authUser?.emailVerified &&
          user.emailVerification !== "verified"
        ) {
          await db.user.update(user.uid, {
            emailVerification: "verified",
            updatedAt: new Date().toISOString(),
          });
          user.emailVerification = "verified";
        }
      } catch (error) {
        console.error(
          "[auth] Unable to synchronize Firebase email verification state",
          error
        );
      }
    }

    let session = { uid: user.uid, email: user.email };
    if (!config.prototype) {
      const authSession = await auth.signIn(user.email);
      session = { ...authSession, uid: user.uid, email: user.email };
    }

    const requirements = {
      // Let callers know why access might be blocked without exposing internals.
      emailVerified: user.emailVerification === "verified",
      kycVerified: user.kycStatus === "verified",
    };

    res.json({
      user: sanitizeUser(user),
      session,
      prototype: config.prototype,
      requirements,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", async (req, res, next) => {
  try {
    const session = await auth.verify(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });
    const user = await db.user.get(session.uid);
    res.json({ user: sanitizeUser(user), prototype: config.prototype });
  } catch (error) {
    next(error);
  }
});

router.post("/email-verify", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "email required" });
    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.user.findByEmail(normalizedEmail);
    if (!user) return res.status(404).json({ error: "user not found" });
    const updated = await db.user.update(user.uid, {
      emailVerification: "verified",
      updatedAt: new Date().toISOString(),
    });
    res.json({ user: sanitizeUser(updated) });
  } catch (error) {
    next(error);
  }
});

export default router;
