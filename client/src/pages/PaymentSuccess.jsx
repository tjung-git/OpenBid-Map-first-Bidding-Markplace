import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, InlineNotification, Loading } from "@carbon/react";
import { Checkmark } from "@carbon/icons-react";
import { api } from "../services/api";
import "../styles/pages/payment.css";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const jobId = searchParams.get("jobId");
  const bidId = searchParams.get("bidId");
  const paymentIntentId = searchParams.get("payment_intent");

  const [confirming, setConfirming] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function confirmPayment() {
      if (!jobId || !paymentIntentId) {
        setError("Missing payment information");
        setConfirming(false);
        return;
      }

      try {
        // Confirm the payment was successful with our backend
        const result = await api.confirmPayment(jobId, paymentIntentId);
        if (result.error) {
          setError(result.error);
        }
      } catch (err) {
        console.error("Failed to confirm payment:", err);
        setError("Failed to confirm payment status");
      } finally {
        setConfirming(false);
      }
    }

    confirmPayment();
  }, [jobId, paymentIntentId]);

  if (confirming) {
    return (
      <div className="container payment-container">
        <Loading description="Confirming payment..." withOverlay={false} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container payment-container">
        <InlineNotification
          title="Payment Confirmation Issue"
          subtitle={error}
          kind="warning"
          lowContrast
        />
        <p>
          Your payment may have been processed. Please check the job details to
          confirm.
        </p>
        <Button onClick={() => navigate(`/jobs/${jobId}`)}>
          View Job Details
        </Button>
      </div>
    );
  }

  return (
    <div className="container payment-container">
      <div className="payment-success-container">
        <div className="payment-success-icon">
          <Checkmark size={48} />
        </div>

        <h2>Payment Successful!</h2>

        <InlineNotification
          title="Funds Secured in Escrow"
          subtitle="Your payment has been successfully processed and is now held securely in escrow."
          kind="success"
          lowContrast
          hideCloseButton
        />

        <div className="payment-success-info">
          <h3>What happens next?</h3>
          <ol>
            <li>
              <strong>Contractor Notified:</strong> The contractor has been
              notified that payment is secured and work can begin.
            </li>
            <li>
              <strong>Work Begins:</strong> The contractor will start working on
              your job.
            </li>
            <li>
              <strong>Job Completion:</strong> Once the work is complete, the
              contractor will mark the job as finished.
            </li>
            <li>
              <strong>Payment Release:</strong> After you confirm the work is
              satisfactory, the payment will be released from escrow to the
              contractor.
            </li>
          </ol>
        </div>

        <div className="payment-success-actions">
          <Button onClick={() => navigate(`/jobs/${jobId}`, {
            state: { refreshData: true, notice: "Payment successfully processed and held in escrow." }
          })}>
            View Job Details
          </Button>
          <Button kind="ghost" onClick={() => navigate("/jobs")}>
            Browse More Jobs
          </Button>
        </div>

        <div className="payment-success-note">
          <p>
            <strong>Need help?</strong> If you have any questions or concerns
            about your payment or the job, please contact support.
          </p>
        </div>
      </div>
    </div>
  );
}

