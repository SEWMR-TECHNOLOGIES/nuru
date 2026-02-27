import React, { useState, useCallback, useEffect, useRef } from "react";
import { RefreshCw, Star, Loader2, Check, Plus } from "lucide-react";
import { VerifiedServiceBadge } from '@/components/ui/verified-badge';
import LocationIcon from '@/assets/icons/location-icon.svg';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { servicesApi } from "@/lib/api";

interface RecommendedService {
  id: string;
  title: string;
  name?: string;
  short_description?: string;
  provider?: { id: string; name: string; avatar?: string; verified?: boolean };
  service_category?: { id: string; name: string; icon?: string };
  service_type?: { id: string; name: string };
  min_price?: number;
  max_price?: number;
  currency?: string;
  price_display?: string;
  location?: string;
  primary_image?: { url: string; thumbnail_url?: string; alt?: string } | string;
  images?: Array<{ url: string; thumbnail_url?: string; is_primary?: boolean }>;
  image_url?: string;
  cover_image?: string;
  rating?: number;
  review_count?: number;
  verified?: boolean;
  verification_status?: string;
  availability?: string;
}

interface EventRecommendationsProps {
  eventTypeId: string;
  eventTypeName?: string;
  location?: string;
  budget?: string;
  selectedServiceIds?: string[];
  onToggleService?: (serviceId: string, service: RecommendedService) => void;
}

const EventRecommendations: React.FC<EventRecommendationsProps> = ({
  eventTypeId,
  eventTypeName,
  location,
  budget,
  selectedServiceIds = [],
  onToggleService,
}) => {
  const [recommendations, setRecommendations] = useState<RecommendedService[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRecommendations = useCallback(async (silent = false) => {
    if (!eventTypeId) return;

    if (!silent) setLoading(true);
    try {
      const params: Record<string, any> = {
        event_type_id: eventTypeId,
        sort_by: "rating",
        limit: 6,
      };
      if (budget) {
        const budgetNum = parseFloat(String(budget).replace(/[^0-9.]/g, ""));
        if (!isNaN(budgetNum) && budgetNum > 0) {
          params.max_price = budgetNum;
        }
      }

      if (location) params.location = location;
      const response = await servicesApi.search(params);
      if (response.success && response.data?.services) {
        if (response.data.services.length > 0) {
          setRecommendations(response.data.services);
        } else if (location) {
          // Fallback without location
          const { location: _, ...fallbackParams } = params;
          const fallback = await servicesApi.search(fallbackParams);
          if (fallback.success && fallback.data?.services) {
            setRecommendations(fallback.data.services);
            // If still empty, try without budget filter too
            if (fallback.data.services.length === 0 && params.max_price) {
              const { max_price: __, ...broadParams } = fallbackParams;
              const broad = await servicesApi.search(broadParams);
              if (broad.success && broad.data?.services) {
                setRecommendations(broad.data.services);
              }
            }
          }
        } else if (params.max_price) {
          // No results with budget — try without budget
          const { max_price: _, ...noBudgetParams } = params;
          const fallback = await servicesApi.search(noBudgetParams);
          if (fallback.success && fallback.data?.services) {
            setRecommendations(fallback.data.services);
          }
        }
      }
    } catch {
      // Silent — no toast
    } finally {
      if (!silent) setLoading(false);
      setFetched(true);
    }
  }, [eventTypeId, location, budget]);

  // Debounced effect: only re-fetch after 800ms of no changes
  useEffect(() => {
    if (!eventTypeId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchRecommendations(fetched); // silent if already fetched once
    }, 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [eventTypeId, location, budget, fetchRecommendations, fetched]);

  const getServiceImage = (service: RecommendedService): string | undefined => {
    if (service.primary_image) {
      if (typeof service.primary_image === "string") return service.primary_image;
      return service.primary_image.thumbnail_url || service.primary_image.url;
    }
    if (service.images?.length) {
      const primary = service.images.find(i => i.is_primary);
      const img = primary || service.images[0];
      return img.thumbnail_url || img.url;
    }
    return service.image_url || service.cover_image || undefined;
  };

  const isVerified = (service: RecommendedService) =>
    service.verified || service.verification_status === "verified";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base md:text-lg">Service Providers</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => fetchRecommendations(false)} disabled={loading || !eventTypeId}>
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Finding...</>
            ) : (
              <><RefreshCw className="w-4 h-4 mr-2" />{fetched ? "Refresh" : "Find Providers"}</>
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {eventTypeName
            ? `Select service providers for your ${eventTypeName.toLowerCase()}`
            : "Select an event type to discover service providers"}
        </p>
      </CardHeader>
      <CardContent>
        {!fetched && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Click "Find Providers" to discover service providers for your event</p>
          </div>
        )}

        {fetched && recommendations.length === 0 && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No service providers found matching your criteria.</p>
            <p className="text-xs mt-1">Try adjusting your event type, location, or budget.</p>
          </div>
        )}

        {recommendations.length > 0 && (
          <>
            {selectedServiceIds.length > 0 && (
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">{selectedServiceIds.length} selected</Badge>
              </div>
            )}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommendations.map((service) => {
                const imgUrl = getServiceImage(service);
                const selected = selectedServiceIds.includes(service.id);

                return (
                  <div
                    key={service.id}
                    className={`border rounded-lg overflow-hidden transition-all cursor-pointer group ${
                      selected
                        ? "border-primary ring-2 ring-primary/20 shadow-md"
                        : "border-border hover:shadow-md hover:border-primary/30"
                    }`}
                    onClick={() => onToggleService?.(service.id, service)}
                  >
                    <div className="relative h-32 bg-muted">
                      {imgUrl ? (
                        <img src={imgUrl} alt={service.title || service.name || "Service"} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No image</div>
                      )}
                      <div className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                        selected
                          ? "bg-primary text-primary-foreground shadow-lg"
                          : "bg-background/80 text-muted-foreground border border-border opacity-0 group-hover:opacity-100"
                      }`}>
                        {selected ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </div>
                    </div>
                    <div className="p-3 space-y-1.5">
                      <h4 className="font-medium text-sm leading-tight line-clamp-2 flex items-center gap-1">{service.title || service.name} {isVerified(service) && <VerifiedServiceBadge size="xs" />}</h4>
                      {service.service_category?.name && (
                        <p className="text-xs text-muted-foreground">{service.service_category.name}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {service.rating != null && (
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            {service.rating.toFixed(1)}
                            {service.review_count != null && (
                              <span className="text-muted-foreground/70">({service.review_count})</span>
                            )}
                          </span>
                        )}
                        {service.location && (
                          <span className="flex items-center gap-1 truncate">
                            <img src={LocationIcon} alt="Location" className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{service.location}</span>
                          </span>
                        )}
                      </div>
                      {service.price_display && (
                        <p className="text-sm font-semibold text-primary">{service.price_display}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default EventRecommendations;
