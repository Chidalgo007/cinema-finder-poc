import "maplibre-gl/dist/maplibre-gl.css";
import Map, { Marker, useMap } from "react-map-gl";
// eslint-disable-next-line import/no-webpack-loader-syntax
import maplibregl from "maplibre-gl";
import useEventListener from "@use-it/event-listener";
import { useSnackbar } from "notistack";
import { MapContextProvider } from "./context";
import { totalBounds } from "../../data/bounds";
import { useState, useEffect } from "react";
import maplibreglWorker from "maplibre-gl/dist/maplibre-gl-csp-worker";
maplibregl.workerClass = maplibreglWorker;

const MaplibreMarker = ({ lat, lon }) => (
  <Marker longitude={lon} latitude={lat} anchor="bottom" />
);

const MapBoundaryEnforcer = () => {
  // Destructure the 'current' property from the object returned by useMap()
  // And then access the 'getMap()' method on that 'current' object
  const { current: mapRef } = useMap();

  useEffect(() => {
    // Check if mapRef exists and if getMap() method is available
    if (mapRef && typeof mapRef.getMap === "function") {
      const map = mapRef.getMap(); // This will give you the underlying maplibregl.Map instance

      if (map) {
        // Add a listener for the 'load' event on the actual MapLibre GL JS map instance
        map.on("load", () => {
          console.log("Map loaded, setting max bounds.");
          try {
            map.setMaxBounds(totalBounds);
            console.log("Max bounds set successfully:", totalBounds);
          } catch (error) {
            console.error("Error setting max bounds:", error);
          }
        });

        return () => {
          map.off("load");
        };
      }
    }
  }, [mapRef]);

  return null;
};

const convertBounds = ([w, s, e, n]) => [
  // MapLibre expects bounds to be [LngLatBoundsLike](https://maplibre.org/maplibre-gl-js-docs/api/geography/#lnglatboundslike)
  // as such the are either LngLat objects in [sw, ne] order or an array of numbers in [w, s, e, n] order.
  [w, s],
  [e, n],
];

const MapSnappingEventListener = () => {
  const { enqueueSnackbar } = useSnackbar();
  const map = useMap().current;
  useEventListener("map.snapTo", ({ detail: { lat, lng } }) => {
    // This hook sets up an event listener for the map.snapTo event which
    // is currently dispatched be an onClick function in CinemaListItem
    console.log("executing `map.snapTo` event with maplibre");

    try {
      // [Docs](https://maplibre.org/maplibre-gl-js-docs/api/map/#map#flyto)
      map.flyTo({
        center: [lng, lat],
        zoom: 14,
      });
    } catch (e) {
      console.error(e);
      enqueueSnackbar("Unexpected error while attempting map navigation", {
        variant: "error",
      });
    }
  });
  return null;
};

const MaplibreMap = ({ children }) => {
  console.log("render Maplibre map");
  // State to hold the initial view state, which can be updated with user location
  const [viewState, setViewState] = useState({
    // Default to totalBounds if location isn't found or permission is denied
    bounds: convertBounds(totalBounds),
    padding: 24, // Keep padding
  });

  useEffect(() => {
    // Check if geolocation is available in the browser
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // On success, update the viewState to center on user's location
          setViewState({
            longitude: position.coords.longitude,
            latitude: position.coords.latitude,
            zoom: 12, // A good initial zoom level for a user's general area
            padding: 24,
          });
        },
        (error) => {
          // On error (e.g., user denies permission, location not available)
          console.error("Error getting user location:", error);
          // Fallback to totalBounds if location cannot be obtained
          setViewState({
            bounds: convertBounds(totalBounds),
            padding: 24,
          });
        },
        {
          enableHighAccuracy: true, // Request more accurate location
          timeout: 5000, // Time out after 5 seconds
          maximumAge: 0, // Don't use cached location
        }
      );
    } else {
      // Geolocation is not supported by the browser
      console.warn("Geolocation is not supported by this browser.");
      // Fallback to totalBounds
      setViewState({
        bounds: convertBounds(totalBounds),
        padding: 24,
      });
    }
  }, []);

  return (
    <Map
      mapLib={maplibregl}
      mapStyle="https://api.maptiler.com/maps/streets-v2/style.json?key=46DCXvzkGNIvqAgCljGV"
      initialViewState={viewState}
      onMove={(evt) => setViewState(evt.viewState)}
    >
      <MapBoundaryEnforcer />
      <MapSnappingEventListener />
      <MapContextProvider value={{ Marker: MaplibreMarker }}>
        {children}
      </MapContextProvider>
    </Map>
  );
};
export default MaplibreMap;
