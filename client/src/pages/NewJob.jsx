import { useState } from "react";
import {
  Form,
  TextInput,
  NumberInput,
  Button,
  InlineNotification,
} from "@carbon/react";
import { api } from "../services/api";
import { useNavigate } from "react-router-dom";

export default function NewJob() {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [budget, setBudget] = useState(100);
  const [lat, setLat] = useState(43.6532);
  const [lng, setLng] = useState(-79.3832);
  const [err, setErr] = useState("");
  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setErr("");
    const r = await api.jobCreate({
      title,
      description: desc,
      budgetAmount: budget,
      location: { lat, lng, address: "Mock Address" },
    });
    if (r.error) setErr(r.error);
    else nav(`/jobs/${r.job.id}`);
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
          labelText="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <TextInput
          id="desc"
          labelText="Description"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <NumberInput
          id="budget"
          label="Budget"
          value={budget}
          onChange={(_, { value }) => setBudget(Number(value))}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
          }}
        >
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
        <Button type="submit" style={{ marginTop: "1rem" }}>
          Create
        </Button>
      </Form>
    </div>
  );
}
