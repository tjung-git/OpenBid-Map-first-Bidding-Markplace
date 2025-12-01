import request from 'supertest';
import express from 'express';
import kycRoutes from '../routes/kyc.routes.js';

// Mock config to set PROTOTYPE = true
jest.mock('../config.js', () => ({
  config: {
    PROTOTYPE: true,
    prototype: true,
    stripe: {
      secretKey: 'sk_test_mock',
    },
  },
}));

jest.mock('../adapters/auth.mock.js');
jest.mock('../adapters/kyc.mock.js');
jest.mock('../adapters/db.mock.js');

const mockAuth = require('../adapters/auth.mock.js');
const mockKyc = require('../adapters/kyc.mock.js');
const mockDb = require('../adapters/db.mock.js');

const app = express();
app.use(express.json());
app.use('/api/kyc', kycRoutes);

describe('KYC Routes', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockAuth.auth.verify.mockResolvedValue({ uid: 'test-user', email: 'test@example.com' });

    mockDb.db.user.get.mockResolvedValue({
      uid: 'test-user',
      email: 'test@example.com',
      kycStatus: 'pending'
    });

    mockDb.db.user.upsert.mockResolvedValue(true);
  });

  describe('POST /api/kyc/verification', () => {
    it('should return verification URL and session ID', async () => {
      mockKyc.kyc.verification.mockResolvedValueOnce({
        url: 'https://mock-kyc.local/session/mock_session_test-user_123456789',
        sessionId: 'mock_session_test-user_123456789'
      });

      const response = await request(app)
        .post('/api/kyc/verification')
        .set('x-mock-uid', 'test-user')
        .expect(200);

      expect(response.body.url).toContain('mock-kyc.local/session/');
      expect(response.body.sessionId).toContain('mock_session');
    });

    it('should handle unauthorized users', async () => {
      mockAuth.auth.verify.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/kyc/verification')
        .expect(401);

      expect(response.body.error).toBe('unauthorized');
    });
  });

  describe('GET /api/kyc/status', () => {
    it('should return KYC status', async () => {
      mockKyc.kyc.status.mockResolvedValue({ status: 'verified' });

      const response = await request(app)
        .get('/api/kyc/status')
        .set('x-mock-uid', 'test-user')
        .expect(200);

      expect(response.body.status).toBe('verified');
    });

    it('should handle unauthorized users', async () => {
      mockAuth.auth.verify.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/kyc/status')
        .expect(401);

      expect(response.body.error).toBe('unauthorized');
    });
  });

  describe('POST /api/kyc/force-pass', () => {
    it('should allow force-pass', async () => {
      mockKyc.kyc.forcePass.mockResolvedValue({ ok: true });

      const response = await request(app)
        .post('/api/kyc/force-pass')
        .set('x-mock-uid', 'test-user')
        .expect(200);

      expect(response.body.ok).toBe(true);
    });
  });
});