import { Tile, InlineNotification } from "@carbon/react";
import { cfg } from "../services/config";
import { Loader } from "@googlemaps/js-api-loader";
import { useEffect, useRef } from "react";
import { isValidCoords } from "../util/locationHelpers";

export default function MapView({
  center = { lat: 43.6532, lng: -79.3832 },
  markers = [],
}) {

  const divRef = useRef(null);

  useEffect(() => {
    let lat, lng;

    if(!("lat" in center) || !("lng" in center)){
      lat = 0;
      lng = 0;
    } else if (!isValidCoords(center.lat, center.lng)){
      lat = 0;
      lng = 0;
    } else {
      ({lat, lng} = center);
    }

    if (cfg.prototype) return;
    const loader = new Loader({
      apiKey: cfg.mapsKey,
      version: "weekly",
      libraries: ['places']
    });
    let map;
    loader.load().then((google) => {
      map = new google.maps.Map(divRef.current, { center: {lat, lng}, zoom: 11 });
      markers
      .filter((m) => isValidCoords(m.lat, m.lng))
      .forEach((m) => new google.maps.Marker({ position: m, map }));
    });
    return () => {
      /* cleanup nothing */
    };
  }, [center, markers]);

  if (cfg.prototype) {
    return (
      <Tile style={{ height: 320, display: "grid", placeItems: "center" }}>
        <InlineNotification
          title="Map Placeholder"
          subtitle="PROTOTYPE mode shows a stub map. Switch VITE_PROTOTYPE=FALSE to load Google Maps."
          kind="info"
          lowContrast
        />
      </Tile>
    );
  }
  return <div ref={divRef} style={{ height: 320, borderRadius: 8, marginTop: 16 }} />;
}
