export const payments = {
  async createEscrowIntent({ jobId, amount }) {
    return { clientSecret: `mock_cs_${jobId}_${amount}` };
  },
  async capture({ jobId }) {
    return { ok: true };
  },
  async refund({ jobId }) {
    return { ok: true };
  },
};
