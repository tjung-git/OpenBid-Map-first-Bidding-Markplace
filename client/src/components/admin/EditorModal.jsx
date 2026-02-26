import React from "react";
import { Modal, InlineNotification } from "@carbon/react";

export default function EditorModal({
  open,
  title,
  loading,
  saving,
  error,
  onClose,
  onSubmit,
  children,
}) {
  return (
    <Modal
      open={open}
      modalHeading={title}
      primaryButtonText="Save"
      secondaryButtonText="Cancel"
      onRequestClose={onClose}
      onRequestSubmit={onSubmit}
      primaryButtonDisabled={loading || saving}
    >
      {error ? (
        <InlineNotification
          kind="error"
          title="Save failed"
          subtitle={error}
          lowContrast
        />
      ) : null}

      {loading ? (
        <InlineNotification
          kind="info"
          title="Loading…"
          subtitle="Fetching latest details."
          lowContrast
        />
      ) : (
        children
      )}
    </Modal>
  );
}
