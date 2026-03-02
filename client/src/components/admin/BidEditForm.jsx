import React from "react";
import { Form, TextInput, Select, SelectItem } from "@carbon/react";

export default function BidEditForm({ value, onChange, onSubmit }) {
  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <TextInput
        id="admin-bid-id"
        labelText="Bid ID"
        value={value.bidId}
        disabled
      />

      <TextInput
        id="admin-bid-amount"
        type="text"
        labelText="Amount"
        value={value.amount}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^0-9.]/g, "");
          const normalized = cleaned.replace(/^0+(?=\d)/, "");
          onChange({ ...value, amount: normalized });
        }}
      />

      <Select
        id="admin-bid-status"
        labelText="Status"
        value={value.status || ""}
        onChange={(e) => onChange({ ...value, status: e.target.value })}
      >
        <SelectItem value="declined" text="declined" />
        <SelectItem value="accepted" text="accepted" />
        <SelectItem value="cancelled" text="cancelled" />
        <SelectItem value="active" text="active" />
      </Select>

      <TextInput
        id="admin-bid-note"
        labelText="Note"
        value={value.note}
        onChange={(e) => onChange({ ...value, note: e.target.value })}
      />

      <TextInput
        id="admin-bid-provider"
        labelText="Bidder UID"
        value={value.providerId}
        onChange={(e) => onChange({ ...value, providerId: e.target.value })}
      />

      <TextInput
        id="admin-bid-contractor"
        labelText="Contractor UID"
        value={value.contractorId}
        onChange={(e) => onChange({ ...value, contractorId: e.target.value })}
      />

      <TextInput
        id="admin-bid-job"
        labelText="Job ID"
        value={value.jobId}
        onChange={(e) => onChange({ ...value, jobId: e.target.value })}
      />

      <TextInput
        id="admin-bid-closedAt"
        labelText="Bid closed at (ISO)"
        value={value.bidClosedAt || ""}
        onChange={(e) => onChange({ ...value, bidClosedAt: e.target.value })}
        placeholder="2026-02-25T12:34:56.000Z"
      />

      <button type="submit" style={{ display: "none" }} />
    </Form>
  );
}
