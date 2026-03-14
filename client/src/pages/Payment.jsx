import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button, InlineNotification, Loading } from "@carbon/react";
import { api } from "../services/api";
import { cfg } from "../services/config";
import "../styles/pages/payment.css";

const stripePromise = !cfg.prototype
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "")
  : null;

function MockPaymentForm({ jobId, bidId, amount }) {
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setProcessing(true);

    // Simulate payment processing
    setTimeout(() => {
      navigate(`/payment/success?jobId=${jobId}&bidId=${bidId}&payment_intent=mock_pi_${jobId}`);
    }, 1000);
  }

  return (
    <div className="payment-form-container">
      <div className="payment-header">
        <h2>Mock Payment (Prototype Mode)</h2>
        <p className="payment-amount">
          Amount: <strong>${amount.toFixed(2)} CAD</strong>
        </p>
      </div>

      <InlineNotification
        title="Prototype Mode"
        subtitle="This is a mock payment form for testing. No real payment will be processed."
        kind="info"
        lowContrast
        hideCloseButton
      />

      <form onSubmit={handleSubmit} className="payment-form">
        <div className="mock-payment-info">
          <p><strong>Mock Payment Details:</strong></p>
          <ul>
            <li>Job ID: {jobId}</li>
            <li>Bid ID: {bidId}</li>
            <li>Amount: ${amount.toFixed(2)} CAD</li>
          </ul>
        </div>

        <div className="payment-actions">
          <Button
            type="submit"
            disabled={processing}
            className="payment-submit-btn"
          >
            {processing ? "Processing..." : "Simulate Payment"}
          </Button>
          <Button
            kind="ghost"
            onClick={() => navigate(`/jobs/${jobId}`)}
            disabled={processing}
          >
            Cancel
          </Button>
        </div>
      </form>

      <div className="payment-info">
        <p>
          <strong>What happens next?</strong>
        </p>
        <ul>
          <li>Payment is simulated and marked as held</li>
          <li>The contractor is notified to begin work</li>
          <li>You confirm completion when the job is done</li>
          <li>Payment is released to the contractor</li>
        </ul>
      </div>
    </div>
  );
}

