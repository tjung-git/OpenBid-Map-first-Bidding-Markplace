import { useState } from "react";
import { createJob } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function NewJob() {
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budgetType, setBudgetType] = useState("open");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    const location =
      lat && lng ? { lat: Number(lat), lng: Number(lng), address } : null;
    const docRef = await createJob({
      title,
      description,
      budgetType,
      budgetAmount: budgetType === "fixed" ? Number(budgetAmount || 0) : null,
      location,
    });
    nav(`/jobs/${docRef.id}`);
  }

  return (
    <div className="container">
      <h1>New Job</h1>
      <form className="card" onSubmit={submit}>
        <input
          className="input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          className="input"
          rows={5}
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="row">
          <select
            className="select"
            value={budgetType}
            onChange={(e) => setBudgetType(e.target.value)}
          >
            <option value="open">Open Budget</option>
            <option value="fixed">Fixed Budget</option>
          </select>
          {budgetType === "fixed" && (
            <input
              className="input"
              type="number"
              step="0.01"
              placeholder="Amount"
              value={budgetAmount}
              onChange={(e) => setBudgetAmount(e.target.value)}
            />
          )}
        </div>
        <details className="card" style={{ background: "#0f1115" }}>
          <summary>Add approximate location (optional for 1.2)</summary>
          <input
            className="input"
            placeholder="Address (free text)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <div className="row">
            <input
              className="input"
              placeholder="Latitude"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
            <input
              className="input"
              placeholder="Longitude"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
            />
          </div>
          <div className="small">
            For 1.2 we allow manual lat/lng to drop markers; hook up Places API
            next iteration.
          </div>
        </details>
        <button className="button primary" disabled={submitting}>
          {submitting ? "Creating…" : "Create Job"}
        </button>
      </form>
    </div>
  );
}
