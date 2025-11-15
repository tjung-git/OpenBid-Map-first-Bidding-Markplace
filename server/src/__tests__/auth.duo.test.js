const request = require("supertest");

jest.mock("bcryptjs", () => ({
  compare: jest.fn(async () => true),
  default: { compare: jest.fn(async () => true) },
}));

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  auth: () => ({ createCustomToken: async () => "tok_test" }),
}));

jest.mock("@duosecurity/duo_universal", () => {
  const Client = jest.fn().mockImplementation(() => ({
    generateState() {
      return "duo_state_mock";
    },
    async createAuthUrl(username, state) {
      return `https://duo.example/auth?state=${state}&user=${encodeURIComponent(
        username
      )}`;
    },
    async exchangeAuthorizationCodeFor2FAResult(code, username) {
      if (String(code).startsWith("allow")) {
        return {
          iss: "https://duo.example/oauth/v1/token",
          sub: username,
          auth_result: {
            result: "allow",
            status: "allow",
            status_msg: "Login Successful",
          },
          preferred_username: username,
        };
      }
      return {
        iss: "https://duo.example/oauth/v1/token",
        sub: username,
        auth_result: {
          result: "deny",
          status: "deny",
          status_msg: "Denied",
        },
        preferred_username: username,
      };
    },
  }));
  return { Client };
});

let seedUser;
let makeTestApp;
let app;

beforeAll(async () => {
  ({ seedUser } = await import("./helpers.js"));
  ({ makeTestApp } = await import("./appfactory.js"));
  app = makeTestApp();

  await seedUser({
    uid: "u_duotest",
    email: "duo@test.local",
    kycStatus: "verified",
    emailVerification: "verified",
    duoEnabled: true,
  });
});

describe("TC-008: Duo 2FA challenge during login (login-only flow)", () => {
  const email = "duo@test.local";

  test("returns 202 with mfa.startUrl, then finalize returns session JSON", async () => {
    // 1) Begin login → server responds with Duo start URL
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "whatever" })
      .expect(202);

    expect(res.body?.mfa?.provider).toBe("duo");
    expect(res.body?.mfa?.startUrl).toMatch(/\/api\/auth\/duo\/start\?state=/);

    const startUrl = res.body.mfa.startUrl;
    const url = new URL(`http://localhost${startUrl}`);
    const state = url.searchParams.get("state");
    expect(state).toBeTruthy();

    const allowCode = "allow-123";
    const cb = await request(app)
      .get(`/api/auth/duo/callback?state=${state}&code=${allowCode}`)
      .expect(302);

    const loc = cb.headers.location;
    expect(loc).toMatch(/\/login\?code=/);

    const otc = new URL(loc).searchParams.get("code");
    expect(otc).toBeTruthy();

    const fin = await request(app)
      .post("/api/auth/duo/finalize")
      .send({ code: otc })
      .expect(200);

    expect(fin.body?.user?.email).toBe(email);
    expect(fin.body?.session).toBeDefined();
    expect(fin.body?.requirements?.kycVerified).toBe(true);
  });

  test("denied Duo returns 302 to /login?mfa=denied", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "whatever" })
      .expect(202);

    const state = new URL(`http://localhost${res.body.mfa.startUrl}`)
      .searchParams.get("state");

    const deny = await request(app)
      .get(`/api/auth/duo/callback?state=${state}&code=deny-xyz`)
      .expect(302);

    expect(deny.headers.location).toMatch(/\/login\?mfa=denied/);
  });
});
