import { useState, useEffect, useMemo } from "react";
import {
  Form,
  TextInput,
  NumberInput,
  Button,
  InlineNotification,
} from "@carbon/react";
import { api } from "../services/api";
import {
  useSessionRequirements,
  useSessionUser,
} from "../hooks/useSession";
import { useNavigate } from "react-router-dom";
import MapView from "../components/MapView";
import "../styles/pages/jobs.css";
import { cfg } from "../services/config";
import SearchAutocomplete from "../components/SearchAutocomplete";

export default function NewJob() {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [lat, setLat] = useState(43.6532);
  const [lng, setLng] = useState(-79.3832);
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const mapCenter = useMemo(() => ({ lat, lng }), [lat, lng]);
  const mapMarkers = useMemo(() => [{ lat, lng }], [lat, lng]);
  const nav = useNavigate();
  const user = useSessionUser();
  const requirements = useSessionRequirements();
  const [address, setAddress] = useState("Toronto, ON, Canada");

  useEffect(() => {
    if (!user || user.userType !== "contractor") {
      nav("/jobs", { replace: true });
      return;
    }
    if (!requirements.kycVerified) {
      nav("/jobs", {
        replace: true,
        state: {
          notice: "Complete KYC before posting jobs.",
        },
      });
    }
  }, [nav, requirements.kycVerified, user]);

  const handlePlaceSelection = (placeData) => {
    const {address, latLng} = placeData;
    setAddress(address);
    setLat(latLng.lat);
    setLng(latLng.lng);
  };

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (submitting) return;
    if (user?.userType !== "contractor") {
      setErr("Only contractors can post jobs.");
      return;
    }
    if (!requirements.kycVerified) {
      nav("/profile", {
        state: {
          notice: "Complete KYC verification in your profile to post jobs.",
        },
      });
      return;
    }
    setSubmitting(true);
    const cleanedBudget = budgetInput.replace(/[^0-9.]/g, "");
    const numericBudget = cleanedBudget === "" ? null : Number(cleanedBudget);
    if (!Number.isFinite(numericBudget) || numericBudget === null || numericBudget <= 0) {
      setErr("Enter a valid budget amount greater than 0.");
      setSubmitting(false);
      return;
    }
    try {
      const r = await api.jobCreate({
        title,
        description: desc,
        budgetAmount: numericBudget,
        location: { lat, lng, address: cfg.prototype? "Mock Address": address },
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
      <div className="job-detail-header">
        <Button kind="ghost" onClick={() => nav("/jobs")}>
          Back to Job List
        </Button>
      </div>
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
          allowEmpty
          value={budgetInput === "" ? "" : Number(budgetInput)}
          onChange={(_, { value }) => {
            const raw = value == null ? "" : String(value);
            const cleaned = raw.replace(/[^0-9.]/g, "");
            const normalized = cleaned.replace(/^0+(?=\d)/, "");
            setBudgetInput(normalized);
          }}
        />
        {cfg.prototype ? 
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
            </div> :
            <div className="job-location-search-container">
              <SearchAutocomplete onSelectPlace={handlePlaceSelection}/>
              <div>Selected location: {address}</div>
            </div>
            }
        <MapView center={mapCenter} markers={mapMarkers} />
        {/* TODO: Wire MapView interactions so the marker can drive lat/lng updates automatically. */}
        <Button type="submit" className="job-submit" disabled={submitting}>
          Create
        </Button>
      </Form>
    </div>
  );
}
