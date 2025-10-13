import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY_FOR_TESTIN);

export const kyc = {
  async kycVerification(uid) {
    const verificationSession = await stripe.identity.verificationSessions.create({
      type: 'document',
      provided_details: {
        email: '{email}',
      },
      metadata: {
        user_id: '{uid}',
      },
    });

    return {
      url: verificationSession.url,
      sessionId: verificationSession.id
    };
  },

  async kycStatus(uid) {
    // implement caching
    return { status: "pending" };
  },
};
