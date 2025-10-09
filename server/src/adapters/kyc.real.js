export const kyc = {
  async start(uid) {
    /* start Stripe Identity verification */ return {
      url: "https://verify.stripe.com/...",
    };
  },
  async status(uid) {
    return { status: "pending" };
  },
};
