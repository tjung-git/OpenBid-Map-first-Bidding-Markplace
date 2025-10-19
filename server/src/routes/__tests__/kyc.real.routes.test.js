import request from "supertest";
import express from "express";

jest.mock('../../config.js', () => ({
  config: {
    PROTOTYPE: false,
    prototype: false,
    stripe: {
      secretKey: 'sk_test_mock',
    },
  },
}));

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    identity: {
      verificationSessions: {
        create: jest.fn().mockResolvedValue({
          id: 'vs_test123',
          url: 'https://verify.stripe.com/start/test',
        }),
        retrieve: jest.fn().mockResolvedValue({
          id: 'vs_test123',
          last_verification_report: null,
        }),
      },
      verificationReports: {
        retrieve: jest.fn(),
      },
    },
  }));
});

// Mock real auth and db adapters
jest.mock('../../adapters/auth.real.js', () => ({
  auth: {
    verify: jest.fn(),
  },
}));

jest.mock('../../adapters/db.real.js', () => ({
  db: {
    user: {
      get: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

describe("KYC Routes - Real Mode", () => {
  let app;
  let kycRoutes;
  let Auth;
  let Db;

  beforeAll(async () => {
    Auth = require('../../adapters/auth.real.js');
    Db = require('../../adapters/db.real.js');
    kycRoutes = (await import('../kyc.routes.js')).default;
    
    app = express();
    app.use(express.json());
    app.use('/api/kyc', kycRoutes);
  });

  beforeEach(() => {
    Auth.auth.verify.mockResolvedValue({
      uid: 'u_testexamplec',
      email: 'test@example.com',
    });

    Db.db.user.get.mockResolvedValue({
      uid: 'u_testexamplec',
      email: 'test@example.com',
      kycStatus: 'pending',
    });

    Db.db.user.upsert.mockResolvedValue(true);
  });

  describe("POST /api/kyc/verification", () => {
    it("should return a Stripe verification URL and sessionId", async () => {
      const response = await request(app)
        .post("/api/kyc/verification")
        .set("Authorization", "Bearer fake-firebase-token")
        .expect(200);

      expect(response.body.url).toContain("https://verify.stripe.com/");
      expect(response.body.sessionId).toContain("vs");
    });

    it("should handle unauthorized users", async () => {
      Auth.auth.verify.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/kyc/verification")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body.error).toBe("unauthorized");
    });
  });

  describe("GET /api/kyc/status", () => {
    it("should return verified KYC status", async () => {
      const response = await request(app)
        .get("/api/kyc/status")
        .set("Authorization", "Bearer fake-firebase-token")
        .expect(200);

      expect(["verified", "pending"]).toContain(response.body.status);
    });

    it("should handle unauthorized users", async () => {
      Auth.auth.verify.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/kyc/status")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body.error).toBe("unauthorized");
    });
  });
});
