import express from "express";
import request from "supertest";

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  (value.constructor === Object || value.constructor === undefined);

const isServerTimestamp = (value) =>
  value &&
  typeof value === "object" &&
  value.constructor &&
  value.constructor.name === "ServerTimestampTransform";

const normalizeValue = (value) => {
  if (isServerTimestamp(value)) {
    return new Date().toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeValue(entry)])
    );
  }
  return value;
};

class InMemoryDocumentSnapshot {
  constructor(ref, data) {
    this.ref = ref;
    this._data = data;
  }

  get id() {
    return this.ref.id;
  }

  get exists() {
    return this._data !== undefined;
  }

  data() {
    return this._data === undefined
      ? undefined
      : JSON.parse(JSON.stringify(this._data));
  }
}

class InMemoryDocRef {
  constructor(firestore, collectionName, id) {
    this.firestore = firestore;
    this.collectionName = collectionName;
    this.id = id;
  }

  async get() {
    const store = this.firestore._ensureCollection(this.collectionName);
    const record = store.get(this.id);
    const data =
      record === undefined
        ? undefined
        : JSON.parse(JSON.stringify(record));
    return new InMemoryDocumentSnapshot(this, data);
  }

  async set(data, options = {}) {
    const store = this.firestore._ensureCollection(this.collectionName);
    const normalized = this.firestore._normalizeData(data);
    if (options.merge && store.has(this.id)) {
      const existing = store.get(this.id) || {};
      store.set(this.id, { ...existing, ...normalized });
    } else {
      store.set(this.id, normalized);
    }
  }

  async update(data) {
    const store = this.firestore._ensureCollection(this.collectionName);
    if (!store.has(this.id)) {
      throw new Error("not-found");
    }
    const normalized = this.firestore._normalizeData(data);
    const existing = store.get(this.id) || {};
    store.set(this.id, { ...existing, ...normalized });
  }

  async delete() {
    const store = this.firestore._ensureCollection(this.collectionName);
    store.delete(this.id);
  }
}

class InMemoryQuerySnapshot {
  constructor(docs) {
    this.docs = docs;
  }

  get empty() {
    return this.docs.length === 0;
  }

  get size() {
    return this.docs.length;
  }
}

const compareValues = (a, b) => {
  if (a === b) return 0;
  if (a === undefined) return -1;
  if (b === undefined) return 1;
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return String(a).localeCompare(String(b));
};

class InMemoryQuery {
  constructor(firestore, collectionName, options = {}) {
    this.firestore = firestore;
    this.collectionName = collectionName;
    this._filters = options.filters || [];
    this._orderBy = options.orderBy || null;
    this._limit = options.limit ?? null;
  }

  where(field, op, value) {
    if (op !== "==") {
      throw new Error(`Unsupported operator "${op}" in InMemoryFirestore`);
    }
    return new InMemoryQuery(this.firestore, this.collectionName, {
      filters: [...this._filters, { field, value }],
      orderBy: this._orderBy,
      limit: this._limit,
    });
  }

  orderBy(field, direction = "asc") {
    return new InMemoryQuery(this.firestore, this.collectionName, {
      filters: [...this._filters],
      orderBy: {
        field,
        direction: direction.toLowerCase() === "desc" ? "desc" : "asc",
      },
      limit: this._limit,
    });
  }

  limit(count) {
    return new InMemoryQuery(this.firestore, this.collectionName, {
      filters: [...this._filters],
      orderBy: this._orderBy,
      limit: Number.isFinite(count) ? count : null,
    });
  }

  async get() {
    const store = this.firestore._ensureCollection(this.collectionName);
    let entries = Array.from(store.entries());

    if (this._filters.length > 0) {
      entries = entries.filter(([_, data]) =>
        this._filters.every(({ field, value }) => data[field] === value)
      );
    }

    if (this._orderBy) {
      const { field, direction } = this._orderBy;
      entries.sort(([, a], [, b]) => {
        const comparison = compareValues(a[field], b[field]);
        return direction === "desc" ? -comparison : comparison;
      });
    }

    if (this._limit !== null) {
      entries = entries.slice(0, this._limit);
    }

    const docs = entries.map(([id, data]) =>
      this.firestore._createDocumentSnapshot(this.collectionName, id, data)
    );
    return new InMemoryQuerySnapshot(docs);
  }
}

