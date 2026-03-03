export const payments = {
  async createPaymentIntent({ jobId, bidId, amount, customerId }) {
    return {
      clientSecret: `mock_cs_${jobId}_${amount}`,
      paymentIntentId: `mock_pi_${jobId}_${bidId}`,
    };
  },

  async capture({ paymentIntentId }) {
    return {
      ok: true,
      status: 'succeeded',
    };
  },

  async refund({ paymentIntentId, amount }) {
    return {
      ok: true,
      status: 'succeeded',
    };
  },

  async cancel({ paymentIntentId }) {
    return { ok: true };
  },

  async getStatus({ paymentIntentId }) {
    return {
      status: 'requires_capture',
      amount: 100,
    };
  },
};

// Made with Bob
