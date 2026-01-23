import { Router } from "express";
import multer from "multer";
import Jimp from "jimp";
import { randomUUID } from "crypto";
import { config } from "../config.js";
import { auth as mockAuth } from "../adapters/auth.mock.js";
import { auth as realAuth } from "../adapters/auth.real.js";
import { db as mockDb } from "../adapters/db.mock.js";
import { db as realDb } from "../adapters/db.real.js";
import { getStorageBucket } from "../lib/firebase.js";

const router = Router();
const auth = config.prototype ? mockAuth : realAuth;
const db = config.prototype ? mockDb : realDb;

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB per image (pre-resize)
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new Error("Only image files are allowed")),
});

function pickPublicUser(user) {
  if (!user) return null;
  return {
    uid: user.uid,
    firstName: user.firstName || null,
    lastName: user.lastName || null,
    email: user.email || null,
    avatarUrl: user.avatarUrl || null,
    userType: user.userType || null,
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

async function attachAvatar(user) {
  if (!user?.uid) return user;
  if (!db?.profile?.get) return user;
  try {
    const profile = await db.profile.get(user.uid);
    if (profile?.avatarUrl) user.avatarUrl = profile.avatarUrl;
  } catch (error) {
    console.warn("[portfolio] unable to load profile", error?.message || error);
  }
  return user;
}

function normalizeText(value, { max = 2000 } = {}) {
  if (value === undefined) return undefined;
  if (value === null) return "";
  const s = String(value).trim();
  if (s.length > max) return null;
  return s;
}

async function resizeForStorage(file, { maxSize = 1280, quality = 80 } = {}) {
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

async function persistPortfolioPhoto({ itemId, userId, file }) {
  const safeName =
    file.originalname?.replace?.(/[^\w.\-]/g, "_")?.replace?.(/\.[^.]+$/, "") ||
    "photo";

  const full = await resizeForStorage(file, { maxSize: 1400, quality: 82 });
  const thumb = await resizeForStorage(file, { maxSize: 520, quality: 74 });

  if (config.prototype) {
    throw new Error("storage_unavailable");
  }

  const basePath = `portfolio/${userId}/${itemId}/${Date.now()}_${safeName}`;
  const objectPath = `${basePath}.${full.ext}`;
  const thumbPath = `${basePath}_thumb.${thumb.ext}`;
  const downloadToken = randomUUID();
  const thumbToken = randomUUID();

  const bucket = getStorageBucket();
  await bucket.file(objectPath).save(full.buffer, {
    metadata: {
      contentType: full.mimetype,
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
    resumable: false,
  });
  await bucket.file(thumbPath).save(thumb.buffer, {
    metadata: {
      contentType: thumb.mimetype,
      metadata: { firebaseStorageDownloadTokens: thumbToken },
    },
    resumable: false,
  });

  return {
    url: buildDownloadUrl({
      bucketName: bucket.name,
      objectPath,
      token: downloadToken,
    }),
    thumbUrl: buildDownloadUrl({
      bucketName: bucket.name,
      objectPath: thumbPath,
      token: thumbToken,
    }),
  };
}

async function requireUser(req, res) {
  const session = await auth.verify(req);
  if (!session) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }

  const user = await resolveUser(req, session);
  if (!user) {
    res.status(404).json({ error: "user_not_found" });
    return null;
  }

  await attachAvatar(user);
  return { session, user };
}

router.get("/user/:uid", async (req, res, next) => {
  try {
    const session = await auth.verify(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });

    const userId = String(req.params.uid || "").trim();
    if (!userId) return res.status(400).json({ error: "userId_required" });

    const owner = await db.user.get(userId);
    if (!owner) return res.status(404).json({ error: "user_not_found" });
    await attachAvatar(owner);

    const items = await db.portfolio.listByUser(userId, { limit: 50 });
    res.json({
      user: pickPublicUser(owner),
      items,
      summary: { count: items.length },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const ctx = await requireUser(req, res);
    if (!ctx) return;

    const title = normalizeText(req.body?.title, { max: 120 });
    if (!title) return res.status(400).json({ error: "title_required" });

    const description = normalizeText(req.body?.description, { max: 2000 });
    if (description === null) {
      return res.status(400).json({ error: "description_too_long" });
    }

    const created = await db.portfolio.create({
      userId: ctx.user.uid,
      title,
      description: description ?? "",
      photoUrls: [],
      photoThumbUrls: [],
    });

    res.status(201).json({ item: created });
  } catch (error) {
    next(error);
  }
});

router.patch("/:itemId", async (req, res, next) => {
  try {
    const ctx = await requireUser(req, res);
    if (!ctx) return;

    const itemId = String(req.params.itemId || "").trim();
    if (!itemId) return res.status(400).json({ error: "itemId_required" });

    const item = await db.portfolio.get(itemId);
    if (!item) return res.status(404).json({ error: "item_not_found" });
    if (item.userId !== ctx.user.uid) {
      return res.status(403).json({ error: "forbidden" });
    }

    const patch = {};
    const title = normalizeText(req.body?.title, { max: 120 });
    if (title !== undefined) {
      if (!title) return res.status(400).json({ error: "title_required" });
      patch.title = title;
    }
    const description = normalizeText(req.body?.description, { max: 2000 });
    if (description !== undefined) {
      if (description === null) {
        return res.status(400).json({ error: "description_too_long" });
      }
      patch.description = description;
    }

    const updated = await db.portfolio.update(itemId, patch);
    res.json({ item: updated });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/:itemId/photos",
  upload.array("photos", 6),
  async (req, res, next) => {
    try {
      const ctx = await requireUser(req, res);
      if (!ctx) return;

      if (config.prototype) {
        return res
          .status(501)
          .json({ error: "photo_upload_not_supported_in_prototype" });
      }

      const itemId = String(req.params.itemId || "").trim();
      if (!itemId) return res.status(400).json({ error: "itemId_required" });

      const item = await db.portfolio.get(itemId);
      if (!item) return res.status(404).json({ error: "item_not_found" });
      if (item.userId !== ctx.user.uid) {
        return res.status(403).json({ error: "forbidden" });
      }

      const files = Array.isArray(req.files) ? req.files : [];
      if (files.length === 0) {
        return res.status(400).json({ error: "no_photos_uploaded" });
      }

      const existingCount = Array.isArray(item.photoUrls) ? item.photoUrls.length : 0;
      const remaining = Math.max(0, 6 - existingCount);
      if (remaining === 0) {
        return res.status(409).json({ error: "photo_limit_reached" });
      }

      const accepted = files.slice(0, remaining);
      let photos;
      try {
        photos = await Promise.all(
          accepted.map((file) =>
            persistPortfolioPhoto({
              itemId,
              userId: ctx.user.uid,
              file,
            })
          )
        );
      } catch (error) {
        console.warn("[portfolio] photo upload failed:", error?.message || error);
        const details =
          process.env.NODE_ENV === "production"
            ? undefined
            : error?.message || String(error);
        return res.status(503).json({ error: "storage_unavailable", details });
      }

      const urls = photos.map((p) => p.url).filter(Boolean);
      const thumbUrls = photos.map((p) => p.thumbUrl).filter(Boolean);
      const updated = await db.portfolio.appendPhotos(itemId, {
        photoUrls: urls,
        photoThumbUrls: thumbUrls,
      });

      return res.json({ item: updated });
    } catch (error) {
      if (error.message === "Only image files are allowed") {
        return res.status(400).json({ error: error.message });
      }
      return next(error);
    }
  }
);

router.delete("/:itemId/photos", async (req, res, next) => {
  try {
    const ctx = await requireUser(req, res);
    if (!ctx) return;

    const itemId = String(req.params.itemId || "").trim();
    if (!itemId) return res.status(400).json({ error: "itemId_required" });

    const item = await db.portfolio.get(itemId);
    if (!item) return res.status(404).json({ error: "item_not_found" });
    if (item.userId !== ctx.user.uid) {
      return res.status(403).json({ error: "forbidden" });
    }

    const rawUrls = req.body?.photoUrls;
    const urls = Array.isArray(rawUrls)
      ? rawUrls.map((u) => String(u || "").trim()).filter(Boolean)
      : [];
    if (urls.length === 0) return res.status(400).json({ error: "photoUrls_required" });

    const currentUrls = Array.isArray(item.photoUrls) ? item.photoUrls : [];
    const currentThumbs = Array.isArray(item.photoThumbUrls)
      ? item.photoThumbUrls
      : [];

    const urlToThumb = new Map();
    currentUrls.forEach((u, idx) => {
      if (typeof u !== "string") return;
      const t = currentThumbs[idx];
      if (typeof t === "string") urlToThumb.set(u, t);
    });

    if (!config.prototype) {
      const bucket = getStorageBucket();
      await Promise.all(
        urls.map(async (url) => {
          const path = extractStorageObjectPath(url);
          if (path && path.startsWith(`portfolio/${ctx.user.uid}/${itemId}/`)) {
            await bucket.file(path).delete({ ignoreNotFound: true });
          }
          const thumbUrl = urlToThumb.get(url);
          const thumbPath = thumbUrl ? extractStorageObjectPath(thumbUrl) : null;
          if (
            thumbPath &&
            thumbPath.startsWith(`portfolio/${ctx.user.uid}/${itemId}/`)
          ) {
            await bucket.file(thumbPath).delete({ ignoreNotFound: true });
          }
        })
      );
    }

    const updated = await db.portfolio.removePhotos(itemId, {
      photoUrls: urls,
      photoThumbUrls: urls.map((u) => urlToThumb.get(u)).filter(Boolean),
    });

    return res.json({ item: updated });
  } catch (error) {
    next(error);
  }
});

router.delete("/:itemId", async (req, res, next) => {
  try {
    const ctx = await requireUser(req, res);
    if (!ctx) return;

    const itemId = String(req.params.itemId || "").trim();
    if (!itemId) return res.status(400).json({ error: "itemId_required" });

    const item = await db.portfolio.get(itemId);
    if (!item) return res.status(404).json({ error: "item_not_found" });
    if (item.userId !== ctx.user.uid) {
      return res.status(403).json({ error: "forbidden" });
    }

    if (!config.prototype) {
      try {
        const bucket = getStorageBucket();
        const urls = Array.isArray(item.photoUrls) ? item.photoUrls : [];
        const thumbs = Array.isArray(item.photoThumbUrls) ? item.photoThumbUrls : [];
        const all = [...urls, ...thumbs].filter((u) => typeof u === "string");
        await Promise.all(
          all.map(async (url) => {
            const path = extractStorageObjectPath(url);
            if (path && path.startsWith(`portfolio/${ctx.user.uid}/${itemId}/`)) {
              await bucket.file(path).delete({ ignoreNotFound: true });
            }
          })
        );
      } catch (error) {
        console.warn("[portfolio] unable to delete stored photos:", error?.message || error);
      }
    }

    await db.portfolio.delete(itemId);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
