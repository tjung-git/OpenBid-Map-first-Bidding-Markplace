import { useState, useEffect, useMemo } from "react";
import {
  Form,
  TextInput,
  NumberInput,
  Button,
  InlineNotification,
} from "@carbon/react";
import { api } from "../services/api";
import { getRequirements, getUser } from "../services/session";
import { useNavigate } from "react-router-dom";
import MapView from "../components/MapView";
import "../styles/pages/jobs.css";

export default function NewJob() {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [budget, setBudget] = useState(100);
  const [lat, setLat] = useState(43.6532);
  const [lng, setLng] = useState(-79.3832);
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const mapCenter = useMemo(() => ({ lat, lng }), [lat, lng]);
  const mapMarkers = useMemo(() => [{ lat, lng }], [lat, lng]);
  const nav = useNavigate();
  const user = getUser();
  useEffect(() => {
    if (!user || user.userType !== "contractor") {
      nav("/jobs", { replace: true });
      return;
    }
    const requirements = getRequirements();
    if (!requirements.kycVerified) {
      nav("/jobs", {
        replace: true,
        state: {
          notice: "Complete KYC before posting jobs.",
        },
      });
    }
  }, [nav, user]);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (submitting) return;
    const latestUser = getUser();
    const latestRequirements = getRequirements();
    if (latestUser?.userType !== "contractor") {
      setErr("Only contractors can post jobs.");
      return;
    }
    if (!latestRequirements.kycVerified) {
      nav("/kyc", {
        state: {
          notice: "Complete KYC before posting jobs.",
        },
      });
      return;
    }
    setSubmitting(true);
    try {
      const r = await api.jobCreate({
        title,
        description: desc,
        budgetAmount: budget,
        location: { lat, lng, address: "Mock Address" },
      });
      if (r.error) {
        setErr(r.error);
      } else {
        nav(`/jobs/${r.job.id}`, {
          state: { notice: `${title} job posted.` },
        });
      }
    } catch {
      setErr("Unable to create job. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <h2>Post a Job</h2>
      {err && (
        <InlineNotification
          title="Error"
          subtitle={err}
          kind="error"
          lowContrast
        />
      )}
      <Form onSubmit={submit}>
        <TextInput
          id="title"
          labelText="Job Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <TextInput
          id="desc"
          labelText="Job Description"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <NumberInput
          id="budget"
          label="Job Budget"
          value={budget}
          onChange={(_, { value }) => setBudget(Number(value))}
        />
        <div className="job-form-grid">
          <NumberInput
            id="lat"
            label="Latitude"
            value={lat}
            onChange={(_, { value }) => setLat(Number(value))}
          />
          <NumberInput
            id="lng"
            label="Longitude"
            value={lng}
            onChange={(_, { value }) => setLng(Number(value))}
          />
        </div>
        <MapView center={mapCenter} markers={mapMarkers} />
        {/* TODO: Wire MapView interactions so the marker can drive lat/lng updates automatically. */}
        <Button type="submit" className="job-submit" disabled={submitting}>
          Create
        </Button>
      </Form>
    </div>
  );
}
