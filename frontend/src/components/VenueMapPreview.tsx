import { useEffect, useRef } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { addOpenSourceTiles, VenueMarkerIcon } from "@/lib/maps/leaflet";

interface VenueMapPreviewProps {
  latitude: number;
  longitude: number;
  venueName?: string;
  address?: string;
  height?: string;
  className?: string;
  onDirections?: () => void;
}

export default function VenueMapPreview({
  latitude,
  longitude,
  venueName,
  address,
  height = "200px",
  className = "",
  onDirections,
}: VenueMapPreviewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const openDirections = () => {
    if (onDirections) {
      onDirections();
    }
  };

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [latitude, longitude],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
    });

    addOpenSourceTiles(map);
    markerRef.current = L.marker([latitude, longitude], { icon: VenueMarkerIcon }).addTo(map);
    mapInstanceRef.current = map;

    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 180);

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [latitude, longitude]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const nextCenter: L.LatLngExpression = [latitude, longitude];
    markerRef.current?.setLatLng(nextCenter);
    map.setView(nextCenter, map.getZoom(), { animate: false });

    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 0);
    return () => window.clearTimeout(resizeTimer);
  }, [latitude, longitude]);

  return (
    <div className={`rounded-2xl overflow-hidden border border-border ${className}`}>
      <div
        ref={mapRef}
        style={{ height, width: "100%" }}
        className="cursor-pointer bg-muted"
        onClick={openDirections}
        role="button"
        aria-label="Open venue directions"
      />
      <div className="bg-card p-3 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {venueName && (
            <p className="text-sm font-semibold text-foreground truncate">{venueName}</p>
          )}
          {address && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{address}</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 rounded-xl gap-1.5"
          onClick={openDirections}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Directions
        </Button>
      </div>
    </div>
  );
}
