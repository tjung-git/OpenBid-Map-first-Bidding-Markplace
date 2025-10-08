export const cfg = {
  prototype:
    (import.meta.env.VITE_PROTOTYPE || "TRUE").toUpperCase() === "TRUE",
  apiBase: import.meta.env.VITE_API_BASE || "http://localhost:4000",
  mapsKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
};
