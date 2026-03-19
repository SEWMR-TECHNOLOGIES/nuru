import { useState, useEffect, useRef } from "react";
import { Navigation, Loader2, Search, X } from "lucide-react";
import LocationIcon from '@/assets/icons/location-icon.svg';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Google Maps–style red drop pin SVG
const pinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none">
  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335"/>
  <circle cx="12" cy="9" r="2.5" fill="white"/>
</svg>`;

const pinDataUrl = `data:image/svg+xml;base64,${btoa(pinSvg)}`;

const DefaultIcon = L.icon({
  iconUrl: pinDataUrl,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Shadow for the center pin (small ellipse below the pin)
const centerPinShadow = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="6" viewBox="0 0 20 6"><ellipse cx="10" cy="3" rx="8" ry="3" fill="rgba(0,0,0,0.25)"/></svg>`;

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

const MapLocationPicker = ({ value, onChange, label = "Location", placeholder = "Search or pick on map" }: MapLocationPickerProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(value || null);
  const [isLocating, setIsLocating] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reverseGeocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reverse-geocode a lat/lng
  const reverseGeocode = async (lat: number, lng: number): Promise<LocationData> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      );
      const data = await res.json();
      const name =
        data.address?.road ||
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        data.address?.county ||
        "Selected location";
      return { latitude: lat, longitude: lng, name, address: data.display_name };
    } catch {
      return { latitude: lat, longitude: lng, name: "Selected location" };
    }
  };

  // Initialize map when dialog opens
  useEffect(() => {
    if (!open || !mapRef.current) return;

    const timer = setTimeout(() => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const defaultCenter: [number, number] = selectedLocation
        ? [selectedLocation.latitude, selectedLocation.longitude]
        : [-6.7924, 39.2083]; // Dar es Salaam default

      const map = L.map(mapRef.current, {
        center: defaultCenter,
        zoom: selectedLocation ? 15 : 12,
        zoomControl: false,
      });

      // Zoom controls bottom-right
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // CartoDB Voyager tiles — beautiful free tiles
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      // Place marker if value already exists
      if (selectedLocation) {
        markerRef.current = L.marker([selectedLocation.latitude, selectedLocation.longitude])
          .addTo(map)
          .bindPopup(selectedLocation.name);
      }

      // On map move → update the center pin's location and reverse-geocode
      const handleMove = () => {
        setIsPanning(true);
        if (reverseGeocodeTimerRef.current) clearTimeout(reverseGeocodeTimerRef.current);
      };

      const handleMoveEnd = () => {
        const center = map.getCenter();
        const lat = center.lat;
        const lng = center.lng;

        // Place / move the marker to center
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng]).addTo(map);
        }

        setIsPanning(false);

        // Debounced reverse geocode
        reverseGeocodeTimerRef.current = setTimeout(async () => {
          const loc = await reverseGeocode(lat, lng);
          setSelectedLocation(loc);
        }, 300);
      };

      // Click to place marker immediately
      map.on("click", async (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng]).addTo(map);
        }
        map.setView([lat, lng], map.getZoom());
        const loc = await reverseGeocode(lat, lng);
        setSelectedLocation(loc);
      });

      map.on("move", handleMove);
      map.on("moveend", handleMoveEnd);

      mapInstanceRef.current = map;

      setTimeout(() => map.invalidateSize(), 300);
    }, 200);

    return () => {
      clearTimeout(timer);
      if (reverseGeocodeTimerRef.current) clearTimeout(reverseGeocodeTimerRef.current);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [open]);

  // Search with debounce
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5&countrycodes=tz`
        );
        const data = await res.json();
        setSearchResults(data);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, [searchQuery]);

  const selectSearchResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const name = result.display_name?.split(",")[0] || "Selected";

    setSelectedLocation({
      latitude: lat,
      longitude: lng,
      name,
      address: result.display_name,
    });

    if (mapInstanceRef.current) {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(mapInstanceRef.current);
      }
      mapInstanceRef.current.setView([lat, lng], 16);
    }

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

        if (mapInstanceRef.current) {
          if (markerRef.current) {
            markerRef.current.setLatLng([latitude, longitude]);
          } else {
            markerRef.current = L.marker([latitude, longitude]).addTo(mapInstanceRef.current);
          }
          mapInstanceRef.current.setView([latitude, longitude], 16);
        }

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
    setOpen(false);
  };

  const clearLocation = () => {
    onChange(null);
    setSelectedLocation(null);
    setSearchQuery("");
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1 justify-start text-left font-normal h-10"
          onClick={() => setOpen(true)}
        >
          <img src={LocationIcon} alt="Location" className="w-4 h-4 mr-2 flex-shrink-0 dark:invert" />
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {value?.name || placeholder}
          </span>
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10" onClick={clearLocation}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Pick Location</DialogTitle>
            <DialogDescription>Search, tap, or drag the map to place the pin</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            {/* Search + Use my location */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search places in Tanzania..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  autoComplete="off"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={useMyLocation}
                disabled={isLocating}
                title="Use my location"
              >
                {isLocating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Navigation className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="border border-border rounded-lg max-h-32 overflow-y-auto">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b border-border last:border-b-0"
                    onClick={() => selectSearchResult(r)}
                  >
                    <div className="font-medium text-foreground line-clamp-1">
                      {r.display_name?.split(",")[0]}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {r.display_name}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Map with center pin overlay */}
            <div className="relative rounded-lg border border-border overflow-hidden">
              <div
                ref={mapRef}
                className="z-0"
                style={{ height: "300px", width: "100%" }}
              />
              {/* Floating center pin — visible while panning (marker hides during drag) */}
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center z-[1000]"
                style={{ transition: "transform 0.15s ease" }}
              >
                <div className="flex flex-col items-center" style={{ transform: isPanning ? "translateY(-8px)" : "translateY(0)" }}>
                  <img src={pinDataUrl} alt="" className="w-10 h-10" style={{ marginBottom: "-4px", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }} />
                  <img src={`data:image/svg+xml;base64,${btoa(centerPinShadow)}`} alt="" className="w-5 h-1.5" style={{ opacity: isPanning ? 0.4 : 0.6 }} />
                </div>
              </div>
            </div>

            {/* Hint text */}
            <p className="text-xs text-muted-foreground text-center">
              Drag the map to move the pin to your exact location
            </p>

            {/* Selected location info */}
            {selectedLocation && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                <img src={LocationIcon} alt="Location" className="w-4 h-4 flex-shrink-0 dark:invert" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{selectedLocation.name}</p>
                  {selectedLocation.address && (
                    <p className="text-xs text-muted-foreground truncate">{selectedLocation.address}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={confirmLocation} disabled={!selectedLocation}>
              <img src={LocationIcon} alt="Location" className="w-4 h-4 mr-2 dark:invert" /> Confirm Location
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MapLocationPicker;
