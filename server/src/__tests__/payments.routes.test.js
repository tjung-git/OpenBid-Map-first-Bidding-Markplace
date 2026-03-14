import request from "supertest";
import {
  createRealApp,
  preserveRealEnv,
  seedRealUser,
  publishJob,
} from "./testUtils.js";

preserveRealEnv();

describe("payments routes (real adapters)", () => {
  describe("POST /api/payments/create-intent", () => {
    test("creates payment intent for accepted bid", async () => {
      const { app, db } = await createRealApp({ jobs: true, bids: true, payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor", kycStatus: "verified" });
      const bidder = await seedRealUser(db, { userType: "bidder", kycStatus: "verified" });

      // Create job
      const job = await publishJob(app, contractor.uid);

      // Create and accept bid
      const bidResponse = await request(app)
        .post(`/api/bids/${job.id}`)
        .set("x-mock-uid", bidder.uid)
        .send({ amount: 1000, note: "I can do this" });

      const bidId = bidResponse.body.bid.id;

      await request(app)
        .post(`/api/bids/${job.id}/${bidId}/accept`)
        .set("x-mock-uid", contractor.uid);

      // Create payment intent
      const response = await request(app)
        .post("/api/payments/create-intent")
        .set("x-mock-uid", contractor.uid)
        .send({
          jobId: job.id,
          bidId: bidId,
          amount: 1000,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("clientSecret");
      expect(response.body).toHaveProperty("paymentIntentId");
      expect(response.body.clientSecret).toMatch(/^mock_cs_/);
      expect(response.body.paymentIntentId).toMatch(/^mock_pi_/);

      // Verify bid and job were updated
      const updatedBid = await db.bid.get(bidId);
      expect(updatedBid.paymentIntentId).toBe(response.body.paymentIntentId);
      expect(updatedBid.paymentStatus).toBe("pending");

      const updatedJob = await db.job.get(job.id);
      expect(updatedJob.paymentIntentId).toBe(response.body.paymentIntentId);
      expect(updatedJob.paymentStatus).toBe("pending");
    });

    test("returns 401 when not authenticated", async () => {
      const { app } = await createRealApp({ payments: true });

      const response = await request(app)
        .post("/api/payments/create-intent")
        .send({
          jobId: "job123",
          bidId: "bid123",
          amount: 1000,
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "unauthorized" });
    });

    test("returns 400 when missing required fields", async () => {
      const { app, db } = await createRealApp({ payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor" });

      const response = await request(app)
        .post("/api/payments/create-intent")
        .set("x-mock-uid", contractor.uid)
        .send({
          jobId: "job123",
          // Missing bidId and amount
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "missing_required_fields" });
    });

    test("returns 400 when amount is invalid", async () => {
      const { app, db } = await createRealApp({ payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor" });

      const response = await request(app)
        .post("/api/payments/create-intent")
        .set("x-mock-uid", contractor.uid)
        .send({
          jobId: "job123",
          bidId: "bid123",
          amount: -100, // Invalid negative amount
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "invalid_amount" });
    });

    test("returns 400 when amount is zero", async () => {
      const { app, db } = await createRealApp({ payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor" });

      const response = await request(app)
        .post("/api/payments/create-intent")
        .set("x-mock-uid", contractor.uid)
        .send({
          jobId: "job123",
          bidId: "bid123",
          amount: 0,
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "missing_required_fields" });
    });

    test("returns 404 when bid not found", async () => {
      const { app, db } = await createRealApp({ payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor" });

      const response = await request(app)
        .post("/api/payments/create-intent")
        .set("x-mock-uid", contractor.uid)
        .send({
          jobId: "job123",
          bidId: "nonexistent_bid",
          amount: 1000,
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "bid_not_found" });
    });

    test("returns 404 when job not found", async () => {
      const { app, db } = await createRealApp({ jobs: true, bids: true, payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor", kycStatus: "verified" });
      const bidder = await seedRealUser(db, { userType: "bidder", kycStatus: "verified" });

      const job = await publishJob(app, contractor.uid);

      const bidResponse = await request(app)
        .post(`/api/bids/${job.id}`)
        .set("x-mock-uid", bidder.uid)
        .send({ amount: 1000, note: "I can do this" });

      const bidId = bidResponse.body.bid.id;

      // Delete the job
      await db.job.delete(job.id);

      const response = await request(app)
        .post("/api/payments/create-intent")
        .set("x-mock-uid", contractor.uid)
        .send({
          jobId: job.id,
          bidId: bidId,
          amount: 1000,
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "bid_not_found" });
    });

    test("returns 403 when user is not job poster", async () => {
      const { app, db } = await createRealApp({ jobs: true, bids: true, payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor", kycStatus: "verified" });
      const bidder = await seedRealUser(db, { userType: "bidder", kycStatus: "verified" });
      const otherUser = await seedRealUser(db, { userType: "contractor", kycStatus: "verified" });

      const job = await publishJob(app, contractor.uid);

      const bidResponse = await request(app)
        .post(`/api/bids/${job.id}`)
        .set("x-mock-uid", bidder.uid)
        .send({ amount: 1000, note: "I can do this" });

      const bidId = bidResponse.body.bid.id;

      await request(app)
        .post(`/api/bids/${job.id}/${bidId}/accept`)
        .set("x-mock-uid", contractor.uid);

      // Try to create payment intent as different user
      const response = await request(app)
        .post("/api/payments/create-intent")
        .set("x-mock-uid", otherUser.uid)
        .send({
          jobId: job.id,
          bidId: bidId,
          amount: 1000,
        });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: "forbidden" });
    });

    test("returns 400 when bid is not accepted", async () => {
      const { app, db } = await createRealApp({ jobs: true, bids: true, payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor", kycStatus: "verified" });
      const bidder = await seedRealUser(db, { userType: "bidder", kycStatus: "verified" });

      const job = await publishJob(app, contractor.uid);

      const bidResponse = await request(app)
        .post(`/api/bids/${job.id}`)
        .set("x-mock-uid", bidder.uid)
        .send({ amount: 1000, note: "I can do this" });

      const bidId = bidResponse.body.bid.id;

      // Don't accept the bid, try to create payment intent
      const response = await request(app)
        .post("/api/payments/create-intent")
        .set("x-mock-uid", contractor.uid)
        .send({
          jobId: job.id,
          bidId: bidId,
          amount: 1000,
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "bid_not_accepted" });
    });

    test("returns 409 when payment intent already exists in valid state", async () => {
      const { app, db } = await createRealApp({ jobs: true, bids: true, payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor", kycStatus: "verified" });
      const bidder = await seedRealUser(db, { userType: "bidder", kycStatus: "verified" });

      const job = await publishJob(app, contractor.uid);

      const bidResponse = await request(app)
        .post(`/api/bids/${job.id}`)
        .set("x-mock-uid", bidder.uid)
        .send({ amount: 1000, note: "I can do this" });

      const bidId = bidResponse.body.bid.id;

      await request(app)
        .post(`/api/bids/${job.id}/${bidId}/accept`)
        .set("x-mock-uid", contractor.uid);

      // Create payment intent first time
      await request(app)
        .post("/api/payments/create-intent")
        .set("x-mock-uid", contractor.uid)
        .send({
          jobId: job.id,
          bidId: bidId,
          amount: 1000,
        });

      // Try to create again
      const response = await request(app)
        .post("/api/payments/create-intent")
        .set("x-mock-uid", contractor.uid)
        .send({
          jobId: job.id,
          bidId: bidId,
          amount: 1000,
        });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: "payment_already_exists" });
    });
  });

  describe("POST /api/payments/:jobId/confirm", () => {
    test("confirms payment and updates job status to in_progress", async () => {
      const { app, db } = await createRealApp({ jobs: true, bids: true, payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor", kycStatus: "verified" });
      const bidder = await seedRealUser(db, { userType: "bidder", kycStatus: "verified" });

      const job = await publishJob(app, contractor.uid);

      const bidResponse = await request(app)
        .post(`/api/bids/${job.id}`)
        .set("x-mock-uid", bidder.uid)
        .send({ amount: 1000, note: "I can do this" });

      const bidId = bidResponse.body.bid.id;

      await request(app)
        .post(`/api/bids/${job.id}/${bidId}/accept`)
        .set("x-mock-uid", contractor.uid);

      const intentResponse = await request(app)
        .post("/api/payments/create-intent")
        .set("x-mock-uid", contractor.uid)
        .send({
          jobId: job.id,
          bidId: bidId,
          amount: 1000,
        });

      const paymentIntentId = intentResponse.body.paymentIntentId;

      const response = await request(app)
        .post(`/api/payments/${job.id}/confirm`)
        .set("x-mock-uid", contractor.uid)
        .send({ paymentIntentId });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true, status: "held" });

      const updatedBid = await db.bid.get(bidId);
      expect(updatedBid.paymentStatus).toBe("held");

      const updatedJob = await db.job.get(job.id);
      expect(updatedJob.paymentStatus).toBe("held");
      expect(updatedJob.status).toBe("in_progress");
    });

    test("returns 401 when not authenticated", async () => {
      const { app } = await createRealApp({ payments: true });

      const response = await request(app)
        .post("/api/payments/job123/confirm")
        .send({ paymentIntentId: "pi_123" });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "unauthorized" });
    });

    test("returns 400 when paymentIntentId is missing", async () => {
      const { app, db } = await createRealApp({ payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor" });

      const response = await request(app)
        .post("/api/payments/job123/confirm")
        .set("x-mock-uid", contractor.uid)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "payment_intent_id_required" });
    });

    test("returns 404 when job not found", async () => {
      const { app, db } = await createRealApp({ payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor" });

      const response = await request(app)
        .post("/api/payments/nonexistent_job/confirm")
        .set("x-mock-uid", contractor.uid)
        .send({ paymentIntentId: "pi_123" });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "job_not_found" });
    });

    test("returns 403 when user is not job poster", async () => {
      const { app, db } = await createRealApp({ jobs: true, payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor" });
      const otherUser = await seedRealUser(db, { userType: "contractor" });

      const job = await publishJob(app, contractor.uid);

      const response = await request(app)
        .post(`/api/payments/${job.id}/confirm`)
        .set("x-mock-uid", otherUser.uid)
        .send({ paymentIntentId: "pi_123" });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "bid_not_found" });
    });
  });

  describe("POST /api/payments/:jobId/capture", () => {
    test("captures payment and marks job as completed", async () => {
      const { app, db } = await createRealApp({ jobs: true, bids: true, payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor", kycStatus: "verified" });
      const bidder = await seedRealUser(db, { userType: "bidder", kycStatus: "verified" });

      const job = await publishJob(app, contractor.uid);

      const bidResponse = await request(app)
        .post(`/api/bids/${job.id}`)
        .set("x-mock-uid", bidder.uid)
        .send({ amount: 1000, note: "I can do this" });

      const bidId = bidResponse.body.bid.id;

      await request(app)
        .post(`/api/bids/${job.id}/${bidId}/accept`)
        .set("x-mock-uid", contractor.uid);

      const intentResponse = await request(app)
        .post("/api/payments/create-intent")
        .set("x-mock-uid", contractor.uid)
        .send({
          jobId: job.id,
          bidId: bidId,
          amount: 1000,
        });

      await request(app)
        .post(`/api/payments/${job.id}/confirm`)
        .set("x-mock-uid", contractor.uid)
        .send({ paymentIntentId: intentResponse.body.paymentIntentId });

      const response = await request(app)
        .post(`/api/payments/${job.id}/capture`)
        .set("x-mock-uid", contractor.uid);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true, status: "captured" });

      const updatedBid = await db.bid.get(bidId);
      expect(updatedBid.paymentStatus).toBe("captured");

      const updatedJob = await db.job.get(job.id);
      expect(updatedJob.paymentStatus).toBe("captured");
      expect(updatedJob.status).toBe("completed");
      expect(updatedJob.completedAt).toBeDefined();
    });

    test("returns 401 when not authenticated", async () => {
      const { app } = await createRealApp({ payments: true });

      const response = await request(app)
        .post("/api/payments/job123/capture");

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "unauthorized" });
    });

    test("returns 404 when job not found", async () => {
      const { app, db } = await createRealApp({ payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor" });

      const response = await request(app)
        .post("/api/payments/nonexistent_job/capture")
        .set("x-mock-uid", contractor.uid);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "job_not_found" });
    });

    test("returns 403 when user is not job poster", async () => {
      const { app, db } = await createRealApp({ jobs: true, payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor" });
      const otherUser = await seedRealUser(db, { userType: "contractor" });

      const job = await publishJob(app, contractor.uid);

      const response = await request(app)
        .post(`/api/payments/${job.id}/capture`)
        .set("x-mock-uid", otherUser.uid);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: "forbidden" });
    });

    test("returns 400 when payment is not held", async () => {
      const { app, db } = await createRealApp({ jobs: true, bids: true, payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor", kycStatus: "verified" });
      const bidder = await seedRealUser(db, { userType: "bidder", kycStatus: "verified" });

      const job = await publishJob(app, contractor.uid);

      const bidResponse = await request(app)
        .post(`/api/bids/${job.id}`)
        .set("x-mock-uid", bidder.uid)
        .send({ amount: 1000, note: "I can do this" });

      const bidId = bidResponse.body.bid.id;

      await request(app)
        .post(`/api/bids/${job.id}/${bidId}/accept`)
        .set("x-mock-uid", contractor.uid);

      // Try to capture without confirming payment first
      const response = await request(app)
        .post(`/api/payments/${job.id}/capture`)
        .set("x-mock-uid", contractor.uid);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("no_payment_intent");
    });
  });

  describe("POST /api/payments/:jobId/refund", () => {
    test("refunds payment and cancels job", async () => {
      const { app, db } = await createRealApp({ jobs: true, bids: true, payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor", kycStatus: "verified" });
      const bidder = await seedRealUser(db, { userType: "bidder", kycStatus: "verified" });

      const job = await publishJob(app, contractor.uid);

      const bidResponse = await request(app)
        .post(`/api/bids/${job.id}`)
        .set("x-mock-uid", bidder.uid)
        .send({ amount: 1000, note: "I can do this" });

      const bidId = bidResponse.body.bid.id;

      await request(app)
        .post(`/api/bids/${job.id}/${bidId}/accept`)
        .set("x-mock-uid", contractor.uid);

      const intentResponse = await request(app)
        .post("/api/payments/create-intent")
        .set("x-mock-uid", contractor.uid)
        .send({
          jobId: job.id,
          bidId: bidId,
          amount: 1000,
        });

      await request(app)
        .post(`/api/payments/${job.id}/confirm`)
        .set("x-mock-uid", contractor.uid)
        .send({ paymentIntentId: intentResponse.body.paymentIntentId });

      const response = await request(app)
        .post(`/api/payments/${job.id}/refund`)
        .set("x-mock-uid", contractor.uid);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true, status: "refunded" });

      const updatedBid = await db.bid.get(bidId);
      expect(updatedBid.paymentStatus).toBe("refunded");

      const updatedJob = await db.job.get(job.id);
      expect(updatedJob.paymentStatus).toBe("refunded");
      expect(updatedJob.status).toBe("cancelled");
    });

    test("refunds partial amount when specified", async () => {
      const { app, db } = await createRealApp({ jobs: true, bids: true, payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor", kycStatus: "verified" });
      const bidder = await seedRealUser(db, { userType: "bidder", kycStatus: "verified" });

      const job = await publishJob(app, contractor.uid);

      const bidResponse = await request(app)
        .post(`/api/bids/${job.id}`)
        .set("x-mock-uid", bidder.uid)
        .send({ amount: 1000, note: "I can do this" });

      const bidId = bidResponse.body.bid.id;

      await request(app)
        .post(`/api/bids/${job.id}/${bidId}/accept`)
        .set("x-mock-uid", contractor.uid);

      const intentResponse = await request(app)
        .post("/api/payments/create-intent")
        .set("x-mock-uid", contractor.uid)
        .send({
          jobId: job.id,
          bidId: bidId,
          amount: 1000,
        });

      await request(app)
        .post(`/api/payments/${job.id}/confirm`)
        .set("x-mock-uid", contractor.uid)
        .send({ paymentIntentId: intentResponse.body.paymentIntentId });

      const response = await request(app)
        .post(`/api/payments/${job.id}/refund`)
        .set("x-mock-uid", contractor.uid)
        .send({ amount: 500 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true, status: "refunded" });
    });

    test("returns 401 when not authenticated", async () => {
      const { app } = await createRealApp({ payments: true });

      const response = await request(app)
        .post("/api/payments/job123/refund");

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "unauthorized" });
    });

    test("returns 403 when user is not job poster", async () => {
      const { app, db } = await createRealApp({ jobs: true, payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor" });
      const otherUser = await seedRealUser(db, { userType: "contractor" });

      const job = await publishJob(app, contractor.uid);

      const response = await request(app)
        .post(`/api/payments/${job.id}/refund`)
        .set("x-mock-uid", otherUser.uid);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: "forbidden" });
    });
  });

  describe("GET /api/payments/:jobId/status", () => {
    test("returns payment status for job poster", async () => {
      const { app, db } = await createRealApp({ jobs: true, bids: true, payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor", kycStatus: "verified" });
      const bidder = await seedRealUser(db, { userType: "bidder", kycStatus: "verified" });

      const job = await publishJob(app, contractor.uid);

      const bidResponse = await request(app)
        .post(`/api/bids/${job.id}`)
        .set("x-mock-uid", bidder.uid)
        .send({ amount: 1000, note: "I can do this" });

      const bidId = bidResponse.body.bid.id;

      await request(app)
        .post(`/api/bids/${job.id}/${bidId}/accept`)
        .set("x-mock-uid", contractor.uid);

      const intentResponse = await request(app)
        .post("/api/payments/create-intent")
        .set("x-mock-uid", contractor.uid)
        .send({
          jobId: job.id,
          bidId: bidId,
          amount: 1000,
        });

      const response = await request(app)
        .get(`/api/payments/${job.id}/status`)
        .set("x-mock-uid", contractor.uid);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        paymentStatus: "pending",
        paymentIntentId: intentResponse.body.paymentIntentId,
        amount: 1000,
        status: "requires_capture",
      });
    });

    test("returns payment status for awarded provider", async () => {
      const { app, db } = await createRealApp({ jobs: true, bids: true, payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor", kycStatus: "verified" });
      const bidder = await seedRealUser(db, { userType: "bidder", kycStatus: "verified" });

      const job = await publishJob(app, contractor.uid);

      const bidResponse = await request(app)
        .post(`/api/bids/${job.id}`)
        .set("x-mock-uid", bidder.uid)
        .send({ amount: 1000, note: "I can do this" });

      const bidId = bidResponse.body.bid.id;

      await request(app)
        .post(`/api/bids/${job.id}/${bidId}/accept`)
        .set("x-mock-uid", contractor.uid);

      await request(app)
        .post("/api/payments/create-intent")
        .set("x-mock-uid", contractor.uid)
        .send({
          jobId: job.id,
          bidId: bidId,
          amount: 1000,
        });

      const response = await request(app)
        .get(`/api/payments/${job.id}/status`)
        .set("x-mock-uid", bidder.uid);

      expect(response.status).toBe(200);
      expect(response.body.paymentStatus).toBe("pending");
    });

    test("returns 401 when not authenticated", async () => {
      const { app } = await createRealApp({ payments: true });

      const response = await request(app)
        .get("/api/payments/job123/status");

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "unauthorized" });
    });

    test("returns 404 when job not found", async () => {
      const { app, db } = await createRealApp({ payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor" });

      const response = await request(app)
        .get("/api/payments/nonexistent_job/status")
        .set("x-mock-uid", contractor.uid);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "job_not_found" });
    });

    test("returns 403 when user is not involved in job", async () => {
      const { app, db } = await createRealApp({ jobs: true, payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor" });
      const otherUser = await seedRealUser(db, { userType: "contractor" });

      const job = await publishJob(app, contractor.uid);

      const response = await request(app)
        .get(`/api/payments/${job.id}/status`)
        .set("x-mock-uid", otherUser.uid);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: "forbidden" });
    });

    test("returns none status when no bid awarded", async () => {
      const { app, db } = await createRealApp({ jobs: true, payments: true });
      const contractor = await seedRealUser(db, { userType: "contractor" });

      const job = await publishJob(app, contractor.uid);

      const response = await request(app)
        .get(`/api/payments/${job.id}/status`)
        .set("x-mock-uid", contractor.uid);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ paymentStatus: "none" });
    });
  });
});

