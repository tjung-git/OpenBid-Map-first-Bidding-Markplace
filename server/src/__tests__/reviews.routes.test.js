import request from "supertest";
import Jimp from "jimp";
import {
  createRealApp,
  preserveRealEnv,
  seedRealUser,
  publishJob,
} from "./testUtils.js";

preserveRealEnv();

describe("reviews routes (real adapters)", () => {
  let tinyJpeg;

  beforeAll(async () => {
    const img = new Jimp(2, 2, 0xffffffff);
    tinyJpeg = await img.getBufferAsync(Jimp.MIME_JPEG);
  });

  test("POST /api/reviews requires awarded job and awarded bidder target", async () => {
    const { app, db } = await createRealApp({ jobs: true, bids: true, reviews: true });
    const contractor = await seedRealUser(db, {
      userType: "contractor",
      uid: "reviewing-contractor",
    });
    const bidder = await seedRealUser(db, {
      userType: "bidder",
      uid: "reviewed-bidder",
    });

    const job = await publishJob(app, contractor.uid);

    const bidResponse = await request(app)
      .post(`/api/bids/${job.id}`)
      .set("x-mock-uid", bidder.uid)
      .send({ amount: 123, note: "" });
    expect(bidResponse.status).toBe(200);
    const bidId = bidResponse.body.bid.id;

    // Not awarded yet -> cannot review
    const notAwarded = await request(app)
      .post("/api/reviews")
      .set("x-mock-uid", contractor.uid)
      .send({
        jobId: job.id,
        reviewedId: bidder.uid,
        rating: 5,
        description: "Great work",
      });
    expect(notAwarded.status).toBe(409);
    expect(notAwarded.body).toEqual({ error: "job_not_awarded" });

    // Award the job to bidder
    const accept = await request(app)
      .post(`/api/bids/${job.id}/${bidId}/accept`)
      .set("x-mock-uid", contractor.uid);
    expect(accept.status).toBe(200);

    // Wrong reviewedId -> rejected
    const wrongTarget = await request(app)
      .post("/api/reviews")
      .set("x-mock-uid", contractor.uid)
      .send({
        jobId: job.id,
        reviewedId: "someone-else",
        rating: 5,
        description: "Nope",
      });
    expect(wrongTarget.status).toBe(404); // reviewed user not found
    expect(wrongTarget.body).toEqual({ error: "reviewed_user_not_found" });

    // Correct review succeeds
    const ok = await request(app)
      .post("/api/reviews")
      .set("x-mock-uid", contractor.uid)
      .send({
        jobId: job.id,
        reviewedId: bidder.uid,
        rating: 5,
        description: "Great work",
      });
    expect(ok.status).toBe(201);
    expect(ok.body.review).toMatchObject({
      reviewerId: contractor.uid,
      reviewedId: bidder.uid,
      jobId: job.id,
      rating: 5,
      description: "Great work",
    });
  });

  test("POST /api/reviews rejects self-review, bidder reviewers, and duplicates", async () => {
    const { app, db } = await createRealApp({ jobs: true, bids: true, reviews: true });
    const contractor = await seedRealUser(db, {
      userType: "contractor",
      uid: "contractor-2",
    });
    const bidder = await seedRealUser(db, {
      userType: "bidder",
      uid: "bidder-2",
    });
    const outsider = await seedRealUser(db, {
      userType: "bidder",
      uid: "outsider-2",
    });

    const job = await publishJob(app, contractor.uid);
    const bidResponse = await request(app)
      .post(`/api/bids/${job.id}`)
      .set("x-mock-uid", bidder.uid)
      .send({ amount: 200, note: "" });
    const bidId = bidResponse.body.bid.id;

    await request(app)
      .post(`/api/bids/${job.id}/${bidId}/accept`)
      .set("x-mock-uid", contractor.uid);

    const selfReview = await request(app)
      .post("/api/reviews")
      .set("x-mock-uid", contractor.uid)
      .send({
        jobId: job.id,
        reviewedId: contractor.uid,
        rating: 5,
        description: "I am the best",
      });
    expect(selfReview.status).toBe(400);
    expect(selfReview.body).toEqual({ error: "cannot_review_self" });

    const bidderAttempts = await request(app)
      .post("/api/reviews")
      .set("x-mock-uid", bidder.uid)
      .send({
        jobId: job.id,
        reviewedId: bidder.uid,
        rating: 5,
        description: "trying",
      });
    expect(bidderAttempts.status).toBe(400);
    expect(bidderAttempts.body).toEqual({ error: "cannot_review_self" });

    const outsiderAttempts = await request(app)
      .post("/api/reviews")
      .set("x-mock-uid", outsider.uid)
      .send({
        jobId: job.id,
        reviewedId: bidder.uid,
        rating: 5,
        description: "trying",
      });
    expect(outsiderAttempts.status).toBe(403);
    expect(outsiderAttempts.body).toEqual({ error: "forbidden" });

    const first = await request(app)
      .post("/api/reviews")
      .set("x-mock-uid", contractor.uid)
      .send({
        jobId: job.id,
        reviewedId: bidder.uid,
        rating: 4,
        description: "Solid job",
      });
    expect(first.status).toBe(201);

    const dup = await request(app)
      .post("/api/reviews")
      .set("x-mock-uid", contractor.uid)
      .send({
        jobId: job.id,
        reviewedId: bidder.uid,
        rating: 5,
        description: "Second review",
      });
    expect(dup.status).toBe(409);
    expect(dup.body).toEqual({ error: "review_already_exists" });
  });

  test("POST /api/reviews/:reviewId/photos appends resized photo urls", async () => {
    const { app, db } = await createRealApp({ jobs: true, bids: true, reviews: true });
    const contractor = await seedRealUser(db, {
      userType: "contractor",
      uid: "contractor-photos",
    });
    const bidder = await seedRealUser(db, {
      userType: "bidder",
      uid: "bidder-photos",
    });

    const job = await publishJob(app, contractor.uid);
    const bidResponse = await request(app)
      .post(`/api/bids/${job.id}`)
      .set("x-mock-uid", bidder.uid)
      .send({ amount: 100, note: "" });
    const bidId = bidResponse.body.bid.id;

    await request(app)
      .post(`/api/bids/${job.id}/${bidId}/accept`)
      .set("x-mock-uid", contractor.uid);

    const createReview = await request(app)
      .post("/api/reviews")
      .set("x-mock-uid", contractor.uid)
      .send({
        jobId: job.id,
        reviewedId: bidder.uid,
        rating: 5,
        description: "Photos attached",
      });
    expect(createReview.status).toBe(201);
    const reviewId = createReview.body.review.id;

    const upload = await request(app)
      .post(`/api/reviews/${reviewId}/photos`)
      .set("x-mock-uid", contractor.uid)
      .attach("photos", tinyJpeg, {
        filename: "work.jpg",
        contentType: "image/jpeg",
      });

    expect(upload.status).toBe(200);
    expect(upload.body.review).toHaveProperty("id", reviewId);
    expect(Array.isArray(upload.body.review.photoUrls)).toBe(true);
    expect(upload.body.review.photoUrls.length).toBe(1);
    expect(typeof upload.body.review.photoUrls[0]).toBe("string");
    expect(upload.body.review.photoUrls[0].startsWith("https://")).toBe(true);
    expect(Array.isArray(upload.body.review.photoThumbUrls)).toBe(true);
    expect(upload.body.review.photoThumbUrls.length).toBe(1);
    expect(upload.body.review.photoThumbUrls[0].startsWith("https://")).toBe(true);

    const list = await request(app)
      .get(`/api/reviews/user/${bidder.uid}`)
      .set("x-mock-uid", contractor.uid);
    expect(list.status).toBe(200);
    expect(list.body.reviews[0].id).toBe(reviewId);
    expect(list.body.reviews[0].photoUrls.length).toBe(1);
  });

  test("PATCH /api/reviews/:reviewId updates rating/description for reviewer only", async () => {
    const { app, db } = await createRealApp({ jobs: true, bids: true, reviews: true });
    const contractor = await seedRealUser(db, {
      userType: "contractor",
      uid: "contractor-edit",
    });
    const bidder = await seedRealUser(db, {
      userType: "bidder",
      uid: "bidder-edit",
    });

    const job = await publishJob(app, contractor.uid);
    const bidResponse = await request(app)
      .post(`/api/bids/${job.id}`)
      .set("x-mock-uid", bidder.uid)
      .send({ amount: 100, note: "" });
    const bidId = bidResponse.body.bid.id;

    await request(app)
      .post(`/api/bids/${job.id}/${bidId}/accept`)
      .set("x-mock-uid", contractor.uid);

    const createReview = await request(app)
      .post("/api/reviews")
      .set("x-mock-uid", contractor.uid)
      .send({
        jobId: job.id,
        reviewedId: bidder.uid,
        rating: 4,
        description: "Good",
      });
    expect(createReview.status).toBe(201);
    const reviewId = createReview.body.review.id;

    const forbidden = await request(app)
      .patch(`/api/reviews/${reviewId}`)
      .set("x-mock-uid", bidder.uid)
      .send({ rating: 1, description: "Nope" });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ error: "forbidden" });

    const ok = await request(app)
      .patch(`/api/reviews/${reviewId}`)
      .set("x-mock-uid", contractor.uid)
      .send({ rating: 5, description: "Great work overall" });
    expect(ok.status).toBe(200);
    expect(ok.body.review).toMatchObject({
      id: reviewId,
      reviewerId: contractor.uid,
      reviewedId: bidder.uid,
      jobId: job.id,
      rating: 5,
      description: "Great work overall",
    });

    const clearDescription = await request(app)
      .patch(`/api/reviews/${reviewId}`)
      .set("x-mock-uid", contractor.uid)
      .send({ description: "" });
    expect(clearDescription.status).toBe(200);
    expect(clearDescription.body.review.description).toBe("");
  });

  test("DELETE /api/reviews/:reviewId/photos removes selected photos", async () => {
    const { app, db } = await createRealApp({ jobs: true, bids: true, reviews: true });
    const contractor = await seedRealUser(db, {
      userType: "contractor",
      uid: "contractor-delete-photos",
    });
    const bidder = await seedRealUser(db, {
      userType: "bidder",
      uid: "bidder-delete-photos",
    });

    const job = await publishJob(app, contractor.uid);
    const bidResponse = await request(app)
      .post(`/api/bids/${job.id}`)
      .set("x-mock-uid", bidder.uid)
      .send({ amount: 100, note: "" });
    const bidId = bidResponse.body.bid.id;

    await request(app)
      .post(`/api/bids/${job.id}/${bidId}/accept`)
      .set("x-mock-uid", contractor.uid);

    const createReview = await request(app)
      .post("/api/reviews")
      .set("x-mock-uid", contractor.uid)
      .send({
        jobId: job.id,
        reviewedId: bidder.uid,
        rating: 5,
        description: "Has photos",
      });
    expect(createReview.status).toBe(201);
    const reviewId = createReview.body.review.id;

    const upload = await request(app)
      .post(`/api/reviews/${reviewId}/photos`)
      .set("x-mock-uid", contractor.uid)
      .attach("photos", tinyJpeg, {
        filename: "work.jpg",
        contentType: "image/jpeg",
      });
    expect(upload.status).toBe(200);
    const urlToDelete = upload.body.review.photoUrls[0];

    const del = await request(app)
      .delete(`/api/reviews/${reviewId}/photos`)
      .set("x-mock-uid", contractor.uid)
      .send({ photoUrls: [urlToDelete] });
    expect(del.status).toBe(200);
    expect(Array.isArray(del.body.review.photoUrls)).toBe(true);
    expect(del.body.review.photoUrls.length).toBe(0);
  });

  test("DELETE /api/reviews/:reviewId removes the entire review", async () => {
    const { app, db } = await createRealApp({ jobs: true, bids: true, reviews: true });
    const contractor = await seedRealUser(db, {
      userType: "contractor",
      uid: "contractor-delete-review",
    });
    const bidder = await seedRealUser(db, {
      userType: "bidder",
      uid: "bidder-delete-review",
    });

    const job = await publishJob(app, contractor.uid);
    const bidResponse = await request(app)
      .post(`/api/bids/${job.id}`)
      .set("x-mock-uid", bidder.uid)
      .send({ amount: 100, note: "" });
    const bidId = bidResponse.body.bid.id;

    await request(app)
      .post(`/api/bids/${job.id}/${bidId}/accept`)
      .set("x-mock-uid", contractor.uid);

    const createReview = await request(app)
      .post("/api/reviews")
      .set("x-mock-uid", contractor.uid)
      .send({
        jobId: job.id,
        reviewedId: bidder.uid,
        rating: 5,
        description: "Will be deleted",
      });
    expect(createReview.status).toBe(201);
    const reviewId = createReview.body.review.id;

    const forbidden = await request(app)
      .delete(`/api/reviews/${reviewId}`)
      .set("x-mock-uid", bidder.uid);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ error: "forbidden" });

    const del = await request(app)
      .delete(`/api/reviews/${reviewId}`)
      .set("x-mock-uid", contractor.uid);
    expect(del.status).toBe(204);

    const list = await request(app)
      .get(`/api/reviews/user/${bidder.uid}`)
      .set("x-mock-uid", contractor.uid);
    expect(list.status).toBe(200);
    expect(list.body.summary.count).toBe(0);
  });

  test("GET /api/reviews/user/:uid returns reviewer identity and summary", async () => {
    const { app, db } = await createRealApp({ jobs: true, bids: true, reviews: true });
    const contractor = await seedRealUser(db, {
      userType: "contractor",
      uid: "contractor-3",
      firstName: "Mani",
      lastName: "Kumar",
      email: "mani@example.com",
    });
    const bidder = await seedRealUser(db, {
      userType: "bidder",
      uid: "bidder-3",
      firstName: "Wol",
      lastName: "Keva",
      email: "wol@example.com",
    });

    await db.profile.upsert({ uid: contractor.uid, avatarUrl: "https://example.com/c.png" });
    await db.profile.upsert({ uid: bidder.uid, avatarUrl: "https://example.com/b.png" });

    const job = await publishJob(app, contractor.uid);
    const bidResponse = await request(app)
      .post(`/api/bids/${job.id}`)
      .set("x-mock-uid", bidder.uid)
      .send({ amount: 300, note: "" });
    const bidId = bidResponse.body.bid.id;

    await request(app)
      .post(`/api/bids/${job.id}/${bidId}/accept`)
      .set("x-mock-uid", contractor.uid);

    await request(app)
      .post("/api/reviews")
      .set("x-mock-uid", contractor.uid)
      .send({
        jobId: job.id,
        reviewedId: bidder.uid,
        rating: 5,
        description: "Excellent",
      });

    const list = await request(app)
      .get(`/api/reviews/user/${bidder.uid}`)
      .set("x-mock-uid", contractor.uid);

    expect(list.status).toBe(200);
    expect(list.body.reviewedUser).toMatchObject({
      uid: bidder.uid,
      email: "wol@example.com",
      firstName: "Wol",
      lastName: "Keva",
      avatarUrl: "https://example.com/b.png",
    });
    expect(list.body.summary).toMatchObject({ count: 1, avgRating: 5 });
    expect(list.body.reviews[0].reviewer).toMatchObject({
      uid: contractor.uid,
      email: "mani@example.com",
      firstName: "Mani",
      lastName: "Kumar",
      avatarUrl: "https://example.com/c.png",
    });
  });
});
