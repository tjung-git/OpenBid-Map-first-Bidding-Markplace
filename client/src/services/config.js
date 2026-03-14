const explicitApiBase = import.meta.env.VITE_API_BASE?.trim();
const normalizedApiBase = explicitApiBase
  ? explicitApiBase.replace(/\/+$/, "")
  : "";
const defaultApiBase =
  import.meta.env.PROD && typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:4000";

export const cfg = {
  prototype:
    (import.meta.env.VITE_PROTOTYPE || "TRUE").toUpperCase() === "TRUE",
  apiBase: normalizedApiBase || defaultApiBase,
  mapsKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
};
