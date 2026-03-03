import Stripe from 'stripe';
import { config } from '../config.js';

const stripe = new Stripe(config.stripe.secretKey);

export const payments = {
  async createPaymentIntent({ jobId, bidId, amount, customerId }) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: 'cad',
        payment_method_types: ['card'],
        metadata: {
          jobId,
          bidId,
          customerId,
        },
        capture_method: 'manual',
        description: `Escrow payment for job ${jobId}`,
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      console.error('[payments.real] createPaymentIntent error:', error);
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  },

  async capture({ paymentIntentId }) {
    try {
      const intent = await stripe.paymentIntents.capture(paymentIntentId);
      return {
        ok: intent.status === 'succeeded',
        status: intent.status,
      };
    } catch (error) {
      console.error('[payments.real] capture error:', error);
      throw new Error(`Failed to capture payment: ${error.message}`);
    }
  },

  async refund({ paymentIntentId, amount }) {
    try {
      const refundParams = { payment_intent: paymentIntentId };
      if (amount) {
        refundParams.amount = Math.round(amount * 100);
      }

      const refund = await stripe.refunds.create(refundParams);
      return {
        ok: refund.status === 'succeeded',
        status: refund.status,
      };
    } catch (error) {
      console.error('[payments.real] refund error:', error);
      throw new Error(`Failed to refund payment: ${error.message}`);
    }
  },

  async cancel({ paymentIntentId }) {
    try {
      const intent = await stripe.paymentIntents.cancel(paymentIntentId);
      return { ok: intent.status === 'canceled' };
    } catch (error) {
      console.error('[payments.real] cancel error:', error);
      throw new Error(`Failed to cancel payment: ${error.message}`);
    }
  },

  async getStatus({ paymentIntentId }) {
    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return {
        status: intent.status,
        amount: intent.amount / 100,
      };
    } catch (error) {
      console.error('[payments.real] getStatus error:', error);
      throw new Error(`Failed to get payment status: ${error.message}`);
    }
  },
};