class InMemoryCollection {
  constructor(firestore, name) {
    this.firestore = firestore;
    this.name = name;
  }

  doc(id) {
    const docId =
      id !== undefined && id !== null ? String(id) : this.firestore._generateId();
    return new InMemoryDocRef(this.firestore, this.name, docId);
  }

  async add(data) {
    const docRef = this.doc();
    await docRef.set(data);
    return docRef;
  }

  where(field, op, value) {
    return new InMemoryQuery(this.firestore, this.name).where(field, op, value);
  }

  orderBy(field, direction) {
    return new InMemoryQuery(this.firestore, this.name).orderBy(field, direction);
  }

  async get() {
    const store = this.firestore._ensureCollection(this.name);
    const docs = Array.from(store.entries()).map(([id, data]) =>
      this.firestore._createDocumentSnapshot(this.name, id, data)
    );
    return new InMemoryQuerySnapshot(docs);
  }
}

class InMemoryWriteBatch {
  constructor() {
    this._ops = [];
  }

  set(ref, data, options) {
    this._ops.push(() => ref.set(data, options));
    return this;
  }

  update(ref, data) {
    this._ops.push(() => ref.update(data));
    return this;
  }

  delete(ref) {
    this._ops.push(() => ref.delete());
    return this;
  }

  async commit() {
    for (const op of this._ops) {
      await op();
    }
  }
}

class InMemoryFirestore {
  constructor() {
    this._collections = new Map();
    this._counter = 0;
  }

  _generateId() {
    this._counter += 1;
    return `doc_${this._counter.toString(16)}`;
  }

  _ensureCollection(name) {
    if (!this._collections.has(name)) {
      this._collections.set(name, new Map());
    }
    return this._collections.get(name);
  }

  _normalizeData(data) {
    if (!isPlainObject(data)) {
      return normalizeValue(data);
    }
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = normalizeValue(value);
    }
    return result;
  }

  _createDocumentSnapshot(collectionName, id, data) {
    const cloned = data === undefined ? undefined : JSON.parse(JSON.stringify(data));
    const ref = new InMemoryDocRef(this, collectionName, id);
    return new InMemoryDocumentSnapshot(ref, cloned);
  }

  collection(name) {
    return new InMemoryCollection(this, name);
  }

  batch() {
    return new InMemoryWriteBatch();
  }
}

export function createInMemoryFirestore() {
  return new InMemoryFirestore();
}

/**
 * Creates an Express app wired with the requested prototype-mode routes.
 * @param {Object} options Route toggles.
 * @param {boolean} options.auth Include /api/auth routes.
 * @param {boolean} options.jobs Include /api/jobs routes.
 * @param {boolean} options.bids Include /api/bids routes.
 * @param {boolean} options.kyc Include /api/kyc routes.
 * @param {boolean} options.password Include /api/password routes.
 */
export async function createPrototypeApp({
  auth = false,
  jobs = false,
  bids = false,
  kyc = false,
  password = false,
} = {}) {
  jest.resetModules();
  process.env.PROTOTYPE = "TRUE";

  const app = express();
  app.use(express.json());

  if (auth) {
    const { default: authRoutes } = await import("../routes/auth.routes.js");
    app.use("/api/auth", authRoutes);
  }

  if (jobs) {
    const { default: jobsRoutes } = await import("../routes/jobs.routes.js");
    app.use("/api/jobs", jobsRoutes);
  }

  if (bids) {
    const { default: bidsRoutes } = await import("../routes/bids.routes.js");
    app.use("/api/bids", bidsRoutes);
  }

  if (kyc) {
    const { default: kycRoutes } = await import("../routes/kyc.routes.js");
    app.use("/api/kyc", kycRoutes);
  }

  if (password) {
    const { default: passwordRoutes } = await import("../routes/password.routes.js");
    app.use("/api/password", passwordRoutes);
  }

  return app;
}

