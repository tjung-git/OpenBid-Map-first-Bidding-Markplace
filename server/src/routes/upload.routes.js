import { Router } from "express";
import multer from "multer";
import { config } from "../config.js";
import { auth as mockAuth } from "../adapters/auth.mock.js";
import { auth as realAuth } from "../adapters/auth.real.js";
import { db as mockDb } from "../adapters/db.mock.js";
import { db as realDb } from "../adapters/db.real.js";
import { getStorageBucket } from "../lib/firebase.js";
import { randomUUID } from "crypto";

const router = Router();
const auth = config.prototype ? mockAuth : realAuth;
const db = config.prototype ? mockDb : realDb;

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new Error("Only image files are allowed")),
});

const toDataUrl = (file) =>
  `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

async function persistAvatar(session, file) {
  if (config.prototype) return toDataUrl(file);

  const safeName = file.originalname?.replace?.(/[^\w.\-]/g, "_") || "avatar";
  const objectPath = `avatars/${session.uid}/${Date.now()}_${safeName}`;
  const downloadToken = randomUUID();

  try {
    const bucket = getStorageBucket();
    await bucket.file(objectPath).save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
      resumable: false,
    });
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
      objectPath
    )}?alt=media&token=${downloadToken}`;
  } catch (error) {
    console.warn("[upload] storage unavailable, falling back to data URL:", error.message);
    return toDataUrl(file);
  }
}

async function resolveUser(req, session) {
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
  return user;
}

router.post("/avatar", upload.single("avatar"), async (req, res, next) => {
  try {
    const session = await auth.verify(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const user = await resolveUser(req, session);
    if (!user) {
      return res.status(404).json({ error: "user_not_found" });
    }

    const avatarUrl = await persistAvatar({ ...session, uid: user.uid }, req.file);

    const updatedProfile = await db.profile.upsert({
      avatarUrl,
      uid: user.uid,
      updatedAt: new Date().toISOString(),
    });

    res.json({ avatarUrl: updatedProfile?.avatarUrl || avatarUrl });
  } catch (error) {
    console.error("Avatar upload error:", error);
    if (error.message === "Only image files are allowed") {
      return res.status(400).json({ error: error.message });
    }
    return res
      .status(500)
      .json({ error: "avatar_upload_failed", message: error.message });
  }
});

export default router;
