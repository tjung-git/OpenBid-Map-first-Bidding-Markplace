import { Tile, InlineNotification } from "@carbon/react";
import { cfg } from "../services/config";
import { Loader } from "@googlemaps/js-api-loader";
import { useEffect, useRef } from "react";
import "../styles/components/map.css";

export default function MapView({
  center = { lat: 43.6532, lng: -79.3832 },
  markers = [],
}) {
  const divRef = useRef(null);

  useEffect(() => {
    if (cfg.prototype) return;
    const loader = new Loader({
      apiKey: cfg.mapsKey,
      version: "weekly",
    });
    let map;
    loader.load().then((google) => {
      map = new google.maps.Map(divRef.current, { center, zoom: 11 });
      markers.forEach((m) => new google.maps.Marker({ position: m, map }));
    });
    return () => {
      /* cleanup nothing */
    };
  }, [center, markers]);

  if (cfg.prototype) {
    return (
      <Tile className="map-tile">
        <InlineNotification
          title="Map Placeholder"
          subtitle="PROTOTYPE mode shows a stub map. Switch VITE_PROTOTYPE=FALSE to load Google Maps."
          kind="info"
          lowContrast
        />
      </Tile>
    );
  }
  return <div ref={divRef} className="map-container" />;
}
