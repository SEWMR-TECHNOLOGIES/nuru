import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, Loader2, SlidersHorizontal, X, ChevronRight, MapPin, SearchX, LocateFixed } from 'lucide-react';
import { VerifiedServiceBadge } from '@/components/ui/verified-badge';
import LocationIcon from '@/assets/icons/location-icon.svg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceCategories } from '@/data/useServiceCategories';
import { servicesApi, type ServiceQueryParams } from '@/lib/api/services';
import { formatPrice } from '@/utils/formatPrice';
import type { UserService } from '@/lib/api/types';

// ── Skeleton loader ──
const ServiceCardSkeleton = () => (
  <div className="bg-card border border-border rounded-xl overflow-hidden">
    <Skeleton className="w-full aspect-[16/10]" />
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-full" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  </div>
);

const PAGE_SIZE = 20;

// ── Module-level cache ──
interface FindServicesCache {
  services: UserService[];
  totalResults: number;
  locations: Array<{ name: string; count: number }>;
  maxPrice: number;
  hasMore: boolean;
  ts: number;
}
let _findServicesCache: FindServicesCache | null = null;

const FindServices = () => {
  useWorkspaceMeta({
    title: 'Find Services',
    description: 'Discover trusted service providers for photography, catering, decoration, and more.'
  });

  const navigate = useNavigate();
  const { categories: apiCategories, loading: categoriesLoading } = useServiceCategories();

  const cached = _findServicesCache;

  // State
  const [services, setServices] = useState<UserService[]>(cached?.services || []);
  const [loading, setLoading] = useState(!cached);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [sortBy, setSortBy] = useState<ServiceQueryParams['sort_by']>('relevance');
  const [locations, setLocations] = useState<Array<{ name: string; count: number }>>(cached?.locations || []);
  const [totalResults, setTotalResults] = useState(cached?.totalResults || 0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? true);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, cached?.maxPrice || 10000000]);
  const [maxPriceAvailable, setMaxPriceAvailable] = useState(cached?.maxPrice || 10000000);
  const [showPriceFilter, setShowPriceFilter] = useState(false);
  const [userLat, setUserLat] = useState<number | undefined>();
  const [userLng, setUserLng] = useState<number | undefined>();
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const initialLoad = useRef(!cached);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Assign mode (from event management)
  const [assignMode, setAssignMode] = useState(false);
  const [assignServiceId, setAssignServiceId] = useState<string | null>(null);
  const [assignEventId, setAssignEventId] = useState<string | null>(null);

  useEffect(() => {
    const sid = localStorage.getItem('assignServiceId');
    const eid = localStorage.getItem('assignEventId');
    if (sid && eid) {
      setAssignMode(true);
      setAssignServiceId(sid);
      setAssignEventId(eid);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset pagination when filters change (skip initial mount to preserve cache)
  const hasMounted = useRef(false);
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    setCurrentPage(1);
    setHasMore(true);
  }, [debouncedSearch, selectedCategory, selectedLocation, sortBy, priceRange, userLat, userLng]);

  // Build query params
  const buildParams = useCallback((page: number): ServiceQueryParams => {
    const params: ServiceQueryParams = { limit: PAGE_SIZE, page, sort_by: sortBy };
    if (debouncedSearch) params.search = debouncedSearch;
    if (selectedCategory !== 'all') params.category_id = selectedCategory;
    if (selectedLocation !== 'all') params.location = selectedLocation;
    if (priceRange[0] > 0) params.min_price = priceRange[0];
    if (priceRange[1] < maxPriceAvailable) params.max_price = priceRange[1];
    if (userLat && userLng) {
      params.lat = userLat;
      params.lng = userLng;
      params.radius_km = 100;
    }
    return params;
  }, [debouncedSearch, selectedCategory, selectedLocation, sortBy, priceRange, maxPriceAvailable, userLat, userLng]);

  // Fetch services
  const fetchServices = useCallback(async (page: number, append = false) => {
    if (!append) {
      if (initialLoad.current) setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const params = buildParams(page);
      const response = await servicesApi.search(params);
      if (response.success) {
        const data = response.data as any;
        const newServices = data.services || [];

        const updatedServices = append ? [...services, ...newServices] : newServices;
        const updatedTotal = data.pagination?.total_items || newServices.length;
        const updatedHasMore = data.pagination?.has_next ?? newServices.length === PAGE_SIZE;

        if (append) {
          setServices(updatedServices);
        } else {
          setServices(newServices);
        }

        setTotalResults(updatedTotal);
        setHasMore(updatedHasMore);

        // Extract locations from filters
        let updatedLocations = locations;
        if (data.filters?.locations) {
          updatedLocations = data.filters.locations;
          setLocations(updatedLocations);
        } else if (!append) {
          const locs = [...new Set((newServices).map((s: any) => s.location).filter(Boolean))];
          updatedLocations = locs.map((l: string) => ({ name: l, count: 0 }));
          setLocations(updatedLocations);
        }

        // Extract price range from filters
        let updatedMaxPrice = maxPriceAvailable;
        if (data.filters?.price_range && !append) {
          const max = data.filters.price_range.max || 10000000;
          updatedMaxPrice = max;
          setMaxPriceAvailable(max);
          if (priceRange[1] === 10000000 || priceRange[1] > max) {
            setPriceRange([priceRange[0], max]);
          }
        }

        // Update module-level cache (only for first page with no filters)
        if (!append && page === 1 && !debouncedSearch && selectedCategory === 'all' && selectedLocation === 'all') {
          _findServicesCache = {
            services: newServices,
            totalResults: updatedTotal,
            locations: updatedLocations,
            maxPrice: updatedMaxPrice,
            hasMore: updatedHasMore,
            ts: Date.now(),
          };
        }
      } else {
        setError(response.message || 'Failed to load services');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      initialLoad.current = false;
    }
  }, [buildParams, priceRange, services, locations, maxPriceAvailable, debouncedSearch, selectedCategory, selectedLocation]);

  // Initial fetch & filter-change fetch
  useEffect(() => {
    fetchServices(1, false);
  }, [debouncedSearch, selectedCategory, selectedLocation, sortBy, priceRange, userLat, userLng]);

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          const nextPage = currentPage + 1;
          setCurrentPage(nextPage);
          fetchServices(nextPage, true);
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, loadingMore, currentPage, fetchServices]);

  // Enable user location
  const toggleLocation = () => {
    if (locationEnabled) {
      setLocationEnabled(false);
      setUserLat(undefined);
      setUserLng(undefined);
      return;
    }

    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setLocationEnabled(true);
        setLocatingUser(false);
      },
      () => {
        setLocatingUser(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleAssignProvider = (providerName: string) => {
    if (!assignServiceId || !assignEventId) return;
    localStorage.removeItem('assignServiceId');
    localStorage.removeItem('assignEventId');
    navigate(`/event-management/${assignEventId}`);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedLocation('all');
    setSortBy('relevance');
    setPriceRange([0, maxPriceAvailable]);
    setShowPriceFilter(false);
    setLocationEnabled(false);
    setUserLat(undefined);
    setUserLng(undefined);
  };

  const hasActiveFilters = selectedCategory !== 'all' || selectedLocation !== 'all' || searchTerm.trim() !== '' || priceRange[0] > 0 || priceRange[1] < maxPriceAvailable || locationEnabled;

  const getImageUrl = (provider: UserService) => {
    const p = provider as any;
    if (p.primary_image) return p.primary_image;
    if (provider.images && provider.images.length > 0) {
      const img = provider.images[0];
      return typeof img === 'string' ? img : img?.url;
    }
    return null;
  };

  const displayPrice = (provider: UserService) => {
    const currency = provider.currency || 'TZS';
    if (provider.min_price && provider.max_price) {
      return `${formatPrice(provider.min_price)} – ${formatPrice(provider.max_price)}`;
    }
    if (provider.min_price) {
      return `From ${formatPrice(provider.min_price)}`;
    }
    return 'Price on request';
  };

  // ── Loading state ──
  if (loading && initialLoad.current) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-72" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-9 w-24 rounded-full flex-shrink-0" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <ServiceCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">
          {assignMode ? 'Select a Service Provider' : 'Find Services'}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {assignMode
            ? 'Choose a provider to assign to your event'
            : `${totalResults} service providers available`}
        </p>
      </div>

      {/* ── Search bar ── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, category, or keyword..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 bg-card"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {/* Location toggle */}
        <Button
          variant={locationEnabled ? 'default' : 'outline'}
          size="icon"
          className="h-11 w-11 flex-shrink-0"
          onClick={toggleLocation}
          disabled={locatingUser}
          title={locationEnabled ? 'Location-based ranking active' : 'Enable location-based ranking'}
        >
          {locatingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
        </Button>
      </div>

      {/* ── Category pills (horizontal scroll) ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            selectedCategory === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          All Services
        </button>
        {apiCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id === selectedCategory ? 'all' : cat.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              selectedCategory === cat.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {cat.icon && <span className="mr-1.5">{cat.icon}</span>}
            {cat.name}
            {cat.service_count ? <span className="ml-1.5 opacity-70">({cat.service_count})</span> : null}
          </button>
        ))}
      </div>

      {/* ── Filters row ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={selectedLocation} onValueChange={setSelectedLocation}>
          <SelectTrigger className="w-auto min-w-[140px] h-9 bg-card text-sm">
            <MapPin className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map(loc => (
              <SelectItem key={loc.name} value={loc.name}>
                {loc.name} {loc.count > 0 && `(${loc.count})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy || 'relevance'} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="w-auto min-w-[140px] h-9 bg-card text-sm">
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">Most Relevant</SelectItem>
            <SelectItem value="rating">Highest Rated</SelectItem>
            <SelectItem value="reviews">Most Reviewed</SelectItem>
            <SelectItem value="price_low">Price: Low → High</SelectItem>
            <SelectItem value="price_high">Price: High → Low</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
          </SelectContent>
        </Select>

        {/* Price range toggle */}
        <Button
          variant={showPriceFilter ? 'secondary' : 'outline'}
          size="sm"
          className="h-9 text-sm"
          onClick={() => setShowPriceFilter(!showPriceFilter)}
        >
          Price Range
        </Button>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-muted-foreground h-9">
            <X className="w-3 h-3 mr-1" /> Clear filters
          </Button>
        )}
      </div>

      {/* ── Price range slider ── */}
      {showPriceFilter && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">Price Range</span>
            <span className="text-foreground font-semibold">
              {formatPrice(priceRange[0])} – {formatPrice(priceRange[1])}
            </span>
          </div>
          <Slider
            min={0}
            max={maxPriceAvailable}
            step={50000}
            value={priceRange}
            onValueChange={(val) => setPriceRange(val as [number, number])}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatPrice(0)}</span>
            <span>{formatPrice(maxPriceAvailable)}</span>
          </div>
        </div>
      )}

      {/* Location active indicator */}
      {locationEnabled && (
        <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
          <LocateFixed className="w-3.5 h-3.5" />
          <span>Showing services nearest to your location first</span>
        </div>
      )}

      {/* ── Error state ── */}
      {error && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-destructive mb-3">{error}</p>
          <Button onClick={() => fetchServices(1)} size="sm">Retry</Button>
        </div>
      )}

      {/* ── Empty state ── */}
      {!error && services.length === 0 && !loading && !loadingMore && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <SearchX className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">No services found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {hasActiveFilters ? 'Try adjusting your filters or search query' : 'Service providers will appear here once they register'}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>Clear Filters</Button>
          )}
        </div>
      )}

      {/* ── Service grid or inline skeleton during filter reload ── */}
      {loading && !initialLoad.current && !loadingMore && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <ServiceCardSkeleton key={`bg-${i}`} />)}
        </div>
      )}
      {services.length > 0 && !(loading && !initialLoad.current && !loadingMore) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((provider) => {
            const imageUrl = getImageUrl(provider);
            return (
              <div
                key={provider.id}
                onClick={() => navigate(`/services/view/${provider.id}`)}
                className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer group hover:shadow-md transition-all duration-200"
              >
                {/* Image */}
                <div className="relative aspect-[16/10] bg-muted overflow-hidden">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={provider.title}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-3xl font-bold text-muted-foreground/40">
                        {provider.title?.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* No overlay badge – verification shown inline below */}

                  {/* Category tag */}
                  {provider.service_category?.name && (
                    <div className="absolute bottom-2.5 left-2.5">
                      <Badge variant="secondary" className="bg-card/90 backdrop-blur-sm border-0 text-[11px] px-2 py-0.5 shadow-sm">
                        {provider.service_category.name}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-3.5 space-y-2">
                  {/* Title + rating */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground text-[15px] leading-tight line-clamp-1 flex items-center gap-1.5">
                      {provider.title}
                      {provider.verification_status === 'verified' && (
                        <VerifiedServiceBadge size="sm" />
                      )}
                    </h3>
                    {(provider.rating ?? 0) > 0 && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Star className="w-3.5 h-3.5 fill-[hsl(var(--nuru-yellow))] text-[hsl(var(--nuru-yellow))]" />
                        <span className="text-sm font-medium text-foreground">{provider.rating}</span>
                        {(provider.review_count ?? 0) > 0 && (
                          <span className="text-xs text-muted-foreground">({provider.review_count})</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Location */}
                  {provider.location && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <img src={LocationIcon} alt="" className="w-3 h-3 flex-shrink-0 opacity-70" />
                      <span className="text-xs truncate">{provider.location}</span>
                    </div>
                  )}

                  {/* Description */}
                  {provider.short_description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {provider.short_description}
                    </p>
                  )}

                  {/* Price + action */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/50">
                    <span className="text-sm font-semibold text-foreground">
                      {displayPrice(provider)}
                    </span>
                    {assignMode ? (
                      <Button
                        size="sm"
                        className="h-7 text-xs px-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAssignProvider(provider.title);
                        }}
                      >
                        Assign
                      </Button>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {/* Loading more skeleton */}
      {loadingMore && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <ServiceCardSkeleton key={`more-${i}`} />)}
        </div>
      )}

      {/* End of results */}
      {!hasMore && services.length > 0 && (
        <p className="text-center text-xs text-muted-foreground py-4">
          You've seen all {totalResults} services
        </p>
      )}

    </div>
  );
};

export default FindServices;
