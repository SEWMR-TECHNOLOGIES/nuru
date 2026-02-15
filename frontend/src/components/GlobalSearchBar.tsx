import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, CheckCircle, Calendar, Star, MapPin, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import type { SearchPerson, SearchEvent, SearchService } from '@/lib/api/search';

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.charAt(0).toUpperCase();
};

const isValidAvatar = (url?: string | null): boolean => {
  if (!url) return false;
  if (url.includes('unsplash.com') || url.includes('placeholder') || url.includes('randomuser.me')) return false;
  return true;
};

const extractImage = (item: any): string | null => {
  // Services: backend returns primary_image at top level
  if (item.primary_image) return item.primary_image;
  // Events: backend returns cover_image
  if (item.cover_image) return item.cover_image;
  // Fallback: check images array
  const imgs = item.images || item.gallery_images || [];
  if (imgs.length > 0) {
    const first = imgs[0];
    if (typeof first === 'string') return first;
    return first?.url || first?.image_url || first?.file_url || null;
  }
  // Final fallback
  if (item.image_url) return item.image_url;
  return null;
};

interface GlobalSearchBarProps {
  className?: string;
  autoFocus?: boolean;
  onNavigate?: () => void;
  fullScreen?: boolean;
}

const GlobalSearchBar = ({ className, autoFocus, onNavigate, fullScreen }: GlobalSearchBarProps) => {
  const navigate = useNavigate();
  const { query, setQuery, results, loading, isOpen, setIsOpen, totalResults } = useGlobalSearch();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [setIsOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [setIsOpen]);

  const handleNavigate = (path: string) => {
    setIsOpen(false);
    setQuery('');
    onNavigate?.();
    navigate(path);
  };

  const renderPerson = (person: SearchPerson) => (
    <button
      key={person.id}
      onClick={() => handleNavigate(`/u/${person.username}`)}
      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 rounded-lg transition-colors text-left group"
    >
      <Avatar className="w-10 h-10 flex-shrink-0">
        {isValidAvatar(person.avatar) && <AvatarImage src={person.avatar!} alt={person.full_name} />}
        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
          {getInitials(person.full_name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm text-foreground truncate">{person.full_name}</span>
          {person.is_verified && <CheckCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
        </div>
        <span className="text-xs text-muted-foreground">@{person.username}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );

  const renderEvent = (event: SearchEvent) => {
    const image = extractImage(event);
    return (
      <button
        key={event.id}
        onClick={() => handleNavigate(`/event/${event.id}`)}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 rounded-lg transition-colors text-left group"
      >
        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
          {image ? (
            <img src={image} alt={event.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Calendar className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-sm text-foreground truncate block">{event.title}</span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {event.start_date && (
              <span>{new Date(event.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            )}
            {event.location && (
              <>
                <span>•</span>
                <span className="truncate">{event.location}</span>
              </>
            )}
          </div>
        </div>
        {event.event_type?.name && (
          <Badge variant="secondary" className="text-[10px] hidden sm:inline-flex">{event.event_type.name}</Badge>
        )}
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  };

  const renderService = (service: SearchService) => {
    const image = extractImage(service);
    return (
      <button
        key={service.id}
        onClick={() => handleNavigate(`/services/view/${service.id}`)}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 rounded-lg transition-colors text-left group"
      >
        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
          {image ? (
            <img src={image} alt={service.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Star className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm text-foreground truncate">{service.title}</span>
            {(service.verified || service.verification_status === 'verified') && <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {(service.category_name || service.service_category?.name) && <span>{service.category_name || service.service_category?.name}</span>}
            {service.location && (
              <>
                <span>•</span>
                <div className="flex items-center gap-0.5">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{service.location}</span>
                </div>
              </>
            )}
          </div>
        </div>
        {service.rating != null && service.rating > 0 && (
          <div className="flex items-center gap-0.5 text-xs text-amber-500">
            <Star className="w-3 h-3 fill-current" />
            <span>{service.rating.toFixed(1)}</span>
          </div>
        )}
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  };

  const hasResults = totalResults > 0;
  const showDropdown = isOpen && query.trim().length > 0;

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (query.trim() && totalResults > 0) setIsOpen(true); }}
          placeholder="Search people, events, services..."
          className="pl-10 pr-10 py-2.5 bg-muted/50 border-0 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-xl text-sm"
          autoComplete="off"
          autoFocus={autoFocus}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setIsOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {showDropdown && (
        <div className={fullScreen
          ? "fixed left-0 right-0 top-[57px] bottom-0 bg-background z-50 overflow-hidden"
          : "absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg z-50 max-h-[70vh] overflow-hidden animate-fade-in"
        }>
          {loading && !hasResults ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
            </div>
          ) : !hasResults ? (
            <div className="py-8 text-center">
              <Search className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No results for "{query}"</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Try a different search term</p>
            </div>
          ) : (
            <Tabs defaultValue="all" className="w-full">
              <div className="px-3 pt-3 pb-1 border-b border-border/50">
                <TabsList className="w-full bg-muted/50 p-0.5 h-8">
                  <TabsTrigger value="all" className="text-xs flex-1 h-7">
                    All ({totalResults})
                  </TabsTrigger>
                  {results.people.length > 0 && (
                    <TabsTrigger value="people" className="text-xs flex-1 h-7">
                      People ({results.people.length})
                    </TabsTrigger>
                  )}
                  {results.events.length > 0 && (
                    <TabsTrigger value="events" className="text-xs flex-1 h-7">
                      Events ({results.events.length})
                    </TabsTrigger>
                  )}
                  {results.services.length > 0 && (
                    <TabsTrigger value="services" className="text-xs flex-1 h-7">
                      Services ({results.services.length})
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <div className={`overflow-y-auto p-2 ${fullScreen ? 'max-h-[calc(100vh-140px)]' : 'max-h-[55vh]'}`}>
                <TabsContent value="all" className="mt-0 space-y-1">
                  {results.people.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider px-3 py-1.5">People</p>
                      {results.people.slice(0, 3).map(renderPerson)}
                    </div>
                  )}
                  {results.events.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider px-3 py-1.5">Events</p>
                      {results.events.slice(0, 3).map(renderEvent)}
                    </div>
                  )}
                  {results.services.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider px-3 py-1.5">Services</p>
                      {results.services.slice(0, 3).map(renderService)}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="people" className="mt-0 space-y-1">
                  {results.people.map(renderPerson)}
                </TabsContent>

                <TabsContent value="events" className="mt-0 space-y-1">
                  {results.events.map(renderEvent)}
                </TabsContent>

                <TabsContent value="services" className="mt-0 space-y-1">
                  {results.services.map(renderService)}
                </TabsContent>
              </div>
            </Tabs>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearchBar;
