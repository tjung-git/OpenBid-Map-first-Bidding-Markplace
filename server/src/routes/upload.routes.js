import { Router } from "express";
import multer from "multer";
import Jimp from "jimp";
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

async function resizeForStorage(file, { maxSize = 512, quality = 82 } = {}) {
  const image = await Jimp.read(file.buffer);
  image.scaleToFit(maxSize, maxSize);
  image.quality(quality);
  const buffer = await image.getBufferAsync(Jimp.MIME_JPEG);
  return { buffer, mimetype: Jimp.MIME_JPEG, ext: "jpg" };
}

function buildDownloadUrl({ bucketName, objectPath, token }) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    objectPath
  )}?alt=media&token=${token}`;
}

function extractStorageObjectPath(downloadUrl) {
  try {
    const parsed = new URL(downloadUrl);
    const marker = "/o/";
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;
    const encoded = parsed.pathname.slice(idx + marker.length);
    if (!encoded) return null;
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

async function deleteStorageObjectIfPossible(url) {
  const objectPath = extractStorageObjectPath(url);
  if (!objectPath) return;
  try {
    const bucket = getStorageBucket();
    await bucket.file(objectPath).delete();
  } catch (error) {
    console.warn("[upload] unable to delete old avatar object", error?.message || error);
  }
}

async function persistAvatar({ uid, file }) {
  if (config.prototype) {
    const resized = await resizeForStorage(file, { maxSize: 512, quality: 82 });
    return { avatarUrl: toDataUrl({ ...file, mimetype: resized.mimetype, buffer: resized.buffer }) };
  }

  const safeName =
    file.originalname?.replace?.(/[^\w.\-]/g, "_")?.replace?.(/\.[^.]+$/, "") ||
    "avatar";

  const resized = await resizeForStorage(file, { maxSize: 512, quality: 82 });
  const objectPath = `avatars/${uid}/${Date.now()}_${safeName}.${resized.ext}`;
  const downloadToken = randomUUID();

  const bucket = getStorageBucket();
  await bucket.file(objectPath).save(resized.buffer, {
    metadata: {
      contentType: resized.mimetype,
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
    resumable: false,
  });

  return {
    avatarUrl: buildDownloadUrl({
      bucketName: bucket.name,
      objectPath,
      token: downloadToken,
    }),
  };
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

    if (config.prototype) {
      return res
        .status(501)
        .json({ error: "avatar_upload_not_supported_in_prototype" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const user = await resolveUser(req, session);
    if (!user) {
      return res.status(404).json({ error: "user_not_found" });
    }

    const previousProfile = await db.profile.get(user.uid);
    const previousAvatarUrl = previousProfile?.avatarUrl || null;

    const { avatarUrl } = await persistAvatar({ uid: user.uid, file: req.file });

    const updatedProfile = await db.profile.upsert({
      avatarUrl,
      uid: user.uid,
    });

    if (previousAvatarUrl && previousAvatarUrl !== avatarUrl) {
      await deleteStorageObjectIfPossible(previousAvatarUrl);
    }

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

router.delete("/avatar", async (req, res, next) => {
  try {
    const session = await auth.verify(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });

    if (config.prototype) {
      return res
        .status(501)
        .json({ error: "avatar_upload_not_supported_in_prototype" });
    }

    const user = await resolveUser(req, session);
    if (!user) return res.status(404).json({ error: "user_not_found" });

    const existing = await db.profile.get(user.uid);
    const previousAvatarUrl = existing?.avatarUrl || null;

    await db.profile.upsert({
      uid: user.uid,
      avatarUrl: null,
    });

    if (previousAvatarUrl) {
      await deleteStorageObjectIfPossible(previousAvatarUrl);
    }

    return res.status(204).send();
  } catch (error) {
    console.error("Avatar delete error:", error);
    return res
      .status(500)
      .json({ error: "avatar_delete_failed", message: error.message });
  }
});

export default router;
