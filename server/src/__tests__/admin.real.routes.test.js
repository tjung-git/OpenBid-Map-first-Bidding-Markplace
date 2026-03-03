import request from "supertest";
import express from "express";

// --- REAL MODE (prototype OFF) ---
jest.mock("../config.js", () => ({
  config: { PROTOTYPE: false, prototype: false },
}));

// bypass requireRole("admin") so we test admin.routes logic (requireAdmin) directly
jest.mock("../middleware/requireRole.js", () => ({
  requireRole: () => (req, res, next) => next(),
}));

jest.mock("../adapters/auth.real.js", () => ({
  auth: { verify: jest.fn() },
}));

jest.mock("../adapters/db.real.js", () => ({
  db: {
    user: {
      list: jest.fn(),
      get: jest.fn(),
      findByEmail: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    job: {
      list: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    bid: {
      list: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      listByJob: jest.fn(),
      listByUser: jest.fn(),
    },
  },
}));

// mock adapters should never be used in real mode tests, but mock them anyway
jest.mock("../adapters/auth.mock.js", () => ({
  auth: { verify: jest.fn() },
}));
jest.mock("../adapters/db.mock.js", () => ({
  db: {},
}));

// Firestore shouldn't be called directly by these routes now that list/delete exist in adapters
jest.mock("../lib/firebase.js", () => ({
  getDb: jest.fn(() => {
    throw new Error("getDb should not be called in real mode smoke tests");
  }),
}));

const realAuth = require("../adapters/auth.real.js");
const realDb = require("../adapters/db.real.js");

let app;
let adminRoutes;

function makeApp(router) {
  const a = express();
  a.use(express.json());
  a.use("/api/admin", router);

  // error handler
  a.use((err, req, res, next) => {
    res
      .status(500)
      .json({ error: "server_error", detail: String(err?.message || err) });
  });

  return a;
}

async function seedAdminCtx({
  uid = "u_admin",
  email = "admin@test.local",
} = {}) {
  realAuth.auth.verify.mockResolvedValue({ uid, email });

  // resolveUserFromSession first tries db.user.get(session.uid)
  realDb.db.user.get.mockImplementation(async (id) => {
    if (id === uid) return { uid, email, userType: "admin" };
    return null;
  });

  realDb.db.user.findByEmail.mockResolvedValue(null);
}

beforeAll(async () => {
  adminRoutes = (await import("../routes/admin.routes.js")).default;
  app = makeApp(adminRoutes);
});

beforeEach(async () => {
  jest.clearAllMocks();
  await seedAdminCtx();

  realDb.db.user.list.mockResolvedValue([]);
  realDb.db.job.list.mockResolvedValue([]);
  realDb.db.bid.list.mockResolvedValue([]);
});

describe("admin.routes (prototype=false) smoke suite", () => {
  test("401 unauthorized when auth.verify returns null", async () => {
    realAuth.auth.verify.mockResolvedValue(null);

    const res = await request(app).get("/api/admin/users");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "unauthorized" });
  });

  test("403 admin_only when resolved user is not admin", async () => {
    realDb.db.user.get.mockResolvedValueOnce({
      uid: "u_admin",
      email: "admin@test.local",
      userType: "bidder",
    });

    const res = await request(app).get("/api/admin/users");
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "admin_only" });
  });

  test("GET /users returns sanitized users (no passwordHash)", async () => {
    realDb.db.user.list.mockResolvedValueOnce([
      {
        uid: "u1",
        email: "u1@test.local",
        userType: "bidder",
        passwordHash: "secret",
      },
    ]);

    const res = await request(app).get("/api/admin/users").expect(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0]).toMatchObject({
      uid: "u1",
      email: "u1@test.local",
      userType: "bidder",
    });
    expect(res.body.users[0].passwordHash).toBeUndefined();
  });

  test("PATCH /users/:uid 400 invalid_fields (bad email)", async () => {
    // requireAdmin resolves admin (session uid)
    realDb.db.user.get.mockResolvedValueOnce({
      uid: "u_admin",
      userType: "admin",
    });
    // route loads existing target
    realDb.db.user.get.mockResolvedValueOnce({
      uid: "u1",
      userType: "bidder",
      email: "u1@test.local",
    });

    const res = await request(app)
      .patch("/api/admin/users/u1")
      .send({ email: "not-email" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_fields");
    expect(res.body.fields).toMatchObject({ email: "must_be_valid_email" });
    expect(realDb.db.user.update).not.toHaveBeenCalled();
  });

  test("DELETE /users/:uid 409 cannot_delete_self", async () => {
    realAuth.auth.verify.mockResolvedValue({ uid: "u_admin" });
    realDb.db.user.get.mockResolvedValueOnce({
      uid: "u_admin",
      userType: "admin",
    });

    const res = await request(app).delete("/api/admin/users/u_admin");
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "cannot_delete_self" });
  });

  test("GET /bids returns sorted bids (newest first)", async () => {
    realDb.db.bid.list.mockResolvedValueOnce([
      { id: "b_old", bidCreatedAt: "2026-02-01T00:00:00.000Z" },
      { id: "b_new", bidCreatedAt: "2026-02-10T00:00:00.000Z" },
      { id: "b_mid", createdAt: "2026-02-05T00:00:00.000Z" },
    ]);

    const res = await request(app).get("/api/admin/bids").expect(200);
    expect(res.body.bids.map((b) => b.id)).toEqual(["b_new", "b_mid", "b_old"]);
  });

  test("GET /jobs returns 200 (wiring smoke)", async () => {
    realDb.db.job.list.mockResolvedValueOnce([{ id: "j1", title: "Job One" }]);

    const res = await request(app).get("/api/admin/jobs").expect(200);
    expect(Array.isArray(res.body.jobs)).toBe(true);
    expect(res.body.jobs[0]).toMatchObject({ id: "j1", title: "Job One" });
  });
});
