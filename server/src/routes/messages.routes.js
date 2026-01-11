import { Router } from "express";
import { config } from "../config.js";
import { auth as mockAuth } from "../adapters/auth.mock.js";
import { auth as realAuth } from "../adapters/auth.real.js";
import { db as mockDb } from "../adapters/db.mock.js";
import { db as realDb } from "../adapters/db.real.js";

const router = Router();
const auth = config.prototype ? mockAuth : realAuth;
const db = config.prototype ? mockDb : realDb;

async function requireAuth(req, res) {
    const session = await auth.verify(req);
    if (!session) {
        res.status(401).json({ error: "unauthorized" });
        return null;
    }
    return session;
}

// Start a conversation
router.post("/start", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;

        const { jobId, otherUserId } = req.body;
        if (!jobId || !otherUserId) {
            return res.status(400).json({ error: "missing_fields" });
        }

        const job = await db.job.get(jobId);
        if (!job) return res.status(404).json({ error: "job_not_found" });

        // Ensure user is part of the job (poster or bidder)
        // Actually, for "Start chat", we just need to ensure the requester is involved.
        // If requester is poster, otherUserId is bidder.
        // If requester is bidder, otherUserId is poster.

        // Check if conversation already exists
        const existing = await db.conversations.find(jobId, session.uid, otherUserId);
        if (existing) {
            return res.json({ conversation: existing });
        }

        const conversation = await db.conversations.create({
            jobId,
            participants: [session.uid, otherUserId],
            lastMessageAt: new Date().toISOString(),
            updatedAt: new Date().toISOString() // for sorting
        });

        res.json({ conversation });
    } catch (e) {
        next(e);
    }
});

// List conversations for current user
router.get("/list", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;

        const conversations = await db.conversations.listByUser(session.uid);

        // Enrich with job title and participant names
        const enriched = await Promise.all(conversations.map(async (conv) => {
            const result = { ...conv, jobTitle: "Unknown Job", participantNames: [] };
            try {
                if (conv.jobId) {
                    const job = await db.job.get(conv.jobId);
                    if (job) result.jobTitle = job.title;
                }
                if (conv.participants && Array.isArray(conv.participants)) {
                    const users = await Promise.all(conv.participants.map(uid => db.user.get(uid)));
                    result.participantNames = users
                        .filter(u => u) // filter nulls
                        .map(u => {
                            const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
                            return name || u.email || "Unknown User";
                        });
                }
            } catch (err) {
                console.error("Failed to fetch details for conv", conv.id, err);
            }
            return result;
        }));

        // Sort by lastMessageAt desc
        enriched.sort((a, b) => {
            return new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0);
        });

        res.json({ conversations: enriched });
    } catch (e) {
        next(e);
    }
});

// Get messages for a conversation
router.get("/:conversationId", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;

        const { conversationId } = req.params;
        const conversation = await db.conversations.get(conversationId);
        if (!conversation) return res.status(404).json({ error: "not_found" });

        if (!conversation.participants.includes(session.uid)) {
            return res.status(403).json({ error: "forbidden" });
        }

        const messages = await db.messages.list(conversationId);
        messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        res.json({ conversation, messages });
    } catch (e) {
        next(e);
    }
});

// Send a message
router.post("/:conversationId", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;

        const { conversationId } = req.params;
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: "empty_message" });
        }

        const conversation = await db.conversations.get(conversationId);
        if (!conversation) return res.status(404).json({ error: "not_found" });

        if (!conversation.participants.includes(session.uid)) {
            return res.status(403).json({ error: "forbidden" });
        }

        const message = await db.messages.create({
            conversationId,
            senderId: session.uid,
            content: content.trim(),
        });

        // Update conversation lastMessageAt and mark as read for sender
        await db.conversations.update(conversationId, {
            lastMessageAt: message.createdAt,
            lastMessagePreview: content.trim().substring(0, 50),
            [`readBy.${session.uid}`]: message.createdAt
        });

        // Emit socket event to all participants
        const io = req.app.get("io");
        if (io) {
            conversation.participants.forEach(uid => {
                io.to(`user:${uid}`).emit("new_message", {
                    conversationId,
                    message
                });
            });
        }

        res.json({ message });
    } catch (e) {
        next(e);
    }
});

// Mark conversation as read
router.post("/:conversationId/read", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;

        const { conversationId } = req.params;
        const conversation = await db.conversations.get(conversationId);
        if (!conversation) return res.status(404).json({ error: "not_found" });

        if (!conversation.participants.includes(session.uid)) {
            return res.status(403).json({ error: "forbidden" });
        }

        const updatedConv = await db.conversations.markRead(conversationId, session.uid);

        // Emit socket update to all participants
        const io = req.app.get("io");
        if (io && updatedConv.participants) {
            updatedConv.participants.forEach(uid => {
                io.to(`user:${uid}`).emit("conversation_update", {
                    conversation: updatedConv
                });
            });
        }

        res.json({ success: true, conversation: updatedConv });
    } catch (e) {
        next(e);
    }
});

// Hide conversation for current user
router.post("/:conversationId/hide", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;

        const { conversationId } = req.params;
        const conversation = await db.conversations.get(conversationId);
        if (!conversation) return res.status(404).json({ error: "not_found" });

        if (!conversation.participants.includes(session.uid)) {
            return res.status(403).json({ error: "forbidden" });
        }

        await db.conversations.hide(conversationId, session.uid);
        res.json({ success: true });
    } catch (e) {
        next(e);
    }
});

// Unhide conversation for current user
router.post("/:conversationId/unhide", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;

        const { conversationId } = req.params;
        const conversation = await db.conversations.get(conversationId);
        if (!conversation) return res.status(404).json({ error: "not_found" });

        if (!conversation.participants.includes(session.uid)) {
            return res.status(403).json({ error: "forbidden" });
        }

        await db.conversations.unhide(conversationId, session.uid);
        res.json({ success: true });
    } catch (e) {
        next(e);
    }
});

// Delete conversation and all its messages
router.delete("/:conversationId", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;

        const { conversationId } = req.params;
        const conversation = await db.conversations.get(conversationId);
        if (!conversation) return res.status(404).json({ error: "not_found" });

        if (!conversation.participants.includes(session.uid)) {
            return res.status(403).json({ error: "forbidden" });
        }

        await db.conversations.delete(conversationId);
        res.json({ success: true });
    } catch (e) {
        next(e);
    }
});

export default router;
