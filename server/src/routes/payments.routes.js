import { Router } from "express";
import { config } from "../config.js";
import { auth as mockAuth } from "../adapters/auth.mock.js";
import { auth as realAuth } from "../adapters/auth.real.js";
import { payments as mockPayments } from "../adapters/payments.mock.js";
import { payments as realPayments } from "../adapters/payments.real.js";
import { db as mockDb } from "../adapters/db.mock.js";
import { db as realDb } from "../adapters/db.real.js";

const router = Router();
const auth = config.prototype ? mockAuth : realAuth;
const payments = config.prototype ? mockPayments : realPayments;
const db = config.prototype ? mockDb : realDb;

router.post("/create-intent", async (req, res, next) => {
  try {
    const session = await auth.verify(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });

    const { jobId, bidId, amount } = req.body;

    if (!jobId || !bidId || !amount) {
      return res.status(400).json({ error: "missing_required_fields" });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: "invalid_amount" });
    }

    const bid = await db.bid.get(bidId);
    if (!bid || bid.jobId !== jobId) {
      return res.status(404).json({ error: "bid_not_found" });
    }

    const job = await db.job.get(jobId);
    if (!job) {
      return res.status(404).json({ error: "job_not_found" });
    }

    if (job.posterId !== session.uid) {
      return res.status(403).json({ error: "forbidden" });
    }

    if (bid.status !== "accepted") {
      return res.status(400).json({ error: "bid_not_accepted" });
    }

    // If payment intent exists, check its status
    if (bid.paymentIntentId) {
      try {
        const status = await payments.getStatus({ paymentIntentId: bid.paymentIntentId });
        
        // If payment is in a bad state (requires_payment_method), cancel and recreate
        if (status.status === 'requires_payment_method') {
          console.log(`[payments.routes] Canceling bad payment intent ${bid.paymentIntentId}`);
          await payments.cancel({ paymentIntentId: bid.paymentIntentId });
          // Continue to create new payment intent below
        } else if (status.status === 'requires_capture' || status.status === 'succeeded') {
          // Payment is valid, don't recreate
          return res.status(409).json({ error: "payment_already_exists" });
        } else {
          // Other states - cancel and recreate
          console.log(`[payments.routes] Canceling payment intent in state ${status.status}`);
          await payments.cancel({ paymentIntentId: bid.paymentIntentId });
        }
      } catch (error) {
        console.error(`[payments.routes] Error checking payment status:`, error);
        // If we can't check status, try to cancel anyway
        try {
          await payments.cancel({ paymentIntentId: bid.paymentIntentId });
        } catch (cancelError) {
          console.error(`[payments.routes] Error canceling payment:`, cancelError);
        }
      }
    }

    const result = await payments.createPaymentIntent({
      jobId,
      bidId,
      amount: numericAmount,
      customerId: session.uid,
    });

    await db.bid.update(bidId, {
      paymentIntentId: result.paymentIntentId,
      paymentStatus: "pending",
    });

    await db.job.update(jobId, {
      paymentIntentId: result.paymentIntentId,
      paymentStatus: "pending",
    });

    res.json({
      clientSecret: result.clientSecret,
      paymentIntentId: result.paymentIntentId,
    });
  } catch (e) {
    console.error("[payments.routes] create-intent error:", e);
    next(e);
  }
});

router.post("/:jobId/confirm", async (req, res, next) => {
  try {
    const session = await auth.verify(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });

    const { paymentIntentId } = req.body;
    if (!paymentIntentId) {
      return res.status(400).json({ error: "payment_intent_id_required" });
    }

    const job = await db.job.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: "job_not_found" });

    const bid = await db.bid.get(job.awardedBidId);
    if (!bid) return res.status(404).json({ error: "bid_not_found" });

    if (job.posterId !== session.uid) {
      return res.status(403).json({ error: "forbidden" });
    }

    // Verify the payment intent status with Stripe
    const paymentStatus = await payments.getStatus({ paymentIntentId });
    
    if (paymentStatus.status !== "requires_capture") {
      console.error(
        `[payments.routes] Payment intent ${paymentIntentId} is in status ${paymentStatus.status}, expected requires_capture`
      );
      return res.status(400).json({
        error: "payment_not_ready",
        message: `Payment is in status: ${paymentStatus.status}`,
      });
    }

    // Update the bid and job with the verified payment intent
    await db.bid.update(bid.id, {
      paymentStatus: "held",
      paymentIntentId: paymentIntentId,
    });

    await db.job.update(job.id, {
      paymentStatus: "held",
      status: "in_progress",
    });

    res.json({ ok: true, status: "held" });
  } catch (e) {
    console.error("[payments.routes] confirm error:", e);
    next(e);
  }
});

