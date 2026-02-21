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

// Custom marker icon

// Custom marker using the project's location icon
const locationIconSvg = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" fill="#e11d48"/></svg>`)}`;

const DefaultIcon = L.icon({
  iconUrl: locationIconSvg,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

L.Marker.prototype.options.icon = DefaultIcon;

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
  
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize map when dialog opens
  useEffect(() => {
    if (!open || !mapRef.current) return;

    // Small delay for dialog animation
    const timer = setTimeout(() => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const defaultCenter: [number, number] = selectedLocation 
        ? [selectedLocation.latitude, selectedLocation.longitude] 
        : [-6.7924, 39.2083]; // Dar es Salaam default

      const map = L.map(mapRef.current, {
        center: defaultCenter,
        zoom: selectedLocation ? 15 : 12,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      // Add marker if location exists
      if (selectedLocation) {
        markerRef.current = L.marker([selectedLocation.latitude, selectedLocation.longitude])
          .addTo(map)
          .bindPopup(selectedLocation.name);
      }

      // Click to place marker
      map.on("click", async (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        placeMarker(map, lat, lng);
        
        // Reverse geocode
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
          );
          const data = await res.json();
          const name = data.address?.city || data.address?.town || data.address?.village || data.address?.county || "Selected location";
          setSelectedLocation({
            latitude: lat,
            longitude: lng,
            name,
            address: data.display_name,
          });
        } catch {
          setSelectedLocation({
            latitude: lat,
            longitude: lng,
            name: "Selected location",
          });
        }
      });

      mapInstanceRef.current = map;

      // Fix blank tiles when map is inside a dialog
      setTimeout(() => {
        map.invalidateSize();
      }, 300);
    }, 200);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [open]);

  const placeMarker = (map: L.Map, lat: number, lng: number) => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng]).addTo(map);
    }
    map.setView([lat, lng], 15);
  };

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
      placeMarker(mapInstanceRef.current, lat, lng);
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
          placeMarker(mapInstanceRef.current, latitude, longitude);
        }

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          const name = data.address?.city || data.address?.town || data.address?.village || "Current location";
          setSelectedLocation({
            latitude,
            longitude,
            name,
            address: data.display_name,
          });
          setSearchQuery(name);
        } catch {
          setSelectedLocation({ latitude, longitude, name: "Current location" });
        }
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
            <DialogDescription>Search for a place or tap on the map</DialogDescription>
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

            {/* Map */}
            <div 
              ref={mapRef} 
              className="flex-1 min-h-[250px] rounded-lg border border-border overflow-hidden z-0"
            />

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
