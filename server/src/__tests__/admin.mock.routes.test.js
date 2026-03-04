import request from "supertest";
import express from "express";

// --- PROTOTYPE MODE ON ---
jest.mock("../config.js", () => ({
  config: { PROTOTYPE: true, prototype: true },
}));

// bypass requireRole("admin") so we test admin.routes logic (requireAdmin) directly
jest.mock("../middleware/requireRole.js", () => ({
  requireRole: () => (req, res, next) => next(),
}));

jest.mock("../adapters/auth.mock.js", () => ({
  auth: { verify: jest.fn() },
}));

jest.mock("../adapters/db.mock.js", () => ({
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

// real adapters should never be used in prototype tests, but mock them anyway
jest.mock("../adapters/auth.real.js", () => ({
  auth: { verify: jest.fn() },
}));
jest.mock("../adapters/db.real.js", () => ({
  db: {},
}));

// Firestore should not be called in prototype mode fallback paths (they return 501)
jest.mock("../lib/firebase.js", () => ({
  getDb: jest.fn(() => {
    throw new Error("getDb should not be called in prototype mode tests");
  }),
}));

const mockAuth = require("../adapters/auth.mock.js");
const mockDb = require("../adapters/db.mock.js");

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
  mockAuth.auth.verify.mockResolvedValue({ uid, email });

  // resolveUserFromSession first tries db.user.get(session.uid)
  mockDb.db.user.get.mockImplementation(async (id) => {
    if (id === uid) return { uid, email, userType: "admin" };
    return null;
  });

  mockDb.db.user.findByEmail.mockResolvedValue(null);
}

beforeAll(async () => {
  adminRoutes = (await import("../routes/admin.routes.js")).default;
  app = makeApp(adminRoutes);
});

beforeEach(async () => {
  jest.clearAllMocks();
  await seedAdminCtx();

  mockDb.db.user.list.mockResolvedValue([]);
  mockDb.db.job.list.mockResolvedValue([]);
  mockDb.db.bid.list.mockResolvedValue([]);
});

describe("admin.routes (prototype=true)", () => {
  test("401 unauthorized when auth.verify returns null", async () => {
    mockAuth.auth.verify.mockResolvedValue(null);

    const res = await request(app).get("/api/admin/users");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "unauthorized" });
  });

  test("404 user_not_found when session doesn't map to a user", async () => {
    mockDb.db.user.get.mockResolvedValue(null);
    mockDb.db.user.findByEmail.mockResolvedValue(null);

    const res = await request(app).get("/api/admin/users");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "user_not_found" });
  });

  test("403 admin_only when resolved user is not admin", async () => {
    mockDb.db.user.get.mockResolvedValueOnce({
      uid: "u_admin",
      email: "admin@test.local",
      userType: "bidder",
    });

    const res = await request(app).get("/api/admin/users");
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "admin_only" });
  });

  test("GET /users returns sanitized users (no passwordHash)", async () => {
    mockDb.db.user.list.mockResolvedValueOnce([
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
    mockDb.db.user.get.mockResolvedValueOnce({
      uid: "u_admin",
      userType: "admin",
    });
    // route loads existing target
    mockDb.db.user.get.mockResolvedValueOnce({
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
    expect(mockDb.db.user.update).not.toHaveBeenCalled();
  });

  test("DELETE /users/:uid 409 cannot_delete_self", async () => {
    mockAuth.auth.verify.mockResolvedValue({ uid: "u_admin" });
    mockDb.db.user.get.mockResolvedValueOnce({
      uid: "u_admin",
      userType: "admin",
    });

    const res = await request(app).delete("/api/admin/users/u_admin");
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "cannot_delete_self" });
  });

  test("GET /bids returns sorted bids (newest first)", async () => {
    mockDb.db.bid.list.mockResolvedValueOnce([
      { id: "b_old", bidCreatedAt: "2026-02-01T00:00:00.000Z" },
      { id: "b_new", bidCreatedAt: "2026-02-10T00:00:00.000Z" },
      { id: "b_mid", createdAt: "2026-02-05T00:00:00.000Z" },
    ]);

    const res = await request(app).get("/api/admin/bids").expect(200);
    expect(res.body.bids.map((b) => b.id)).toEqual(["b_new", "b_mid", "b_old"]);
  });

  test("Prototype mode: GET /bids returns 200 with bids", async () => {
    const res = await request(app)
      .get("/api/admin/bids")
      .set("x-mock-uid", "u_admin");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.bids)).toBe(true);
  });
});