router.post("/:jobId/capture", async (req, res, next) => {
  try {
    const session = await auth.verify(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });

    const job = await db.job.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: "job_not_found" });

    if (job.posterId !== session.uid) {
      return res.status(403).json({ error: "forbidden" });
    }

    const bid = await db.bid.get(job.awardedBidId);
    if (!bid?.paymentIntentId) {
      return res.status(400).json({ error: "no_payment_intent" });
    }

    if (bid.paymentStatus !== "held") {
      return res.status(400).json({ error: "payment_not_held" });
    }

    const result = await payments.capture({
      paymentIntentId: bid.paymentIntentId,
    });

    if (result.ok) {
      await db.bid.update(bid.id, {
        paymentStatus: "captured",
      });

      await db.job.update(job.id, {
        paymentStatus: "captured",
        status: "completed",
        completedAt: new Date().toISOString(),
      });

      res.json({ ok: true, status: "captured" });
    } else {
      res.status(500).json({ error: "capture_failed", status: result.status });
    }
  } catch (e) {
    console.error("[payments.routes] capture error:", e);
    next(e);
  }
});

router.post("/:jobId/refund", async (req, res, next) => {
  try {
    const session = await auth.verify(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });

    const job = await db.job.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: "job_not_found" });

    if (job.posterId !== session.uid) {
      return res.status(403).json({ error: "forbidden" });
    }

    const bid = await db.bid.get(job.awardedBidId);
    if (!bid?.paymentIntentId) {
      return res.status(400).json({ error: "no_payment_intent" });
    }

    const { amount } = req.body;
    const refundAmount = amount ? Number(amount) : undefined;

    const result = await payments.refund({
      paymentIntentId: bid.paymentIntentId,
      amount: refundAmount,
    });

    if (result.ok) {
      await db.bid.update(bid.id, {
        paymentStatus: "refunded",
      });

      await db.job.update(job.id, {
        paymentStatus: "refunded",
        status: "cancelled",
      });

      res.json({ ok: true, status: "refunded" });
    } else {
      res.status(500).json({ error: "refund_failed", status: result.status });
    }
  } catch (e) {
    console.error("[payments.routes] refund error:", e);
    next(e);
  }
});

router.get("/:jobId/status", async (req, res, next) => {
  try {
    const session = await auth.verify(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });

    const job = await db.job.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: "job_not_found" });

    if (
      job.posterId !== session.uid &&
      job.awardedProviderId !== session.uid
    ) {
      return res.status(403).json({ error: "forbidden" });
    }

    const bid = await db.bid.get(job.awardedBidId);
    if (!bid) {
      return res.json({ paymentStatus: "none" });
    }

    // Get Stripe payment intent status if it exists
    let stripeStatus = null;
    if (bid.paymentIntentId) {
      try {
        const stripeResult = await payments.getStatus({ paymentIntentId: bid.paymentIntentId });
        stripeStatus = stripeResult.status;
      } catch (error) {
        console.error("[payments.routes] Error getting Stripe status:", error);
      }
    }

    res.json({
      paymentStatus: bid.paymentStatus || "none",
      paymentIntentId: bid.paymentIntentId || null,
      amount: bid.amount,
      status: stripeStatus,
    });
  } catch (e) {
    console.error("[payments.routes] status error:", e);
    next(e);
  }
});

export default router;

