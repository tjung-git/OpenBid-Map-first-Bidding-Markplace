import { useEffect, useState } from "react";
import { getJob, listBids, createBid } from "../firebase";
import { useParams } from "react-router-dom";

export default function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [bids, setBids] = useState([]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [etaHours, setEtaHours] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  async function refresh() {
    setLoading(true);
    const j = await getJob(id);
    const b = await listBids(id);
    setJob(j);
    setBids(b);
    setLoading(false);
  }
  useEffect(() => {
    refresh();
  }, [id]);

  async function submitBid(e) {
    e.preventDefault();
    setPosting(true);
    await createBid(id, { amount, note, etaHours });
    setAmount("");
    setNote("");
    setEtaHours("");
    await refresh();
    setPosting(false);
  }

  if (loading)
    return (
      <div className="container">
        <div className="card">Loading…</div>
      </div>
    );
  if (!job)
    return (
      <div className="container">
        <div className="card">Job not found.</div>
      </div>
    );

  return (
    <div className="container">
      <h1>{job.title}</h1>
      <div className="card">
        <p>{job.description || "—"}</p>
        <p className="small">
          Budget:{" "}
          {job.budgetType === "fixed"
            ? `$${job.budgetAmount?.toFixed?.(2) ?? "-"}`
            : "Open"}
        </p>
        {job.location?.address && (
          <p className="small">Approx. location: {job.location.address}</p>
        )}
      </div>

      <h2 style={{ marginTop: 24 }}>Place a Bid</h2>
      <form className="card" onSubmit={submitBid}>
        <div className="row">
          <input
            className="input"
            type="number"
            step="0.01"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <input
            className="input"
            type="number"
            step="1"
            placeholder="ETA (hours)"
            value={etaHours}
            onChange={(e) => setEtaHours(e.target.value)}
          />
        </div>
        <textarea
          className="input"
          rows={4}
          placeholder="Note to poster (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="button primary" disabled={posting}>
          {posting ? "Submitting…" : "Submit Bid"}
        </button>
      </form>

      <h2 style={{ marginTop: 24 }}>Bids</h2>
      <div className="list">
        {bids.length === 0 && <div className="card">No bids yet.</div>}
        {bids.map((b) => (
          <div className="card" key={b.id}>
            <div>
              <b>${Number(b.amount).toFixed(2)}</b> — ETA {b.etaHours ?? "—"}h
            </div>
            <div className="small">{b.note || "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
