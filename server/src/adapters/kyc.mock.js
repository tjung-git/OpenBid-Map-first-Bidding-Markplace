const kycStatus = new Map(); // uid -> 'pending'|'verified'|'failed'

export const kyc = {
  async start(uid) {
    kycStatus.set(uid, "pending");
    // return a pretend URL the client would "visit"
    return { url: `https://mock-kyc.local/session/${uid}` };
  },
  async status(uid) {
    return { status: kycStatus.get(uid) || "pending" };
  },
  async forcePass(uid) {
    kycStatus.set(uid, "verified");
    return { ok: true };
  },
};
