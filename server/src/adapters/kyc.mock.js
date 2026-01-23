const kycStatus = new Map(); // uid maps to 'pending'|'verified'|'failed'

export const kyc = {
  async verification(uid) {
    const sessionId = `mock_session_${uid}_${Date.now()}`;
    kycStatus.set(uid, "pending");
    return {
      url: `https://mock-kyc.local/session/${sessionId}`,
      sessionId: sessionId
    };
  },
  async status(uid) {
    return { status: kycStatus.get(uid) || "pending" };
  },
  async forcePass(uid) {
    kycStatus.set(uid, "verified");
    return { ok: true };
  },
};
