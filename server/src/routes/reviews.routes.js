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
    console.warn("[reviews] unable to load profile", error?.message || error);
  }
  return user;
}

async function reviewerSnapshotFor(session) {
  const snapshot = {
    uid: session.uid,
    firstName: null,
    lastName: null,
    email: session.email || null,
    avatarUrl: null,
    userType: null,
  };

  try {
    const user = await db.user.get(session.uid);
    if (user) {
      await attachAvatar(user);
      return {
        uid: session.uid,
        firstName: user.firstName || null,
        lastName: user.lastName || null,
        email: user.email || snapshot.email,
        avatarUrl: user.avatarUrl || null,
        userType: user.userType || null,
      };
    }
  } catch {}

  try {
    const profile = await db.profile.get(session.uid);
    if (profile?.avatarUrl) snapshot.avatarUrl = profile.avatarUrl;
  } catch {}

  return snapshot;
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

async function persistReviewPhoto({ reviewId, sessionUid, file }) {
  const safeName =
    file.originalname?.replace?.(/[^\w.\-]/g, "_")?.replace?.(/\.[^.]+$/, "") ||
    "photo";

  const full = await resizeForStorage(file, { maxSize: 1280, quality: 80 });
  const thumb = await resizeForStorage(file, { maxSize: 480, quality: 72 });

  if (config.prototype) {
    throw new Error("storage_unavailable");
  }

  const basePath = `reviews/${reviewId}/${sessionUid}/${Date.now()}_${safeName}`;
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

function normalizeRating(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const rounded = Math.round(num);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
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

router.get("/user/:uid", async (req, res, next) => {
  try {
    const session = await auth.verify(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });

    const reviewedId = String(req.params.uid || "").trim();
    if (!reviewedId) return res.status(400).json({ error: "reviewedId_required" });

    const reviewed = await db.user.get(reviewedId);
    if (!reviewed) return res.status(404).json({ error: "user_not_found" });
    await attachAvatar(reviewed);

    const reviews = await db.review.listByReviewed(reviewedId, { limit: 50 });

    const reviewerIds = Array.from(
      new Set(reviews.map((r) => r.reviewerId).filter(Boolean))
    );
    const reviewerEntries = await Promise.all(
      reviewerIds.map(async (uid) => {
        const u = await db.user.get(uid);
        if (!u) return [uid, null];
        await attachAvatar(u);
        return [uid, pickPublicUser(u)];
      })
    );
    const reviewers = new Map(reviewerEntries);

    const enriched = reviews.map((review) => ({
      ...review,
      reviewer: reviewers.get(review.reviewerId) || review.reviewerSnapshot || null,
    }));

    const count = enriched.length;
    const avgRating =
      count === 0
        ? null
        : Math.round(
            (enriched.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / count) *
              10
          ) / 10;

    res.json({
      reviewedUser: pickPublicUser(reviewed),
      reviews: enriched,
      summary: { count, avgRating },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const session = await auth.verify(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });

    const reviewedId = String(req.body?.reviewedId || "").trim();
    if (!reviewedId) {
      return res.status(400).json({ error: "reviewedId_required" });
    }
    if (reviewedId === session.uid) {
      return res.status(400).json({ error: "cannot_review_self" });
    }

    const reviewed = await db.user.get(reviewedId);
    if (!reviewed) return res.status(404).json({ error: "reviewed_user_not_found" });

    const jobIdRaw = req.body?.jobId;
    const jobId = String(jobIdRaw || "").trim();
    if (!jobId) {
      return res.status(400).json({ error: "jobId_required" });
    }

    const job = await db.job.get(jobId);
    if (!job) return res.status(404).json({ error: "job_not_found" });
    if (job.posterId !== session.uid) {
      return res.status(403).json({ error: "forbidden" });
    }
    if ((job.status || "").toLowerCase() !== "awarded") {
      return res.status(409).json({ error: "job_not_awarded" });
    }
    if (!job.awardedProviderId) {
      return res.status(409).json({ error: "job_missing_awarded_provider" });
    }
    if (job.awardedProviderId !== reviewedId) {
      return res.status(400).json({ error: "review_target_must_be_awarded_bidder" });
    }

    const existingForJob = await db.review.listByJob(jobId, { limit: 200 });
    const alreadyReviewed = existingForJob.some(
      (r) => r.reviewerId === session.uid && r.reviewedId === reviewedId
    );
    if (alreadyReviewed) {
      return res.status(409).json({ error: "review_already_exists" });
    }

    const reviewerRecord = await db.user.get(session.uid);
    if (
      reviewerRecord &&
      (reviewerRecord.userType || "").toLowerCase() !== "contractor"
    ) {
      return res.status(403).json({ error: "contractor_only" });
    }

    const rating = normalizeRating(req.body?.rating);
    if (!rating) {
      return res.status(400).json({ error: "rating_must_be_1_to_5" });
    }

    const descriptionRaw = req.body?.description;
    const description =
      descriptionRaw === undefined || descriptionRaw === null
        ? ""
        : String(descriptionRaw).trim();
    if (description.length > 2000) {
      return res.status(400).json({ error: "description_too_long" });
    }

    const reviewerSnapshot = await reviewerSnapshotFor(session);
    const created = await db.review.create({
      reviewerId: session.uid,
      reviewedId,
      jobId,
      rating,
      description,
      photoUrls: [],
      reviewerSnapshot,
    });

    res.status(201).json({
      review: {
        ...created,
        reviewer: reviewerSnapshot,
        reviewed: pickPublicUser(await attachAvatar(reviewed)),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:reviewId", async (req, res, next) => {
  try {
    const session = await auth.verify(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });

    const reviewId = String(req.params.reviewId || "").trim();
    if (!reviewId) return res.status(400).json({ error: "reviewId_required" });

    const review = await db.review.get(reviewId);
    if (!review) return res.status(404).json({ error: "review_not_found" });
    if (review.reviewerId !== session.uid) {
      return res.status(403).json({ error: "forbidden" });
    }

    const reviewerRecord = await db.user.get(session.uid);
    if (
      reviewerRecord &&
      (reviewerRecord.userType || "").toLowerCase() !== "contractor"
    ) {
      return res.status(403).json({ error: "contractor_only" });
    }

    if (!config.prototype) {
      try {
        const bucket = getStorageBucket();
        const urls = Array.isArray(review.photoUrls) ? review.photoUrls : [];
        const thumbs = Array.isArray(review.photoThumbUrls)
          ? review.photoThumbUrls
          : [];
        const all = [...urls, ...thumbs].filter((u) => typeof u === "string");

        await Promise.all(
          all.map(async (url) => {
            const path = extractStorageObjectPath(url);
            if (path && path.startsWith(`reviews/${reviewId}/`)) {
              await bucket.file(path).delete({ ignoreNotFound: true });
            }
          })
        );
      } catch (error) {
        console.warn("[reviews] unable to delete stored photos:", error?.message || error);
      }
    }

    await db.review.delete(reviewId);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.patch("/:reviewId", async (req, res, next) => {
  try {
    const session = await auth.verify(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });

    const reviewId = String(req.params.reviewId || "").trim();
    if (!reviewId) return res.status(400).json({ error: "reviewId_required" });

    const review = await db.review.get(reviewId);
    if (!review) return res.status(404).json({ error: "review_not_found" });
    if (review.reviewerId !== session.uid) {
      return res.status(403).json({ error: "forbidden" });
    }

    const job = await db.job.get(review.jobId);
    if (!job) return res.status(404).json({ error: "job_not_found" });
    if (job.posterId !== session.uid) {
      return res.status(403).json({ error: "forbidden" });
    }

    const reviewerRecord = await db.user.get(session.uid);
    if (
      reviewerRecord &&
      (reviewerRecord.userType || "").toLowerCase() !== "contractor"
    ) {
      return res.status(403).json({ error: "contractor_only" });
    }

    const patch = {};

    if (req.body?.rating !== undefined) {
      const rating = normalizeRating(req.body?.rating);
      if (!rating) return res.status(400).json({ error: "rating_must_be_1_to_5" });
      patch.rating = rating;
    }

    if (req.body?.description !== undefined) {
      const descriptionRaw = req.body?.description;
      const description =
        descriptionRaw === undefined || descriptionRaw === null
          ? ""
          : String(descriptionRaw).trim();
      if (description.length > 2000) {
        return res.status(400).json({ error: "description_too_long" });
      }
      patch.description = description;
    }

    if (Object.keys(patch).length === 0) {
      return res.json({ review });
    }

    const updated = await db.review.update(reviewId, patch);
    return res.json({ review: updated });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/:reviewId/photos",
  upload.array("photos", 6),
  async (req, res, next) => {
    try {
      const session = await auth.verify(req);
      if (!session) return res.status(401).json({ error: "unauthorized" });

      if (config.prototype) {
        return res
          .status(501)
          .json({ error: "photo_upload_not_supported_in_prototype" });
      }

      const reviewId = String(req.params.reviewId || "").trim();
      if (!reviewId) return res.status(400).json({ error: "reviewId_required" });

      const review = await db.review.get(reviewId);
      if (!review) return res.status(404).json({ error: "review_not_found" });
      if (review.reviewerId !== session.uid) {
        return res.status(403).json({ error: "forbidden" });
      }

      const files = Array.isArray(req.files) ? req.files : [];
      if (files.length === 0) {
        return res.status(400).json({ error: "no_photos_uploaded" });
      }

      const existingCount = Array.isArray(review.photoUrls)
        ? review.photoUrls.length
        : 0;
      const remaining = Math.max(0, 6 - existingCount);
      if (remaining === 0) {
        return res.status(409).json({ error: "photo_limit_reached" });
      }

      const accepted = files.slice(0, remaining);
      let photos;
      try {
        photos = await Promise.all(
        accepted.map((file) =>
          persistReviewPhoto({ reviewId, sessionUid: session.uid, file })
        )
      );
      } catch (error) {
        console.warn("[reviews] photo upload failed:", error?.message || error);
        const details =
          process.env.NODE_ENV === "production"
            ? undefined
            : error?.message || String(error);
        return res.status(503).json({ error: "storage_unavailable", details });
      }

      const urls = photos.map((p) => p.url).filter(Boolean);
      const thumbUrls = photos.map((p) => p.thumbUrl).filter(Boolean);

      const updated = await db.review.appendPhotos(reviewId, {
        photoUrls: urls,
        photoThumbUrls: thumbUrls,
      });

      return res.json({
        review: updated,
        photoUrls: updated?.photoUrls || urls,
        photoThumbUrls: updated?.photoThumbUrls || thumbUrls,
      });
    } catch (error) {
      if (error.message === "Only image files are allowed") {
        return res.status(400).json({ error: error.message });
      }
      return next(error);
    }
  }
);

router.delete("/:reviewId/photos", async (req, res, next) => {
  try {
    const session = await auth.verify(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });

    const reviewId = String(req.params.reviewId || "").trim();
    if (!reviewId) return res.status(400).json({ error: "reviewId_required" });

    const review = await db.review.get(reviewId);
    if (!review) return res.status(404).json({ error: "review_not_found" });
    if (review.reviewerId !== session.uid) {
      return res.status(403).json({ error: "forbidden" });
    }

    const rawUrls = req.body?.photoUrls;
    const urls = Array.isArray(rawUrls)
      ? rawUrls.map((u) => String(u || "").trim()).filter(Boolean)
      : [];

    if (urls.length === 0) {
      return res.status(400).json({ error: "photoUrls_required" });
    }

    const currentUrls = Array.isArray(review.photoUrls) ? review.photoUrls : [];
    const currentThumbs = Array.isArray(review.photoThumbUrls)
      ? review.photoThumbUrls
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
          if (path && path.startsWith(`reviews/${reviewId}/`)) {
            await bucket.file(path).delete({ ignoreNotFound: true });
          }
          const thumbUrl = urlToThumb.get(url);
          const thumbPath = thumbUrl ? extractStorageObjectPath(thumbUrl) : null;
          if (thumbPath && thumbPath.startsWith(`reviews/${reviewId}/`)) {
            await bucket.file(thumbPath).delete({ ignoreNotFound: true });
          }
        })
      );
    }

    const updated = await db.review.removePhotos(reviewId, {
      photoUrls: urls,
      photoThumbUrls: urls.map((u) => urlToThumb.get(u)).filter(Boolean),
    });

    return res.json({ review: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
