import request from "supertest";
import {
  createRealApp,
  preserveRealEnv,
  seedRealUser,
  publishJob,
} from "./testUtils.js";

preserveRealEnv();

describe("bids routes (real adapters)", () => {
  test("POST /api/bids/:jobId prevents contractors from bidding on their own jobs", async () => {
    // Contractors cannot bid on their own jobs.
    const { app, db } = await createRealApp({ jobs: true, bids: true });
    const contractor = await seedRealUser(db, {
      userType: "contractor",
      uid: "contractor-owner",
    });
    const job = await publishJob(app, contractor.uid, {
      budgetAmount: 42000,
    });

    const response = await request(app)
      .post(`/api/bids/${job.id}`)
      .set("x-mock-uid", contractor.uid)
      .send({ amount: 42000 });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "own_job_bid" });
  });

  test("Accepting a bid hides the job from outsiders and locks further edits", async () => {
    // Accepting a bid flips the job to awarded, hides it from uninvolved users, and locks further edits to both the job and the accepted bid.
    const { app, db } = await createRealApp({
      auth: true,
      jobs: true,
      bids: true,
    });

    const contractor = await seedRealUser(db, {
      userType: "contractor",
      uid: "roofing-contractor",
      email: "roofing.contractor@example.com",
    });
    const bidder = await seedRealUser(db, {
      userType: "bidder",
      uid: "winning-bidder",
      email: "winning.bidder@example.com",
    });
    const observer = await seedRealUser(db, {
      userType: "bidder",
      uid: "observer-bidder",
      email: "observer@example.com",
    });

    const job = await publishJob(app, contractor.uid, {
      title: "Roof Repair",
      budgetAmount: 60000,
    });

    const bidResponse = await request(app)
      .post(`/api/bids/${job.id}`)
      .set("x-mock-uid", bidder.uid)
      .send({ amount: 60000, note: "Ready to start immediately." });

    expect(bidResponse.status).toBe(200);
    const bidId = bidResponse.body.bid.id;

    const acceptResponse = await request(app)
      .post(`/api/bids/${job.id}/${bidId}/accept`)
      .set("x-mock-uid", contractor.uid);

    expect(acceptResponse.status).toBe(200);
    expect(acceptResponse.body.job).toMatchObject({
      id: job.id,
      status: "awarded",
      awardedBidId: bidId,
      awardedProviderId: bidder.uid,
    });

    const jobPatch = await request(app)
      .patch(`/api/jobs/${job.id}`)
      .set("x-mock-uid", contractor.uid)
      .send({ title: "Roof Repair - Updated" });

    expect(jobPatch.status).toBe(409);
    expect(jobPatch.body).toEqual({ error: "job_locked" });

    const bidPatch = await request(app)
      .patch(`/api/bids/${job.id}/${bidId}`)
      .set("x-mock-uid", bidder.uid)
      .send({ amount: 65000 });

    expect(bidPatch.status).toBe(409);
    expect(bidPatch.body).toEqual({ error: "bidding_closed" });

    const listResponse = await request(app)
      .get("/api/jobs")
      .set("x-mock-uid", observer.uid);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.jobs.some((entry) => entry.id === job.id)).toBe(
      false
    );
  });
});
