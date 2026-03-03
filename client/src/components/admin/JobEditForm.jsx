import React from "react";
import {
  Form,
  TextInput,
  Select,
  SelectItem,
  NumberInput,
} from "@carbon/react";
import SearchAutocomplete from "../SearchAutocomplete";

export default function JobEditForm({
  value,
  onChange,
  onSubmit,
  prototype,
  onPlaceSelect,
}) {
  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <TextInput
        id="admin-job-id"
        labelText="Job ID"
        value={value.jobId}
        disabled
      />

      <TextInput
        id="admin-job-title"
        labelText="Title"
        value={value.title}
        onChange={(e) => onChange({ ...value, title: e.target.value })}
        required
      />

      <TextInput
        id="admin-job-desc"
        labelText="Description"
        value={value.description}
        onChange={(e) => onChange({ ...value, description: e.target.value })}
      />

      <TextInput
        id="admin-job-budget"
        type="text"
        labelText="Budget"
        value={value.budget}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^0-9.]/g, "");
          const normalized = cleaned.replace(/^0+(?=\d)/, "");
          onChange({ ...value, budget: normalized });
        }}
      />

      <TextInput
        id="admin-job-poster"
        labelText="Poster UID"
        value={value.posterId}
        onChange={(e) => onChange({ ...value, posterId: e.target.value })}
      />

      <Select
        id="admin-job-status"
        labelText="Status"
        value={value.status || ""}
        onChange={(e) => onChange({ ...value, status: e.target.value })}
      >
        <SelectItem value="open" text="open" />
        <SelectItem value="closed" text="closed" />
        <SelectItem value="awarded" text="awarded" />
        <SelectItem value="cancelled" text="cancelled" />
      </Select>

      {prototype ? (
        <div className="job-form-grid">
          <NumberInput
            id="admin-job-lat"
            label="Latitude"
            value={value.lat}
            onChange={(_, { value: v }) =>
              onChange({ ...value, lat: Number(v) })
            }
          />
          <NumberInput
            id="admin-job-lng"
            label="Longitude"
            value={value.lng}
            onChange={(_, { value: v }) =>
              onChange({ ...value, lng: Number(v) })
            }
          />
        </div>
      ) : (
        <div className="job-location-search-container">
          <SearchAutocomplete onSelectPlace={onPlaceSelect} />
          <div>Selected location: {value.address}</div>
        </div>
      )}

      <button type="submit" style={{ display: "none" }} />
    </Form>
  );
}