// Register Jane Doe through the auth routes and optionally flip her role afterwards.
export async function setupJaneDoe({
  app,
  role = "bidder",
  password = "password123",
  email = "jane.doe@example.com",
} = {}) {
  if (!app) {
    throw new Error("setupJaneDoe requires an Express app with /api/auth mounted");
  }

  const signupPayload = {
    firstName: "Jane",
    lastName: "Doe",
    email,
    password,
    confirmPassword: password,
  };

  const response = await request(app).post("/api/auth/signup").send(signupPayload);

  if (response.status !== 201) {
    throw new Error(
      `Failed to create Jane Doe fixture: ${response.status} ${JSON.stringify(response.body)}`
    );
  }

  let user = response.body.user;

  if (role && role.toLowerCase() !== "bidder") {
    const roleResponse = await request(app)
      .patch("/api/auth/role")
      .set("x-mock-uid", user.uid)
      .send({ role });

    if (roleResponse.status !== 200) {
      throw new Error(
        `Failed to switch Jane Doe role: ${roleResponse.status} ${JSON.stringify(
          roleResponse.body
        )}`
      );
    }

    user = roleResponse.body.user;
  }

  return user;
}

export function preservePrototypeEnv() {
  const original = process.env.PROTOTYPE;
  afterEach(() => {
    if (original === undefined) {
      delete process.env.PROTOTYPE;
    } else {
      process.env.PROTOTYPE = original;
    }
  });
  return original;
}

export const REAL_ENV_KEYS = [
  "PROTOTYPE",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_WEB_API_KEY",
];

export function preserveRealEnv(keys = REAL_ENV_KEYS) {
  const snapshot = {};
  keys.forEach((key) => {
    if (process.env[key] !== undefined) {
      snapshot[key] = process.env[key];
    }
  });

  afterEach(() => {
    keys.forEach((key) => {
      if (snapshot[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = snapshot[key];
      }
    });
  });

  return snapshot;
}

export async function createRealApp({
  auth = false,
  jobs = false,
  bids = false,
  kyc = false,
  password = false,
  verifySession,
  identityOverrides = {},
} = {}) {
  jest.resetModules();
  process.env.PROTOTYPE = "FALSE";
  process.env.FIREBASE_PROJECT_ID =
    process.env.FIREBASE_PROJECT_ID || "openbid-test-project";
  process.env.FIREBASE_CLIENT_EMAIL =
    process.env.FIREBASE_CLIENT_EMAIL || "test-service-account@test.local";
  process.env.FIREBASE_PRIVATE_KEY =
    process.env.FIREBASE_PRIVATE_KEY ||
    "-----BEGIN PRIVATE KEY-----\\nFAKE\\n-----END PRIVATE KEY-----";
  process.env.FIREBASE_WEB_API_KEY =
    process.env.FIREBASE_WEB_API_KEY || "fake-web-api-key";

  const firestore = createInMemoryFirestore();

  const verifyMock =
    verifySession ||
    jest.fn(async (req) => {
      const mockUid = req.header("x-mock-uid");
      if (mockUid) {
        return { uid: mockUid, email: `${mockUid}@mock.local` };
      }
      const authHeader = req.header("Authorization") || "";
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match && match[1]) {
        const uid = match[1];
        return { uid, email: `${uid}@mock.local` };
      }
      return null;
    });

  const defaultSignUpReturn = {
    uid: "firebase_jane_uid",
    idToken: "firebase_signup_token",
    refreshToken: "firebase_signup_refresh",
  };
  const defaultSignInReturn = {
    idToken: "firebase_login_token",
    refreshToken: "firebase_login_refresh",
    expiresIn: "3600",
  };

  const signUpReturn = identityOverrides.signUpReturn
    ? { ...defaultSignUpReturn, ...identityOverrides.signUpReturn }
    : defaultSignUpReturn;
  const signInReturn = identityOverrides.signInReturn
    ? { ...defaultSignInReturn, ...identityOverrides.signInReturn }
    : defaultSignInReturn;

  const signUpWithEmailPasswordMock =
    identityOverrides.signUpWithEmailPasswordMock ||
    jest.fn(async () => ({ ...signUpReturn }));

  const signInWithEmailPasswordMock =
    identityOverrides.signInWithEmailPasswordMock ||
    jest.fn(async () => ({ ...signInReturn }));

  const sendVerificationEmailMock =
    identityOverrides.sendVerificationEmailMock || jest.fn(async () => undefined);

  const deleteAccountMock =
    identityOverrides.deleteAccountMock || jest.fn(async () => undefined);

  const authSignInMock =
    identityOverrides.authSignInMock ||
    jest.fn(async () => ({ ...signInReturn }));

  const firebaseAuthClient =
    identityOverrides.firebaseAuthClient || {
      getUser: jest.fn(async () => ({
        emailVerified: identityOverrides.emailVerified ?? false,
      })),
      verifyIdToken: jest.fn(async () => (
        identityOverrides.decodedToken || {
          uid: "firebase_jane_uid",
          email: "jane.doe@example.com",
        }
      )),
    };

  let FirebaseIdentityErrorClass;

  jest.doMock("../lib/firebaseIdentity.js", () => {
    const actual = jest.requireActual("../lib/firebaseIdentity.js");
    FirebaseIdentityErrorClass = actual.FirebaseIdentityError;
    return {
      __esModule: true,
      FirebaseIdentityError: actual.FirebaseIdentityError,
      signUpWithEmailPassword: signUpWithEmailPasswordMock,
      signInWithEmailPassword: signInWithEmailPasswordMock,
      sendVerificationEmail: sendVerificationEmailMock,
      deleteAccount: deleteAccountMock,
      sendPasswordResetEmail: actual.sendPasswordResetEmail,
    };
  });

  jest.doMock("../lib/firebase.js", () => {
    const actual = jest.requireActual("../lib/firebase.js");
    return {
      __esModule: true,
      ...actual,
      getDb: jest.fn(() => firestore),
      getAuthClient: jest.fn(() => firebaseAuthClient),
    };
  });

  jest.doMock("../adapters/auth.real.js", () => ({
    __esModule: true,
    auth: {
      signIn: authSignInMock,
      verify: verifyMock,
    },
  }));

  const { db } = await import("../adapters/db.real.js");

  const app = express();
  app.use(express.json());

  if (auth) {
    const { default: authRoutes } = await import("../routes/auth.routes.js");
    app.use("/api/auth", authRoutes);
  }

  if (jobs) {
    const { default: jobsRoutes } = await import("../routes/jobs.routes.js");
    app.use("/api/jobs", jobsRoutes);
  }

  if (bids) {
    const { default: bidsRoutes } = await import("../routes/bids.routes.js");
    app.use("/api/bids", bidsRoutes);
  }

  if (kyc) {
    const { default: kycRoutes } = await import("../routes/kyc.routes.js");
    app.use("/api/kyc", kycRoutes);
  }

  if (password) {
    const { default: passwordRoutes } = await import("../routes/password.routes.js");
    app.use("/api/password", passwordRoutes);
  }

  return {
    app,
    db,
    firestore,
    mocks: {
      verifyMock,
      signUpWithEmailPasswordMock,
      signInWithEmailPasswordMock,
      sendVerificationEmailMock,
      deleteAccountMock,
      authSignInMock,
      firebaseAuthClient,
      FirebaseIdentityError: FirebaseIdentityErrorClass,
    },
  };
}

