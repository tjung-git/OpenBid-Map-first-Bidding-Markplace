import { Tile, InlineNotification } from "@carbon/react";
import { cfg } from "../services/config";
import { Loader } from "@googlemaps/js-api-loader";
import { useEffect, useRef } from "react";
import { isValidCoords } from "../util/locationHelpers";
import { createMap } from "../util/mapHelpers";
import "../styles/components/map.css";

export default function MapView({
  center,
  markers,
}) {

  const divRef = useRef(null);

  useEffect(() => {
    let lat, lng;

    if(!("lat" in center) || !("lng" in center)){
      lat = 43.6532;
      lng = -79.3832;
    } else if (!isValidCoords(center.lat, center.lng)){
      lat = 43.6532;
      lng = -79.3832;
    } else {
      ({lat, lng} = center);
    }

    if (cfg.prototype) return;
    createMap(lat, lng, cfg.mapsKey, markers, divRef);
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
  return <div ref={divRef} style={{ height: 320, borderRadius: 8, marginTop: 16 }} />;
}
