import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../services/api";
import {
  Form,
  NumberInput,
  TextInput,
  Button,
  InlineNotification,
} from "@carbon/react";
import MapView from "../components/MapView";
import "../styles/pages/jobs.css";

export default function JobDetail() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [bids, setBids] = useState([]);
  const [amount, setAmount] = useState(50);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    api.jobGet(jobId).then((d) => setJob(d.job));
    api.bidsForJob(jobId).then((d) => setBids(d.bids || []));
  }, [jobId]);

  async function placeBid(e) {
    e.preventDefault();
    setErr("");
    const r = await api.bid(jobId, { amount, note });
    if (r.error) setErr(r.error);
    else setBids((prev) => [...prev, r.bid]);
  }

  if (!job) return null;
  return (
    <div className="container">
      <h2>{job.title}</h2>
      <p>{job.description}</p>
      <MapView markers={[job.location]} center={job.location} />

      <h3 className="job-section-title">Place a Bid</h3>
      {err && (
        <InlineNotification
          title="Error"
          subtitle={err}
          kind="error"
          lowContrast
        />
      )}
      <Form onSubmit={placeBid}>
        <NumberInput
          id="amount"
          label="Amount"
          value={amount}
          onChange={(_, { value }) => setAmount(Number(value))}
        />
        <TextInput
          id="note"
          labelText="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button type="submit" className="job-bid-button">
          Submit Bid
        </Button>
      </Form>

      <h3 className="job-section-title">Bids</h3>
      <ul>
        {bids.map((b) => (
          <li key={b.id}>
            ${b.amount} — {b.note || "(no note)"} —{" "}
            {new Date(b.createdAt).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
