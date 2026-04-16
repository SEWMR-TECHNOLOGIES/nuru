import L from "leaflet";

const MAP_PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none">
  <g filter="url(#shadow)">
    <path d="M24 4C16.268 4 10 10.268 10 18c0 10.5 14 24 14 24s14-13.5 14-24c0-7.732-6.268-14-14-14z" fill="#EA4335"/>
    <circle cx="24" cy="18" r="5" fill="white"/>
  </g>
  <defs>
    <filter id="shadow" x="6" y="2" width="36" height="50" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
    </filter>
  </defs>
</svg>`;

const MAP_PIN_URL = `data:image/svg+xml;base64,${btoa(MAP_PIN_SVG)}`;

export const DEFAULT_MAP_CENTER: [number, number] = [-6.7924, 39.2083];
export const OPEN_SOURCE_TILE_URL = "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png";
export const OPEN_SOURCE_TILE_ATTRIBUTION =
  '&copy; OpenStreetMap contributors &copy; CARTO';

export const VenueMarkerIcon = L.icon({
  iconUrl: MAP_PIN_URL,
  iconSize: [48, 48],
  iconAnchor: [24, 48],
  popupAnchor: [0, -48],
});

export function addOpenSourceTiles(map: L.Map) {
  return L.tileLayer(OPEN_SOURCE_TILE_URL, {
    attribution: OPEN_SOURCE_TILE_ATTRIBUTION,
    subdomains: "abcd",
    maxZoom: 20,
  }).addTo(map);
}
