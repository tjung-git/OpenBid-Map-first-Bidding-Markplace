import { isValidCoords } from "./locationHelpers";
import { Loader } from "@googlemaps/js-api-loader";

//Attaches a map to a given reference
export const createMap = async (lat, lng, apiKey, markers, ref) => {
    const loader = new Loader({
        apiKey,
        version: "weekly",
        libraries: ['places']
    });

    const filteredMarkers = Array.isArray(markers)? markers.filter((m) => isValidCoords(m.lat, m.lng)): [];

    const google = await loader.load();

    let map = new google.maps.Map(ref.current, { center: {lat, lng}, zoom: 11 });
    filteredMarkers.forEach((m) => new google.maps.Marker({ position: m, map }));
};