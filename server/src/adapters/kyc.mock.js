const kycStatus = new Map(); // uid -> 'pending'|'verified'|'failed'

export const kyc = {
  async kycVerification(uid) {
    kycStatus.set(uid, "pending");
    // return a pretend URL the client would "visit"
    return { url: `https://mock-kyc.local/session/${uid}` };
  },
  async kycStatus(uid) {
    return { status: kycStatus.get(uid) || "pending" };
  },
  async kycForcePass(uid) {
    kycStatus.set(uid, "verified");
    return { ok: true };
  },
};