export function buildUserPayload(overrides = {}) {
  const now = new Date().toISOString();
  return {
    uid: overrides.uid || `uid_${Math.random().toString(16).slice(2)}`,
    firstName: overrides.firstName || "Jane",
    lastName: overrides.lastName || "Doe",
    email: (overrides.email || "jane.doe@example.com").toLowerCase(),
    userType: overrides.userType || "contractor",
    emailVerification: overrides.emailVerification || "verified",
    kycStatus: overrides.kycStatus || "verified",
    passwordHash: overrides.passwordHash || "hashed_password",
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
    ...overrides,
  };
}

export async function seedRealUser(db, overrides = {}) {
  return db.user.create(buildUserPayload(overrides));
}

export async function publishJob(app, posterUid, overrides = {}) {
  const payload = {
    title: "Kitchen Remodel",
    description: "Full kitchen remodel project",
    budgetAmount: 25000,
    location: { lat: 37.7749, lng: -122.4194 },
    ...overrides,
  };

  const response = await request(app)
    .post("/api/jobs")
    .set("x-mock-uid", posterUid)
    .send(payload);

  if (response.status !== 200) {
    throw new Error(
      `Failed to publish job: ${response.status} ${JSON.stringify(response.body)}`
    );
  }

  return response.body.job;
}
