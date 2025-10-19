import Stripe from 'stripe';
import { config } from '../config.js';

const stripe = new Stripe(config.stripe.secretKey);

// Create a factory function that accepts a database adapter
export const createRealKyc = (dbAdapter) => ({
  async verification(uid) {
    const user = await dbAdapter.user.get(uid);
    if (!user) {
      throw new Error('User not found');
    }

    const verificationSession = await stripe.identity.verificationSessions.create({
      type: 'document',
      provided_details: {
        email: user.email,
      },
      metadata: {
        user_id: uid,
      },
    });

    // Store `verification_session_id` in database for later status checking
    await dbAdapter.user.upsert({
      ...user,
      kycSessionId: verificationSession.id
    });

    return {
      url: verificationSession.url,
      sessionId: verificationSession.id
    };
  },

  async status(uid) {
    const user = await dbAdapter.user.get(uid);
    if (!user) {
      return { status: 'pending' };
    }
    if (user.kycStatus === 'verified') {
      return { status: 'verified' };
    }

    // If no session ever created - return pending
    if (!user.kycSessionId) {
      return { status: 'pending' };
    }

    // Check verification report using `verification_session_id` with Stripe
    try {
      const session = await stripe.identity.verificationSessions.retrieve(user.kycSessionId);
      const reportId = session?.last_verification_report;
      let status = 'pending';

      if (reportId) {
        const report = await stripe.identity.verificationReports.retrieve(reportId);
        const verified = report?.document?.status === 'verified';
        const failed = report?.document?.status === 'unverified' || report?.document?.status === 'rejected';

        if (verified) {
          status = 'verified';
          await dbAdapter.user.upsert({
            ...user,
            kycStatus: 'verified'
          });
        } else if (failed) {
          status = 'failed';
          await dbAdapter.user.upsert({
            ...user,
            kycStatus: 'failed'
          });
        } else {
          status = 'pending';
        }
      }

      return { status };
    } catch (error) {
      console.error('Error checking KYC report:', error);
      return { status: 'pending' };
    }
  },
});
