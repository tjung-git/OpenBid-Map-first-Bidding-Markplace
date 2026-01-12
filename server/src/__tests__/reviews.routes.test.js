import request from "supertest";
import {
  createRealApp,
  preserveRealEnv,
  seedRealUser,
} from "./testUtils.js";

preserveRealEnv();

describe("reviews routes (real adapters)", () => {
  let app;
  let db;
  let firestore;
  const tinyJpeg = Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAAQABADASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAwQFBv/EAB4QAAICAgMBAAAAAAAAAAAAAAIDBAEFBhIhMVGx/8QAFQEBAQAAAAAAAAAAAAAAAAAAAQL/xAAXEQEBAQEAAAAAAAAAAAAAAAABAgAD/9oADAMBAAIRAxEAPwD1KKKKACiiigAooooAKKKKACiiigAooooA//2Q==",
    "base64"
  );

  const seedJob = async ({
    posterId,
    status = "open",
    awardedProviderId,
  }) => {
    const created = await db.job.create({
      posterId,
      title: "Kitchen Remodel",
      description: "Full kitchen remodel project",
      budgetAmount: 25000,
      location: { lat: 37.7749, lng: -122.4194 },
    });

    if (status !== "awarded") return created;
    return db.job.update(created.id, { status: "awarded", awardedProviderId });
  };

  beforeAll(async () => {
    ({ app, db, firestore } = await createRealApp({
      reviews: true,
    }));
  });

  beforeEach(() => {
    if (firestore?._collections?.clear) {
      firestore._collections.clear();
    }
    if (typeof firestore?._counter === "number") {
      firestore._counter = 0;
    }
  });

  // Create review only after a bid is accepted and reviewedId matches the awarded bidder.
  test("POST /api/reviews requires awarded job and awarded bidder target", async () => {
    const contractor = await seedRealUser(db, {
      userType: "contractor",
      uid: "reviewing-contractor",
    });
    const bidder = await seedRealUser(db, {
      userType: "bidder",
      uid: "reviewed-bidder",
    });

    const job = await seedJob({ posterId: contractor.uid });

    // Not awarded yet; cannot review
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

    await db.job.update(job.id, {
      status: "awarded",
      awardedProviderId: bidder.uid,
    });

    // Wrong reviewedId; rejected
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

  // Block self-review, non-contractor reviewers, and duplicate reviews for the same job and user pair.
  test("POST /api/reviews rejects self-review, bidder reviewers, and duplicates", async () => {
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

    const job = await seedJob({
      posterId: contractor.uid,
      status: "awarded",
      awardedProviderId: bidder.uid,
    });

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

  // Upload review photos and verify we store https URLs and generated thumbnail URLs.
  test("POST /api/reviews/:reviewId/photos appends resized photo urls", async () => {
    const contractor = await seedRealUser(db, {
      userType: "contractor",
      uid: "contractor-photos",
    });
    const bidder = await seedRealUser(db, {
      userType: "bidder",
      uid: "bidder-photos",
    });

    const job = await seedJob({
      posterId: contractor.uid,
      status: "awarded",
      awardedProviderId: bidder.uid,
    });

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

  // Allow only the original reviewer to edit rating and description (including clearing description).
  test("PATCH /api/reviews/:reviewId updates rating/description for reviewer only", async () => {
    const contractor = await seedRealUser(db, {
      userType: "contractor",
      uid: "contractor-edit",
    });
    const bidder = await seedRealUser(db, {
      userType: "bidder",
      uid: "bidder-edit",
    });

    const job = await seedJob({
      posterId: contractor.uid,
      status: "awarded",
      awardedProviderId: bidder.uid,
    });

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

  // Remove specific photo URLs from a review and keep the remaining review data intact.
  test("DELETE /api/reviews/:reviewId/photos removes selected photos", async () => {
    const contractor = await seedRealUser(db, {
      userType: "contractor",
      uid: "contractor-delete-photos",
    });
    const bidder = await seedRealUser(db, {
      userType: "bidder",
      uid: "bidder-delete-photos",
    });

    const job = await seedJob({
      posterId: contractor.uid,
      status: "awarded",
      awardedProviderId: bidder.uid,
    });

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

  // Delete a whole review (only reviewer can delete) and verify it disappears from listings.
  test("DELETE /api/reviews/:reviewId removes the entire review", async () => {
    const contractor = await seedRealUser(db, {
      userType: "contractor",
      uid: "contractor-delete-review",
    });
    const bidder = await seedRealUser(db, {
      userType: "bidder",
      uid: "bidder-delete-review",
    });

    const job = await seedJob({
      posterId: contractor.uid,
      status: "awarded",
      awardedProviderId: bidder.uid,
    });

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

  // Fetch reviews for a user and verify summary stats plus reviewer profile enrichment.
  test("GET /api/reviews/user/:uid returns reviewer identity and summary", async () => {
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

    const job = await seedJob({
      posterId: contractor.uid,
      status: "awarded",
      awardedProviderId: bidder.uid,
    });

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