function PaymentForm({ jobId, bidId, amount }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements || !paymentReady) {
      console.error("Stripe payment form not ready");
      setError("Payment form is still loading. Please wait a moment and try again.");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      console.log("Confirming payment with Stripe...");

      const { error: submitError } = await elements.submit();
      if (submitError) {
        console.error("Payment element submit error:", submitError);
        setError(submitError.message || "Payment form is incomplete.");
        setProcessing(false);
        return;
      }

      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment/success?jobId=${jobId}&bidId=${bidId}`,
        },
        redirect: "if_required",
      });

      console.log("Stripe confirmPayment response:", {
        error: confirmError,
        paymentIntentId: paymentIntent?.id,
        status: paymentIntent?.status
      });

      if (confirmError) {
        console.error("Payment confirmation error:", confirmError);
        setError(confirmError.message);
        setProcessing(false);
      } else if (paymentIntent) {
        console.log("PaymentIntent status:", paymentIntent.status);
        if (paymentIntent.status === 'requires_capture') {
          // Payment successful and ready for capture (escrow)
          console.log("Payment successful, navigating to success page");
          navigate(`/payment/success?jobId=${jobId}&bidId=${bidId}&payment_intent=${paymentIntent.id}`);
        } else {
          console.error("Unexpected payment status:", paymentIntent.status);
          setError(`Payment not completed. Status: ${paymentIntent.status}. Please try again.`);
          setProcessing(false);
        }
      } else {
        console.error("No paymentIntent returned");
        setError("Payment processing failed. Please try again.");
        setProcessing(false);
      }
    } catch (err) {
      console.error("Payment exception:", err);
      setError("An unexpected error occurred. Please try again.");
      setProcessing(false);
    }
  }

  return (
    <div className="payment-form-container">
      <div className="payment-header">
        <h2>Secure Payment</h2>
        <p className="payment-amount">
          Amount: <strong>${amount.toFixed(2)} CAD</strong>
        </p>
      </div>

      <InlineNotification
        title="Escrow Protection"
        subtitle="Your payment will be held securely until the job is completed. The contractor will only receive payment after you confirm the work is done."
        kind="info"
        lowContrast
        hideCloseButton
      />

      {error && (
        <InlineNotification
          title="Payment Error"
          subtitle={error}
          kind="error"
          lowContrast
          onClose={() => setError("")}
        />
      )}

      <form onSubmit={handleSubmit} className="payment-form">
        <PaymentElement onReady={() => setPaymentReady(true)} />

        <div className="payment-actions">
          <Button
            type="submit"
            disabled={!stripe || !elements || !paymentReady || processing}
            className="payment-submit-btn"
          >
            {processing ? "Processing..." : "Pay & Secure Job"}
          </Button>
          <Button
            kind="ghost"
            onClick={() => navigate(`/jobs/${jobId}`)}
            disabled={processing}
          >
            Cancel
          </Button>
        </div>
      </form>

      <div className="payment-info">
        <p>
          <strong>What happens next?</strong>
        </p>
        <ul>
          <li>Your payment is held securely in escrow</li>
          <li>The contractor is notified to begin work</li>
          <li>You confirm completion when the job is done</li>
          <li>Payment is released to the contractor</li>
        </ul>
      </div>
    </div>
  );
}

export default function Payment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const jobId = searchParams.get("jobId");
  const bidId = searchParams.get("bidId");
  const amount = parseFloat(searchParams.get("amount") || "0");

  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!jobId || !bidId || !amount) {
      setError("Missing required payment information");
      setLoading(false);
      return;
    }

    async function createIntent() {
      try {
        const result = await api.createPaymentIntent({ jobId, bidId, amount });
        if (result.error) {
          // If payment already exists, redirect back to job page
          if (result.error === "payment_already_exists") {
            navigate(`/jobs/${jobId}`, {
              state: { message: "Payment has already been processed for this job." }
            });
            return;
          }
          setError(result.error);
        } else if (result.clientSecret) {
          setClientSecret(result.clientSecret);
        } else {
          setError("Failed to initialize payment");
        }
      } catch (err) {
        console.error("Failed to create payment intent:", err);
        setError("Failed to initialize payment. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    createIntent();
  }, [jobId, bidId, amount]);

  if (loading) {
    return (
      <div className="container payment-container">
        <Loading description="Initializing secure payment..." withOverlay={false} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container payment-container">
        <InlineNotification
          title="Payment Error"
          subtitle={error}
          kind="error"
          lowContrast
        />
        <Button onClick={() => navigate(`/jobs/${jobId}`)}>
          Return to Job
        </Button>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="container payment-container">
        <InlineNotification
          title="Payment Unavailable"
          subtitle="Unable to initialize payment at this time."
          kind="warning"
          lowContrast
        />
        <Button onClick={() => navigate(`/jobs/${jobId}`)}>
          Return to Job
        </Button>
      </div>
    );
  }

  // Prototype mode: Use mock payment form
  if (cfg.prototype) {
    return (
      <div className="container payment-container">
        <Button
          kind="ghost"
          onClick={() => navigate(`/jobs/${jobId}`)}
          className="payment-back-btn"
        >
          ← Back to Job
        </Button>

        <MockPaymentForm jobId={jobId} bidId={bidId} amount={amount} />
      </div>
    );
  }

  // Production mode: Use Stripe Elements
  const options = {
    clientSecret,
    appearance: {
      theme: "stripe",
      variables: {
        colorPrimary: "#0f62fe",
      },
    },
  };

  return (
    <div className="container payment-container">
      <Button
        kind="ghost"
        onClick={() => navigate(`/jobs/${jobId}`)}
        className="payment-back-btn"
      >
        ← Back to Job
      </Button>

      <Elements stripe={stripePromise} options={options}>
        <PaymentForm jobId={jobId} bidId={bidId} amount={amount} />
      </Elements>
    </div>
  );
}
