import { Router } from "express";
import multer from "multer";
import { config } from "../config.js";
import { auth as mockAuth } from "../adapters/auth.mock.js";
import { auth as realAuth } from "../adapters/auth.real.js";
import { db as mockDb } from "../adapters/db.mock.js";
import { db as realDb } from "../adapters/db.real.js";

const router = Router();
const auth = config.prototype ? mockAuth : realAuth;
const db = config.prototype ? mockDb : realDb;

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

router.post("/avatar", upload.single('avatar'), async (req, res, next) => {
  try {
    const session = await auth.verify(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Store as base64 in firebase
    const base64 = req.file.buffer.toString('base64');
    const avatarUrl = `data:${req.file.mimetype};base64,${base64}`;
    const user = await db.user.get(session.uid);
    if (user) {
      await db.user.upsert({ ...user, avatarUrl });
    }

    res.json({ avatarUrl });
  } catch (error) {
    console.error('Avatar upload error:', error);
    if (error.message === 'Only image files are allowed') {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

export default router;
