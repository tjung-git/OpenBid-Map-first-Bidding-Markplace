import { db as mockDb } from "../../adapters/db.mock.js";
import { config } from "../../config.js";

export async function seedUser({
  uid,
  email,
  firstName = "T",
  lastName = "User",
  kycStatus = "verified",
  emailVerification = "verified",
  userType = "bidder",
  passwordHash = "$2a$10$abcdefghiJKLmnopqrstuvwxyzABCDEuv",
  duoEnabled = false,
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
    duoEnabled,
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
