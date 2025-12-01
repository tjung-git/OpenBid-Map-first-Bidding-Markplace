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

import crypto from "crypto";
import { putWithTTL } from "../lib/duoState.js";

const router = Router();
const auth = config.prototype ? mockAuth : realAuth;
const db = config.prototype ? mockDb : realDb;

const USER_TYPES = new Set(["bidder", "contractor"]);
const MIN_PASSWORD_LENGTH = 8;

const validatePasswordStrength = (password) =>
  typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH;

const validateEmailFormat = (email) =>
  typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const hashPassword = (password) => bcrypt.hash(password, 10);
const verifyPassword = (password, hash) =>
  hash ? bcrypt.compare(password, hash) : false;

const sanitizeUser = (user) => {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
};

const isKycVerified = (value) =>
  typeof value === "string" && value.trim().toLowerCase() === "verified";

router.post("/signup", async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      userType,
    } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ error: "firstName and lastName required" });
    }

    if (!email) {
      return res.status(400).json({ error: "email required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!validateEmailFormat(normalizedEmail)) {
      return res.status(400).json({ error: "email must be a valid address" });
    }

    if (!password) {
      return res.status(400).json({ error: "password required" });
    }

    if (!validatePasswordStrength(password)) {
      return res
        .status(400)
        .json({ error: "password must be at least 8 characters" });
    }

    if (confirmPassword === undefined || confirmPassword === null) {
      return res.status(400).json({ error: "confirmPassword required" });
    }

    if (String(confirmPassword) !== password) {
      return res.status(400).json({ error: "passwords must match" });
    }

    let userTypeNormalized = "bidder";
    if (userType !== undefined && userType !== null) {
      const candidate = String(userType).trim().toLowerCase();
      if (!USER_TYPES.has(candidate)) {
        return res
          .status(400)
          .json({ error: "userType must be 'bidder' or 'contractor'" });
      }
      userTypeNormalized = candidate;
    }

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
        createdAccount = await signUpWithEmailPassword(
          normalizedEmail,
          password
        );
        uid = createdAccount.uid;
        firebaseIdToken = createdAccount.idToken;
        await sendVerificationEmail(createdAccount.idToken);
      } catch (error) {
        if (createdAccount?.idToken) {
          await deleteAccount(createdAccount.idToken);
        }
        if (error instanceof FirebaseIdentityError) {
          if (error.message === "EMAIL_EXISTS") {
            return res.status(409).json({ error: "email already registered" });
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
      kycStatus: "pending",
      kycSessionId: null,
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
      return res.status(400).json({ error: "email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.user.findByEmail(normalizedEmail);
    if (!user) {
      return res.status(404).json({ error: "user not found" });
    }

    let passwordOk = await verifyPassword(password, user.passwordHash);
    let firebaseSession = null;

    if (!passwordOk && !config.prototype) {
      try {
        firebaseSession = await auth.signIn(user.email, password);
        passwordOk = true;

        const nowIso = new Date().toISOString();
        const newHash = await hashPassword(password);
        const updatedUser = await db.user.update(user.uid, {
          passwordHash: newHash,
          updatedAt: nowIso,
        });
        if (updatedUser) {
          Object.assign(user, updatedUser);
        } else {
          user.passwordHash = newHash;
          user.updatedAt = nowIso;
        }
      } catch (error) {
        if (error instanceof FirebaseIdentityError) {
          if (error.message === "INVALID_PASSWORD") {
            return res.status(401).json({ error: "invalid credentials" });
          }
          if (error.message === "EMAIL_NOT_FOUND") {
            return res.status(404).json({ error: "user not found" });
          }
          console.error(
            "[auth] Firebase fallback error",
            error.message,
            error.status
          );
          return res.status(502).json({ error: "firebase_signin_failed" });
        }
        console.error("[auth] Firebase fallback failed", error);
        return res.status(500).json({ error: "auth_session_failed" });
      }
    }

    if (!passwordOk) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    if (!config.prototype) {
      try {
        const firebaseAuth = getAuthClient();
        const authUser = await firebaseAuth.getUser(user.uid);
        if (authUser?.emailVerified && user.emailVerification !== "verified") {
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

    if ((user.emailVerification || "").toLowerCase() !== "verified") {
      return res.status(403).json({
        error: "verification_required",
        emailVerification: user.emailVerification || "pending",
      });
    }

    let session = { uid: user.uid, email: user.email };
    if (!config.prototype) {
      try {
        const authSession =
          firebaseSession || (await auth.signIn(user.email, password));
        session = { ...authSession, uid: user.uid, email: user.email };
      } catch (error) {
        if (error instanceof FirebaseIdentityError) {
          if (error.message === "INVALID_PASSWORD") {
            return res.status(401).json({ error: "invalid credentials" });
          }
          if (error.message === "EMAIL_NOT_FOUND") {
            try {
              const createdAccount = await signUpWithEmailPassword(
                normalizedEmail,
                password
              );
              await sendVerificationEmail(createdAccount.idToken);
              const authSession = await auth.signIn(user.email, password);
              session = { ...authSession, uid: user.uid, email: user.email };
              await db.user.update(user.uid, {
                emailVerification:
                  user.emailVerification === "verified"
                    ? "verified"
                    : "pending",
                updatedAt: new Date().toISOString(),
              });
            } catch (provisionError) {
              console.error(
                "[auth] Failed to provision Firebase account during login",
                provisionError
              );
              return res
                .status(500)
                .json({ error: "firebase_provision_failed" });
            }
          } else {
            console.error(
              "[auth] Firebase sign-in failed",
              error.message,
              error.status
            );
            return res.status(502).json({ error: "firebase_signin_failed" });
          }
        } else {
          console.error("[auth] Failed to establish session", error);
          return res.status(500).json({ error: "auth_session_failed" });
        }
      }
    }

    const requirements = {
      emailVerified: user.emailVerification === "verified",
      kycVerified: isKycVerified(user.kycStatus),
    };

    const sessionPayload = {
      user: sanitizeUser(user),
      session,
      prototype: config.prototype,
      requirements,
    };

    // In prototype mode, skip DUO
    if (config.prototype) {
      return res.json(sessionPayload);
    }
    const state = crypto.randomBytes(16).toString("hex");

    putWithTTL(
      state,
      {
        uid: user.uid,
        email: user.email,
        sessionPayload,
      },
      5 * 60 * 1000
    );

    return res.status(202).json({
      mfa: {
        provider: "duo",
        required: true,
        startUrl: `/api/auth/duo/start?state=${state}`,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/role", async (req, res, next) => {
  try {
    const session = await auth.verify(req);
    if (!session) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const requestedRole = String(req.body?.role || "")
      .trim()
      .toLowerCase();
    if (!USER_TYPES.has(requestedRole)) {
      return res.status(400).json({ error: "invalid_role" });
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
      return res.status(404).json({ error: "user_not_found" });
    }

    if ((user.userType || "").toLowerCase() === requestedRole) {
      return res.json({
        user: sanitizeUser(user),
        requirements: {
          emailVerified: user.emailVerification === "verified",
          kycVerified: isKycVerified(user.kycStatus),
        },
      });
    }

    const nowIso = new Date().toISOString();
    const updated = (await db.user.update(user.uid, {
      userType: requestedRole,
      updatedAt: nowIso,
    })) || { ...user, userType: requestedRole, updatedAt: nowIso };

    res.json({
      user: sanitizeUser(updated),
      requirements: {
        emailVerified: updated.emailVerification === "verified",
        kycVerified: isKycVerified(updated.kycStatus),
      },
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
