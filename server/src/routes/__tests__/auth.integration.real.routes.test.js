import request from "supertest";
import {
  createRealApp,
  preserveRealEnv,
  setupJaneDoe,
} from "./testUtils.js";

preserveRealEnv();

// Integration tests for auth routes when real adapters (Firebase-backed) are selected.
describe("auth routes (real adapters)", () => {
  test("POST /api/auth/signup provisions Jane Doe and schedules verification email", async () => {
    // In real mode Jane signs up, Firebase mocks trigger, and she ends up pending verification.
    const { app, mocks } = await createRealApp({ auth: true });

    const response = await request(app).post("/api/auth/signup").send({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane.doe@example.com",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(response.status).toBe(201);
    expect(mocks.signUpWithEmailPasswordMock).toHaveBeenCalledWith(
      "jane.doe@example.com",
      "password123"
    );
    expect(mocks.sendVerificationEmailMock).toHaveBeenCalledWith(
      "firebase_signup_token"
    );
    expect(mocks.deleteAccountMock).not.toHaveBeenCalled();
    expect(response.body.user).toMatchObject({
      uid: "firebase_jane_uid",
      email: "jane.doe@example.com",
      firstName: "Jane",
      lastName: "Doe",
      userType: "bidder",
      emailVerification: "pending",
      kycStatus: "pending",
    });
    expect(response.body.user).not.toHaveProperty("passwordHash");
  });

  test("POST /api/auth/signup rejects invalid email format for Jane Doe", async () => {
    // Invalid email should be rejected before calling Firebase signup.
    const { app, mocks } = await createRealApp({ auth: true });

    const response = await request(app).post("/api/auth/signup").send({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane.doe-at-example.com",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "email must be a valid address" });
    expect(mocks.signUpWithEmailPasswordMock).not.toHaveBeenCalled();
  });

  test("POST /api/auth/signup enforces 8 character password minimum", async () => {
    // Short passwords should be rejected immediately.
    const { app, mocks } = await createRealApp({ auth: true });

    const response = await request(app).post("/api/auth/signup").send({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane.doe@example.com",
      password: "short",
      confirmPassword: "short",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "password must be at least 8 characters",
    });
    expect(mocks.signUpWithEmailPasswordMock).not.toHaveBeenCalled();
  });

  test("POST /api/auth/signup requires matching password confirmation", async () => {
    // When confirmPassword does not match we return 400 before hitting Firebase.
    const { app, mocks } = await createRealApp({ auth: true });

    const response = await request(app).post("/api/auth/signup").send({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane.doe@example.com",
      password: "password123",
      confirmPassword: "password124",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "passwords must match" });
    expect(mocks.signUpWithEmailPasswordMock).not.toHaveBeenCalled();
  });

  test("POST /api/auth/signup requires first and last name", async () => {
    // Missing either name results in a 400 error.
    const { app, mocks } = await createRealApp({ auth: true });

    const response = await request(app).post("/api/auth/signup").send({
      firstName: "Jane",
      email: "jane.doe@example.com",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "firstName and lastName required" });
    expect(mocks.signUpWithEmailPasswordMock).not.toHaveBeenCalled();
  });

  test("POST /api/auth/login returns session details for verified Jane Doe", async () => {
    // After verifying Jane's account she should be able to log in and get a Firebase session.
    const { app, db, mocks } = await createRealApp({ auth: true });
    const jane = await setupJaneDoe({ app });
    await db.user.update(jane.uid, {
      emailVerification: "verified",
      kycStatus: "verified",
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "jane.doe@example.com",
      password: "password123",
    });

    expect(response.status).toBe(200);
    expect(mocks.authSignInMock).toHaveBeenCalledWith(
      "jane.doe@example.com",
      "password123"
    );
    expect(response.body.user).toMatchObject({
      uid: jane.uid,
      email: "jane.doe@example.com",
      userType: "bidder",
      emailVerification: "verified",
      kycStatus: "verified",
    });
    expect(response.body.session).toMatchObject({
      uid: jane.uid,
      email: "jane.doe@example.com",
      idToken: "firebase_login_token",
      refreshToken: "firebase_login_refresh",
    });
    expect(response.body.requirements).toEqual({
      emailVerified: true,
      kycVerified: true,
    });
  });

  test("PATCH /api/auth/role switches Jane Doe to contractor when authorized", async () => {
    // Jane can switch roles in real mode only when the auth header is present.
    const { app } = await createRealApp({ auth: true });
    const jane = await setupJaneDoe({ app });

    const unauthorized = await request(app)
      .patch("/api/auth/role")
      .send({ role: "contractor" });
    expect(unauthorized.status).toBe(401);

    const response = await request(app)
      .patch("/api/auth/role")
      .set("x-mock-uid", jane.uid)
      .send({ role: "contractor" });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      uid: jane.uid,
      userType: "contractor",
    });
  });

  test("GET /api/auth/me returns Jane Doe when mock session header is provided", async () => {
    // With the mocked session header we should get Jane's sanitized profile.
    const { app } = await createRealApp({ auth: true });
    const jane = await setupJaneDoe({ app, role: "contractor" });

    const unauthorized = await request(app).get("/api/auth/me");
    expect(unauthorized.status).toBe(401);

    const response = await request(app)
      .get("/api/auth/me")
      .set("x-mock-uid", jane.uid);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      prototype: false,
      user: {
        uid: jane.uid,
        email: "jane.doe@example.com",
        userType: "contractor",
      },
    });
    expect(response.body.user).not.toHaveProperty("passwordHash");
  });

  test("POST /api/auth/signup rejects duplicate email for Jane Doe", async () => {
    // Trying to sign Jane up twice in real mode still returns a conflict.
    const { app } = await createRealApp({ auth: true });
    await setupJaneDoe({ app });

    const response = await request(app).post("/api/auth/signup").send({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane.doe@example.com",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "email already registered" });
  });

  test("POST /api/auth/login rejects Jane Doe with wrong password", async () => {
    // Wrong credentials bubble up the Firebase identity error and we return 401.
    const { app, db, mocks } = await createRealApp({ auth: true });
    const jane = await setupJaneDoe({ app });
    await db.user.update(jane.uid, {
      emailVerification: "verified",
      kycStatus: "verified",
    });

    mocks.authSignInMock.mockRejectedValue(
      new mocks.FirebaseIdentityError("INVALID_PASSWORD", 400, "INVALID_PASSWORD")
    );

    const response = await request(app).post("/api/auth/login").send({
      email: "jane.doe@example.com",
      password: "wrong-password",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "invalid credentials" });
  });

  test("POST /api/auth/email-verify marks Jane Doe as verified", async () => {
    // Hitting the email verify endpoint should flip the stored status to verified.
    const { app } = await createRealApp({ auth: true });
    await setupJaneDoe({ app });

    const response = await request(app)
      .post("/api/auth/email-verify")
      .send({ email: "jane.doe@example.com" });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      email: "jane.doe@example.com",
      emailVerification: "verified",
    });
  });

  test("POST /api/auth/email-verify returns 404 when Jane Doe is missing", async () => {
    // Asking to verify an email that isn't registered still returns 404.
    const { app } = await createRealApp({ auth: true });

    const response = await request(app)
      .post("/api/auth/email-verify")
      .send({ email: "jane.doe@example.com" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "user not found" });
  });

  test("POST /api/auth/email-verify requires an email payload", async () => {
    // An empty payload is rejected with a 400 error.
    const { app } = await createRealApp({ auth: true });

    const response = await request(app)
      .post("/api/auth/email-verify")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "email required" });
  });
});
