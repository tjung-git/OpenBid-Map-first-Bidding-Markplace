import { Router } from "express";
import { config } from "../config.js";
import { auth as mockAuth } from "../adapters/auth.mock.js";
import { auth as realAuth } from "../adapters/auth.real.js";
import { db as mockDb } from "../adapters/db.mock.js";
import { db as realDb } from "../adapters/db.real.js";

const router = Router();
const auth = config.prototype ? mockAuth : realAuth;
const db = config.prototype ? mockDb : realDb;

const isKycVerified = (value) =>
  typeof value === "string" && value.trim().toLowerCase() === "verified";

router.get("/myBids", async (req, res, next) => {
  try {
    const session = await auth.verify(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });
    const rawBids = await db.bid.listByUser(session.uid);
    const bidsWithInfo = await Promise.all(
      rawBids.map(async (bid) => {
        const job = bid.jobId ? await db.job.get(bid.jobId) : null;
        const contractorRecord = job?.posterId
          ? await db.user.get(job.posterId)
          : null;
        return {
          ...bid,
          jobTitle: bid.jobTitle || job?.title || bid.jobId,
          jobDescription: bid.jobDescription || job?.description,
          contractorName:
            bid.contractorName ||
            ([contractorRecord?.firstName, contractorRecord?.lastName]
              .filter(Boolean)
              .join(" ") || contractorRecord?.email || "Contractor"),
          jobBudgetAmount:
            bid.jobBudgetAmount !== undefined
              ? bid.jobBudgetAmount
              : job?.budgetAmount,
          jobLocation: bid.jobLocation || job?.location,
        };
      })
    );
    const sorted = bidsWithInfo.sort((a, b) => {
      const aCreated = new Date(a.bidCreatedAt || a.createdAt || 0).getTime();
      const bCreated = new Date(b.bidCreatedAt || b.createdAt || 0).getTime();
      return bCreated - aCreated;
    });
    res.json({ bids: sorted });
  } catch (e) {
    next(e);
  }
});

router.delete("/:bidId", async (req, res, next) => {
  try {
    const session = await auth.verify(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });
    const bid = await db.bid.get(req.params.bidId);
    if (!bid) return res.status(404).json({ error: "not_found" });
    if (bid.providerId !== session.uid)
      return res.status(403).json({ error: "forbidden" });
    const deleted = await db.bid.delete(req.params.bidId);
    if (!deleted) return res.status(404).json({ error: "not_found" });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

router.get("/:jobId", async (req, res, next) => {
  try {
    const jobId = req.params.jobId;
    const [job, rawBids] = await Promise.all([
      db.job.get(jobId),
      db.bid.listByJob(jobId),
    ]);

    let contractorRecord = null;
    if (job?.posterId) {
      contractorRecord = await db.user.get(job.posterId);
    }

    const contractorName = contractorRecord
      ? [contractorRecord.firstName, contractorRecord.lastName]
          .filter(Boolean)
          .join(" ") || contractorRecord.email || "Contractor"
      : "Contractor";

    const enriched = rawBids.map((bid) => ({
      ...bid,
      jobId,
      jobTitle: bid.jobTitle || job?.title || bid.jobId,
      jobDescription: bid.jobDescription || job?.description,
      jobBudgetAmount:
        bid.jobBudgetAmount !== undefined
          ? bid.jobBudgetAmount
          : job?.budgetAmount,
      contractorName: bid.contractorName || contractorName,
      bidCreatedAt: bid.bidCreatedAt || bid.createdAt,
    }));

    const sorted = enriched.sort((a, b) => {
      const aCreated = new Date(a.bidCreatedAt || a.createdAt || 0).getTime();
      const bCreated = new Date(b.bidCreatedAt || b.createdAt || 0).getTime();
      return bCreated - aCreated;
    });

    const highestBid = sorted.reduce((acc, bid) => {
      const amount = Number(bid.amount);
      if (!Number.isFinite(amount)) return acc;
      if (!acc || amount > acc.amount) {
        return {
          id: bid.id,
          amount,
          bidderName: bid.bidderName || "Bidder",
        };
      }
      return acc;
    }, null);

    res.json({ bids: sorted, highestBid });
  } catch (e) {
    next(e);
  }
});

router.post("/:jobId", async (req, res, next) => {
  try {
    const s = await auth.verify(req);
    if (!s) return res.status(401).json({ error: "unauthorized" });
    const u = await db.user.get(s.uid);
    if (!isKycVerified(u?.kycStatus))
      return res.status(403).json({ error: "KYC required" });
    const { amount, note } = req.body;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: "invalid_amount" });
    }
    const job = await db.job.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: "job_not_found" });
    if (job.status && job.status !== "open") {
      return res.status(409).json({ error: "bidding_closed" });
    }
    const budgetAmount = Number(job.budgetAmount);
    if (Number.isFinite(budgetAmount) && numericAmount < budgetAmount) {
      return res
        .status(400)
        .json({ error: "bid_below_budget", minAmount: budgetAmount });
    }
    const existingBid = (await db.bid.listByJob(req.params.jobId)).find(
      (bid) => bid.providerId === s.uid
    );
    if (existingBid) {
      return res.status(409).json({
        error: "bid_already_exists",
        bidId: existingBid.id,
      });
    }
    const contractorRecord = job.posterId
      ? await db.user.get(job.posterId)
      : null;
    const bidderName = [u.firstName, u.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || u.email || "Bidder";
    const bid = await db.bid.create({
      jobId: req.params.jobId,
      providerId: s.uid,
      bidderName,
      contractorId: job.posterId || null,
      contractorName:
        [contractorRecord?.firstName, contractorRecord?.lastName]
          .filter(Boolean)
          .join(" ") || contractorRecord?.email || "Contractor",
      jobTitle: job.title,
      jobDescription: job.description,
      jobBudgetAmount: job.budgetAmount,
      jobLocation: job.location,
      amount: numericAmount,
      note,
      status: "active",
      bidCreatedAt: new Date().toISOString(),
    });
    res.json({ bid });
  } catch (e) {
    next(e);
  }
});

