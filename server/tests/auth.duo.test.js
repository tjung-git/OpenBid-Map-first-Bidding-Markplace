import request from 'supertest';
import { jest } from '@jest/globals';

// Make bcrypt checks always succeed so we reach Duo branch
jest.unstable_mockModule('bcryptjs', () => ({
  compare: jest.fn(async () => true),
  default: { compare: jest.fn(async () => true) },
}));

jest.unstable_mockModule('firebase-admin', () => ({
  initializeApp: () => {},
  auth: () => ({ createCustomToken: async () => 'tok_test' }),
}));

// Import helpers & app
const { seedUser } = await import('./helpers.js');
const { makeTestApp } = await import('./appfactory.js');

const app = makeTestApp();

describe('TC-008: Duo 2FA challenge during login (login-only flow)', () => {
  const email = 'duo@test.local';
  const uid = 'u_duotest';

  beforeAll(async () => {
    await seedUser({
      uid,
      email,
      kycStatus: 'verified',
      emailVerification: 'verified',
      duoEnabled: true,
    });
  });

  test('returns 202 with mfa.startUrl, then finalize returns session JSON', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'whatever' })
      .expect(202);

    expect(res.body?.mfa?.provider).toBe('duo');
    expect(res.body?.mfa?.startUrl).toMatch(/\/api\/auth\/duo\/start\?state=/);

    const startUrl = res.body.mfa.startUrl;
    const url = new URL(`http://localhost${startUrl}`);
    const state = url.searchParams.get('state');
    expect(state).toBeTruthy();

    // Simulate Duo approval -> your route should redirect with a one-time code
    const allowCode = 'allow-123';
    const cb = await request(app)
      .get(`/api/auth/duo/callback?state=${state}&code=${allowCode}`)
      .expect(302);

    const loc = cb.headers.location;
    expect(loc).toMatch(/login\/finish\?code=/);
    const otc = new URL(loc).searchParams.get('code');
    expect(otc).toBeTruthy();

    const fin = await request(app)
      .post('/api/auth/duo/finalize')
      .send({ code: otc })
      .expect(200);

    expect(fin.body?.user?.email).toBe(email);
    expect(fin.body?.session).toBeDefined();
    expect(fin.body?.requirements?.kycVerified).toBe(true);
  });

  test('denied Duo returns 302 to /login?mfa=denied', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'whatever' })
      .expect(202);

    const state = new URL(`http://localhost${res.body.mfa.startUrl}`)
      .searchParams.get('state');

    const deny = await request(app)
      .get(`/api/auth/duo/callback?state=${state}&code=deny-xyz`)
      .expect(302);

    expect(deny.headers.location).toMatch(/\/login\?mfa=denied/);
  });
});
