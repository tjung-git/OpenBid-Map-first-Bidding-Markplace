import { db as mockDb } from "../src/adapters/db.mock.js";
import { config } from "../src/config.js";

export async function seedUser({
  uid,
  email,
  firstName = "T",
  lastName = "User",
  kycStatus = "verified",
  emailVerification = "verified",
  userType = "bidder",
  passwordHash = "$2a$10$abcdefghiJKLmnopqrstuvwxyzABCDEuv",
}) {
  if (!config.prototype) {
    throw new Error("Tests expect PROTOTYPE=TRUE");
  }
  const now = new Date().toISOString();
  const user = {
    uid,
    firstName,
    lastName,
    email,
    userType,
    kycStatus,
    emailVerification,
    kycSessionId: null,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  };
  const existing = await mockDb.user.findByEmail(email);
  if (existing) {
    await mockDb.user.update(existing.uid, user);
    return { ...existing, ...user };
  }
  return mockDb.user.create(user);
}

export function mockAuthHeaders(uid) {
  return { "x-mock-uid": uid };
}
