import React from "react";
import { Form, TextInput, Select, SelectItem } from "@carbon/react";

export default function UserEditForm({ value, onChange, onSubmit }) {
  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <TextInput
        id="admin-user-uid"
        labelText="UID"
        value={value.uid}
        disabled
      />

      <TextInput
        id="admin-user-email"
        labelText="Email"
        value={value.email}
        onChange={(e) => onChange({ ...value, email: e.target.value })}
      />

      <div className="job-form-grid">
        <TextInput
          id="admin-user-first"
          labelText="First name"
          value={value.firstName}
          onChange={(e) => onChange({ ...value, firstName: e.target.value })}
        />
        <TextInput
          id="admin-user-last"
          labelText="Last name"
          value={value.lastName}
          onChange={(e) => onChange({ ...value, lastName: e.target.value })}
        />
      </div>

      <Select
        id="admin-user-role"
        labelText="Role"
        value={value.userType || ""}
        onChange={(e) => onChange({ ...value, userType: e.target.value })}
      >
        <SelectItem value="admin" text="admin" />
        <SelectItem value="contractor" text="contractor" />
        <SelectItem value="bidder" text="bidder" />
      </Select>

      <Select
        id="admin-user-email-verification"
        labelText="Email verification"
        value={value.emailVerification || ""}
        onChange={(e) =>
          onChange({ ...value, emailVerification: e.target.value })
        }
      >
        <SelectItem value="verified" text="verified" />
        <SelectItem value="pending" text="pending" />
      </Select>

      <Select
        id="admin-user-kyc"
        labelText="KYC status"
        value={value.kycStatus || ""}
        onChange={(e) => onChange({ ...value, kycStatus: e.target.value })}
      >
        <SelectItem value="pending" text="pending" />
        <SelectItem value="verified" text="verified" />
        <SelectItem value="rejected" text="rejected" />
      </Select>

      <button type="submit" style={{ display: "none" }} />
    </Form>
  );
}
