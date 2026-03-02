import Stripe from 'stripe';
import { config } from '../config.js';

const stripe = new Stripe(config.stripe.secretKey);

// Create a factory function that accepts a database adapter
export const createRealKyc = (dbAdapter) => ({
  async verification(uid) {
    console.log('KYC verification initiated for user:', uid);
    const user = await dbAdapter.user.get(uid);
    if (!user) {
      console.error('User not found for KYC verification:', uid);
      throw new Error('User not found');
    }

    console.log('Creating Stripe verification session for user:', uid, 'email:', user.email);
    let verificationSession;
    try {
      verificationSession = await stripe.identity.verificationSessions.create({
        type: 'document',
        provided_details: {
          email: user.email,
        },
        metadata: {
          user_id: uid,
        },
      });
      console.log('Stripe verification session created successfully:', verificationSession.id);
    } catch (error) {
      console.error('Failed to create Stripe verification session:', error);
      throw new Error(`Failed to create verification session: ${error.message}`);
    }

    // Store `verification_session_id` in database for later status checking
    console.log('Storing verification session ID in database:', verificationSession.id);
    await dbAdapter.user.upsert({
      ...user,
      kycSessionId: verificationSession.id
    });

    console.log('KYC verification session ready, returning URL and session ID');
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
