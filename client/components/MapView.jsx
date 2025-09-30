import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";

export default function MapView({ markers = [] }) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });
  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="small">
        Map disabled (no API key). Showing list view is enough for Iteration
        1.2.
      </div>
    );
  }
  if (loadError) return <div className="card">Map failed to load.</div>;
  if (!isLoaded) return <div className="card">Loading map…</div>;

  const center = markers[0]?.position ?? { lat: 43.653, lng: -79.383 };
  return (
    <div className="card" style={{ height: 360 }}>
      <GoogleMap
        zoom={12}
        center={center}
        mapContainerStyle={{ width: "100%", height: "100%" }}
      >
        {markers.map((m, i) => (
          <Marker key={i} position={m.position} />
        ))}
      </GoogleMap>
    </div>
  );
}
