import React, { useState, useCallback } from "react";
import { Sparkles, Star, MapPin, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { servicesApi, showApiErrors, showCaughtError } from "@/lib/api";
import { toast } from "sonner";

interface RecommendedService {
  id: string;
  title: string;
  short_description?: string;
  provider?: {
    id: string;
    name: string;
    avatar?: string;
    verified?: boolean;
  };
  service_category?: {
    id: string;
    name: string;
    icon?: string;
  };
  min_price?: number;
  max_price?: number;
  currency?: string;
  price_display?: string;
  location?: string;
  primary_image?: {
    url: string;
    thumbnail_url?: string;
    alt?: string;
  };
  rating?: number;
  review_count?: number;
  verified?: boolean;
  availability?: string;
}

interface EventRecommendationsProps {
  eventTypeId: string;
  eventTypeName?: string;
  location?: string;
  budget?: string;
}

const EventRecommendations: React.FC<EventRecommendationsProps> = ({
  eventTypeId,
  eventTypeName,
  location,
  budget,
}) => {
  const [recommendations, setRecommendations] = useState<RecommendedService[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchRecommendations = useCallback(async () => {
    if (!eventTypeId) {
      toast.error("Please select an event type first");
      return;
    }

    setLoading(true);
    try {
      const params: Record<string, any> = {
        event_type_id: eventTypeId,
        sort_by: "rating" as const,
        limit: 6,
        available: true,
      };
      if (location) params.location = location;
      if (budget) {
        const budgetNum = parseFloat(String(budget).replace(/[^0-9.]/g, ""));
        if (!isNaN(budgetNum) && budgetNum > 0) {
          params.max_price = budgetNum;
        }
      }

      const response = await servicesApi.search(params);
      if (response.success && response.data?.services) {
        setRecommendations(response.data.services);
        if (response.data.services.length === 0) {
          toast.info("No service providers found for this event type yet");
        }
      } else {
        showApiErrors(response, "Failed to fetch recommendations");
      }
    } catch (err: any) {
      showCaughtError(err, "Failed to fetch recommendations");
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [eventTypeId, location, budget]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Service Recommendations
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchRecommendations}
            disabled={loading || !eventTypeId}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Finding...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                {fetched ? "Refresh" : "Get Recommendations"}
              </>
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {eventTypeName
            ? `Find top-rated service providers for your ${eventTypeName.toLowerCase()}`
            : "Select an event type to get tailored service provider recommendations"}
        </p>
      </CardHeader>
      <CardContent>
        {!fetched && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              Click "Get Recommendations" to discover service providers perfect for your event
            </p>
          </div>
        )}

        {fetched && recommendations.length === 0 && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No service providers found matching your criteria.</p>
            <p className="text-xs mt-1">Try adjusting your event type, location, or budget.</p>
          </div>
        )}

        {recommendations.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.map((service) => (
              <div
                key={service.id}
                className="border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                {service.primary_image?.url && (
                  <img
                    src={service.primary_image.thumbnail_url || service.primary_image.url}
                    alt={service.primary_image.alt || service.title}
                    className="w-full h-32 object-cover"
                  />
                )}
                <div className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-sm leading-tight line-clamp-2">
                      {service.title}
                    </h4>
                    {service.verified && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        Verified
                      </Badge>
                    )}
                  </div>

                  {service.provider?.name && (
                    <p className="text-xs text-muted-foreground">
                      by {service.provider.name}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {service.rating != null && (
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        {service.rating.toFixed(1)}
                        {service.review_count != null && (
                          <span>({service.review_count})</span>
                        )}
                      </span>
                    )}
                    {service.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {service.location}
                      </span>
                    )}
                  </div>

                  {service.price_display && (
                    <p className="text-sm font-semibold text-primary">
                      {service.price_display}
                    </p>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full mt-1"
                    onClick={() => window.open(`/service/${service.id}`, "_blank")}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EventRecommendations;