router.post("/:jobId/:bidId/accept", async (req, res, next) => {
  try {
    const session = await auth.verify(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });

    const { jobId, bidId } = req.params;
    const job = await db.job.get(jobId);
    if (!job) return res.status(404).json({ error: "job_not_found" });
    if (job.posterId !== session.uid) {
      return res.status(403).json({ error: "forbidden" });
    }

    const bids = await db.bid.listByJob(jobId);
    if (!Array.isArray(bids) || bids.length === 0) {
      return res.status(404).json({ error: "bid_not_found" });
    }

    const targetBid = bids.find((entry) => entry.id === bidId);
    if (!targetBid) {
      return res.status(404).json({ error: "bid_not_found" });
    }

    if (job.awardedBidId && job.awardedBidId !== bidId) {
      return res.status(409).json({
        error: "job_already_awarded",
        awardedBidId: job.awardedBidId,
      });
    }

    const decisionTime = new Date().toISOString();
    const acceptedBid = await db.bid.update(bidId, {
      status: "accepted",
      statusNote: "Contractor accepted this bid.",
      bidClosedAt: decisionTime,
    });

    const rejectionNote = "Contractor accepted another bid.";
    const rejectedBids = await Promise.all(
      bids
        .filter((entry) => entry.id !== bidId)
        .map((entry) =>
          db.bid.update(entry.id, {
            status: "rejected",
            statusNote: rejectionNote,
            bidClosedAt: decisionTime,
          })
        )
    );

    const jobUpdate = await db.job.update(jobId, {
      status: "awarded",
      awardedBidId: bidId,
      awardedProviderId: acceptedBid?.providerId || targetBid.providerId,
      awardedAt: decisionTime,
    });

    res.json({
      acceptedBid,
      rejectedBids: rejectedBids.filter(Boolean),
      job: jobUpdate || job,
    });
  } catch (e) {
    next(e);
  }
});

router.patch("/:jobId/:bidId", async (req, res, next) => {
  try {
    const s = await auth.verify(req);
    if (!s) return res.status(401).json({ error: "unauthorized" });
    const bid = await db.bid.get(req.params.bidId);
    if (!bid || bid.jobId !== req.params.jobId) {
      return res.status(404).json({ error: "not_found" });
    }
    if (bid.providerId !== s.uid) {
      return res.status(403).json({ error: "forbidden" });
    }
    const job = await db.job.get(req.params.jobId);
    if (job?.status && job.status !== "open") {
      return res.status(409).json({ error: "bidding_closed" });
    }
    if (bid.status && bid.status !== "active") {
      return res.status(409).json({ error: "bid_closed" });
    }

    const patch = {};
    if (req.body.amount !== undefined) {
      const numericAmount = Number(req.body.amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ error: "invalid_amount" });
      }
      const minAmount = Number(
        job?.budgetAmount ?? bid.jobBudgetAmount ?? bid.jobBudget
      );
      if (Number.isFinite(minAmount) && numericAmount < minAmount) {
        return res
          .status(400)
          .json({ error: "bid_below_budget", minAmount });
      }
      patch.amount = numericAmount;
    }
    if (req.body.note !== undefined) {
      patch.note = req.body.note;
    }
    if (req.body.status !== undefined) {
      patch.status = req.body.status;
    }
    patch.bidUpdatedAt = new Date().toISOString();
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "no_update_fields" });
    }
    const updated = await db.bid.update(req.params.bidId, patch);
    res.json({ bid: updated });
  } catch (e) {
    next(e);
  }
});

export default router;
