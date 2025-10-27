import request from "supertest";
import {
  createRealApp,
  preserveRealEnv,
  seedRealUser,
  publishJob,
} from "./testUtils.js";

preserveRealEnv();

describe("jobs routes (real adapters)", () => {
  test("POST /api/jobs creates a job for contractor Jane Doe when KYC verified", async () => {
    // Adapters still let a verified contractor post a job.
    const { app, db } = await createRealApp({ jobs: true });
    const jane = await seedRealUser(db, { userType: "contractor" });

    const response = await request(app)
      .post("/api/jobs")
      .set("x-mock-uid", jane.uid)
      .send({
        title: "Kitchen Remodel",
        description: "Full kitchen remodel project",
        budgetAmount: 25000,
        location: { lat: 37.7749, lng: -122.4194 },
      });

    expect(response.status).toBe(200);
    expect(response.body.job).toMatchObject({
      posterId: jane.uid,
      title: "Kitchen Remodel",
      description: "Full kitchen remodel project",
      budgetAmount: 25000,
      status: "open",
    });
    expect(response.body.job).toHaveProperty("id");
  });

  test("POST /api/jobs rejects bidder Jane Doe with contractor_only error", async () => {
    // A bidder account hitting the real endpoint gets the contractor_only error.
    const { app, db } = await createRealApp({ jobs: true });
    const bidderJane = await seedRealUser(db, { userType: "bidder" });

    const response = await request(app)
      .post("/api/jobs")
      .set("x-mock-uid", bidderJane.uid)
      .send({
        title: "Painting",
        description: "Interior repaint project",
        budgetAmount: 5000,
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "contractor_only" });
  });

  test("POST /api/jobs enforces KYC verification for contractor Jane Doe", async () => {
    // KYC pending blocks job creation even when we use the real adapters.
    const { app, db } = await createRealApp({ jobs: true });
    const jane = await seedRealUser(db, {
      userType: "contractor",
      kycStatus: "pending",
    });

    const response = await request(app)
      .post("/api/jobs")
      .set("x-mock-uid", jane.uid)
      .send({
        title: "Deck Build",
        description: "New backyard deck",
        budgetAmount: 12000,
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "KYC required" });
  });

  test("PATCH /api/jobs updates an open job owned by contractor Jane Doe", async () => {
    // Jane edits her own open job and the change goes through in real mode.
    const { app, db } = await createRealApp({ jobs: true });
    const jane = await seedRealUser(db, { userType: "contractor" });
    const job = await publishJob(app, jane.uid);

    const response = await request(app)
      .patch(`/api/jobs/${job.id}`)
      .set("x-mock-uid", jane.uid)
      .send({
        title: "Kitchen Remodel - Updated",
        budgetAmount: 30000,
      });

    expect(response.status).toBe(200);
    expect(response.body.job).toMatchObject({
      id: job.id,
      title: "Kitchen Remodel - Updated",
      budgetAmount: 30000,
    });
  });

  test("PATCH /api/jobs forbids Jane Doe from editing another contractor's job", async () => {
    // The real adapter path still stops Jane from touching someone else's job.
    const { app, db } = await createRealApp({ jobs: true });
    const owner = await seedRealUser(db, {
      userType: "contractor",
      email: "owner.jane@example.com",
      uid: "owner-jane",
    });
    const intruder = await seedRealUser(db, {
      userType: "contractor",
      email: "intruder.jane@example.com",
      uid: "intruder-jane",
    });
    const job = await publishJob(app, owner.uid);

    const response = await request(app)
      .patch(`/api/jobs/${job.id}`)
      .set("x-mock-uid", intruder.uid)
      .send({ title: "Malicious Update" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "forbidden" });
  });

  test("PATCH /api/jobs returns job_locked when status is no longer open", async () => {
    // Once the job state changes, real adapters block further edits.
    const { app, db } = await createRealApp({ jobs: true });
    const jane = await seedRealUser(db, { userType: "contractor" });
    const job = await publishJob(app, jane.uid);

    await db.job.update(job.id, { status: "awarded" });

    const response = await request(app)
      .patch(`/api/jobs/${job.id}`)
      .set("x-mock-uid", jane.uid)
      .send({ title: "Should Fail" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "job_locked" });
  });

  test("DELETE /api/jobs removes an open job owned by contractor Jane Doe", async () => {
    // Jane can delete her own open job and it disappears from the test Firestore.
    const { app, db } = await createRealApp({ jobs: true });
    const jane = await seedRealUser(db, { userType: "contractor" });
    const job = await publishJob(app, jane.uid);

    const response = await request(app)
      .delete(`/api/jobs/${job.id}`)
      .set("x-mock-uid", jane.uid);

    expect(response.status).toBe(204);
    expect(await db.job.get(job.id)).toBeNull();
  });

  test("DELETE /api/jobs forbids contractor Jane Doe from deleting someone else's job", async () => {
    // Trying to delete another contractor's job still returns forbidden.
    const { app, db } = await createRealApp({ jobs: true });
    const owner = await seedRealUser(db, {
      userType: "contractor",
      email: "owner.jane@example.com",
      uid: "owner-jane",
    });
    const intruder = await seedRealUser(db, {
      userType: "contractor",
      email: "intruder.jane@example.com",
      uid: "intruder-jane",
    });
    const job = await publishJob(app, owner.uid);

    const response = await request(app)
      .delete(`/api/jobs/${job.id}`)
      .set("x-mock-uid", intruder.uid);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "forbidden" });
  });

  test("DELETE /api/jobs returns job_locked when job status is not open", async () => {
    // The delete path respects job status and blocks once it is not open.
    const { app, db } = await createRealApp({ jobs: true });
    const jane = await seedRealUser(db, { userType: "contractor" });
    const job = await publishJob(app, jane.uid);

    await db.job.update(job.id, { status: "completed" });

    const response = await request(app)
      .delete(`/api/jobs/${job.id}`)
      .set("x-mock-uid", jane.uid);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "job_locked" });
  });
});
