import { useState, useEffect, useRef, useCallback } from "react";
import { Navigation, Loader2, Search, X, MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { addOpenSourceTiles, DEFAULT_MAP_CENTER, VenueMarkerIcon } from "@/lib/maps/leaflet";

export interface LocationData {
  latitude: number;
  longitude: number;
  name: string;
  address?: string;
}

interface MapLocationPickerProps {
  value?: LocationData | null;
  onChange: (location: LocationData | null) => void;
  label?: string;
  placeholder?: string;
}

interface NominatimAddress {
  amenity?: string;
  building?: string;
  tourism?: string;
  shop?: string;
  road?: string;
  street?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
  region?: string;
}

const DEFAULT_ZOOM = 12;
const SELECTED_ZOOM = 16;

function formatReadableAddress(addr?: NominatimAddress, displayName?: string): string {
  if (!addr) return displayName || "";
  const parts: string[] = [];

  const place = addr.amenity || addr.building || addr.tourism || addr.shop;
  if (place) parts.push(place);

  const road = addr.road || addr.street;
  if (road) parts.push(road);

  const area = addr.neighbourhood || addr.suburb || addr.quarter;
  if (area && parts.length < 3) parts.push(area);

  const city = addr.city || addr.town || addr.village || addr.municipality;
  if (city) parts.push(city);

  const state = addr.state || addr.region;
  if (state && parts.length < 4) parts.push(state);

  return parts.length > 0 ? parts.join(", ") : displayName || "";
}

function extractShortName(addr?: NominatimAddress, displayName?: string): string {
  if (!addr) return displayName?.split(",")[0]?.trim() || "";
  const name = addr.amenity || addr.building || addr.tourism || addr.shop || addr.road || addr.neighbourhood || addr.suburb;
  return name || displayName?.split(",")[0]?.trim() || "";
}

function sameCoordinates(aLat: number, aLng: number, bLat: number, bLng: number) {
  return Math.abs(aLat - bLat) < 0.00001 && Math.abs(aLng - bLng) < 0.00001;
}

const MapLocationPicker = ({
  value,
  onChange,
  label = "Location",
  placeholder = "Search or pin a location on the map",
}: MapLocationPickerProps) => {
  const [searchQuery, setSearchQuery] = useState(value?.name || "");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(value || null);
  const [isLocating, setIsLocating] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reverseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<LocationData> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`
      );
      const data = await res.json();
      const addr = data.address as NominatimAddress | undefined;
      return {
        latitude: lat,
        longitude: lng,
        name: extractShortName(addr, data.display_name),
        address: formatReadableAddress(addr, data.display_name),
      };
    } catch {
      return { latitude: lat, longitude: lng, name: "Selected location" };
    }
  }, []);

  const placeMarker = useCallback((map: L.Map, lat: number, lng: number) => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      return;
    }

    markerRef.current = L.marker([lat, lng], { icon: VenueMarkerIcon }).addTo(map);
  }, []);

  useEffect(() => {
    setSelectedLocation(value || null);
    setSearchQuery(value?.name || "");
  }, [value?.latitude, value?.longitude, value?.name, value?.address]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const initialLocation = value || selectedLocation;
    const center: [number, number] = initialLocation
      ? [initialLocation.latitude, initialLocation.longitude]
      : DEFAULT_MAP_CENTER;

    const map = L.map(mapRef.current, {
      center,
      zoom: initialLocation ? SELECTED_ZOOM : DEFAULT_ZOOM,
      zoomControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);
    addOpenSourceTiles(map);

    if (initialLocation) {
      placeMarker(map, initialLocation.latitude, initialLocation.longitude);
    }

    const handleMoveEnd = () => {
      const currentCenter = map.getCenter();
      placeMarker(map, currentCenter.lat, currentCenter.lng);

      if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
      reverseTimerRef.current = setTimeout(async () => {
        const loc = await reverseGeocode(currentCenter.lat, currentCenter.lng);
        setSelectedLocation(loc);
      }, 350);
    };

    const handleClick = async (event: L.LeafletMouseEvent) => {
      const { lat, lng } = event.latlng;
      placeMarker(map, lat, lng);
      map.setView([lat, lng], Math.max(map.getZoom(), SELECTED_ZOOM), { animate: false });
      const loc = await reverseGeocode(lat, lng);
      setSelectedLocation(loc);
    };

    map.on("moveend", handleMoveEnd);
    map.on("click", handleClick);
    mapInstanceRef.current = map;

    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 180);
    const mapElement = mapRef.current;
    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => map.invalidateSize())
      : null;

    resizeObserver?.observe(mapElement);

    return () => {
      window.clearTimeout(resizeTimer);
      if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
      resizeObserver?.disconnect();
      map.off("moveend", handleMoveEnd);
      map.off("click", handleClick);
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [placeMarker, reverseGeocode, selectedLocation, value]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!selectedLocation) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_ZOOM, { animate: false });
      return;
    }

    placeMarker(map, selectedLocation.latitude, selectedLocation.longitude);
    const currentCenter = map.getCenter();

    if (!sameCoordinates(currentCenter.lat, currentCenter.lng, selectedLocation.latitude, selectedLocation.longitude)) {
      map.setView(
        [selectedLocation.latitude, selectedLocation.longitude],
        Math.max(map.getZoom(), SELECTED_ZOOM),
        { animate: false }
      );
    }
  }, [placeMarker, selectedLocation]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!searchQuery.trim() || searchQuery.trim().length < 3) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5&addressdetails=1`
        );
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  const selectSearchResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const addr = result.address as NominatimAddress | undefined;
    const name = extractShortName(addr, result.display_name);

    setSelectedLocation({
      latitude: lat,
      longitude: lng,
      name,
      address: formatReadableAddress(addr, result.display_name),
    });

    setSearchResults([]);
    setSearchQuery(name);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const loc = await reverseGeocode(latitude, longitude);
        setSelectedLocation(loc);
        setSearchQuery(loc.name);
        setIsLocating(false);
      },
      () => {
        toast.error("Unable to get your location");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const confirmLocation = () => {
    if (!selectedLocation) {
      toast.error("Please select a location first");
      return;
    }

    onChange(selectedLocation);
  };

  const clearLocation = () => {
    setSelectedLocation(null);
    setSearchQuery("");
    setSearchResults([]);
    onChange(null);
  };

  return (
    <div className="space-y-3">
      <Label>{label}</Label>

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="relative">
          <div ref={mapRef} className="h-[320px] w-full bg-muted md:h-[380px]" />

          <div className="absolute left-3 right-3 top-3 z-[1000] space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={placeholder}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-11 rounded-xl border-0 bg-background/95 pl-9 pr-9 shadow-lg backdrop-blur"
                  autoComplete="off"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
                {!searching && searchQuery && (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={useMyLocation}
                disabled={isLocating}
                className="h-11 w-11 shrink-0 rounded-xl border-0 bg-background/95 shadow-lg backdrop-blur"
                title="Use my location"
              >
                {isLocating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Navigation className="w-4 h-4" />
                )}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="overflow-hidden rounded-2xl bg-background/95 shadow-lg backdrop-blur">
                {searchResults.map((result, index) => {
                  const addr = result.address as NominatimAddress | undefined;
                  const name = extractShortName(addr, result.display_name);
                  const readable = formatReadableAddress(addr, result.display_name);

                  return (
                    <button
                      key={`${result.place_id ?? index}-${index}`}
                      type="button"
                      className="flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/50"
                      onClick={() => selectSearchResult(result)}
                    >
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">{name}</div>
                        <div className="truncate text-xs text-muted-foreground">{readable}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 border-t border-border bg-background p-4">
          {selectedLocation ? (
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
                <MapPin className="h-5 w-5 text-destructive" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{selectedLocation.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {selectedLocation.address || `${selectedLocation.latitude.toFixed(5)}, ${selectedLocation.longitude.toFixed(5)}`}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Click anywhere on the map, drag the map to refine the pin, or search for a place.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={clearLocation}>
              Clear
            </Button>
            <Button type="button" className="ml-auto rounded-xl" onClick={confirmLocation} disabled={!selectedLocation}>
              <Check className="mr-2 h-4 w-4" />
              Use this location
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapLocationPicker;
