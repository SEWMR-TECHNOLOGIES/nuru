import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Navigation, LocateFixed, Loader2, AlertCircle } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { addOpenSourceTiles, VenueMarkerIcon } from "@/lib/maps/leaflet";

interface DirectionsMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destinationLat: number;
  destinationLng: number;
  venueName?: string;
  address?: string;
}

const USER_ICON = L.divIcon({
  html: `<div style="width:18px;height:18px;background:#1A73E8;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
  className: "",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function DirectionsMapDialog({
  open,
  onOpenChange,
  destinationLat,
  destinationLng,
  venueName,
  address,
}: DirectionsMapDialogProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Request user location
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        setLocating(false);
      },
      () => {
        setError("Could not get your location. Please enable location access.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Auto-request on open
  useEffect(() => {
    if (open && !userLocation) requestLocation();
  }, [open]);

  // Init map
  useEffect(() => {
    if (!open || !mapRef.current) return;
    // Small delay for dialog animation
    const timer = setTimeout(() => {
      if (mapInstanceRef.current || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [destinationLat, destinationLng],
        zoom: 14,
        zoomControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);
      addOpenSourceTiles(map);

      // Destination marker
      L.marker([destinationLat, destinationLng], { icon: VenueMarkerIcon }).addTo(map);

      mapInstanceRef.current = map;
      setTimeout(() => map.invalidateSize(), 100);
    }, 200);

    return () => {
      clearTimeout(timer);
    };
  }, [open, destinationLat, destinationLng]);

  // Cleanup on close
  useEffect(() => {
    if (!open && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      routeLayerRef.current = null;
      userMarkerRef.current = null;
      setRouteInfo(null);
    }
  }, [open]);

  // Fetch & draw route when user location available
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !userLocation) return;

    // Add/update user marker
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(userLocation);
    } else {
      userMarkerRef.current = L.marker(userLocation, { icon: USER_ICON }).addTo(map);
    }

    // Fetch route from OSRM
    const fetchRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${userLocation[1]},${userLocation[0]};${destinationLng},${destinationLat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.code !== "Ok" || !data.routes?.[0]) {
          setError("Could not calculate route");
          return;
        }

        const route = data.routes[0];
        const coords: [number, number][] = route.geometry.coordinates.map(
          (c: [number, number]) => [c[1], c[0]] as [number, number]
        );

        // Remove old route
        if (routeLayerRef.current) {
          map.removeLayer(routeLayerRef.current);
        }

        // Draw route
        routeLayerRef.current = L.polyline(coords, {
          color: "#1A73E8",
          weight: 5,
          opacity: 0.85,
          smoothFactor: 1,
        }).addTo(map);

        // Fit bounds
        const bounds = L.latLngBounds([userLocation, [destinationLat, destinationLng]]);
        map.fitBounds(bounds, { padding: [50, 50] });

        // Route info
        const distKm = (route.distance / 1000).toFixed(1);
        const durMin = Math.round(route.duration / 60);
        setRouteInfo({
          distance: `${distKm} km`,
          duration: durMin >= 60 ? `${Math.floor(durMin / 60)}h ${durMin % 60}m` : `${durMin} min`,
        });
      } catch {
        setError("Failed to fetch route directions");
      }
    };

    fetchRoute();
  }, [userLocation, destinationLat, destinationLng]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Navigation className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-sm truncate">
                Directions to {venueName || "Venue"}
              </p>
              {address && (
                <p className="text-xs text-muted-foreground font-normal truncate">{address}</p>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Route info bar */}
        {routeInfo && (
          <div className="mx-4 mb-2 flex items-center gap-3 bg-primary/5 border border-primary/15 rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-primary" />
              <span className="text-sm font-semibold text-foreground">{routeInfo.duration}</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <span className="text-sm text-muted-foreground">{routeInfo.distance}</span>
            <span className="text-xs text-muted-foreground ml-auto">via OSRM</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="mx-4 mb-2 flex items-center gap-2 bg-destructive/5 border border-destructive/15 rounded-xl px-4 py-2.5">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
            <span className="text-sm text-destructive">{error}</span>
          </div>
        )}

        {/* Map */}
        <div ref={mapRef} className="w-full bg-muted" style={{ height: "400px" }} />

        {/* Footer */}
        <div className="p-4 pt-3 flex items-center justify-between gap-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5"
            disabled={locating}
            onClick={requestLocation}
          >
            {locating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LocateFixed className="w-3.5 h-3.5" />
            )}
            {locating ? "Locating…" : "My Location"}
          </Button>

          <Button
            variant="default"
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
