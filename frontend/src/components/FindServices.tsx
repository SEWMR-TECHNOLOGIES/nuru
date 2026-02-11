import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, CheckCircle, Eye, MessageCircle, Loader2 } from 'lucide-react';
import LocationIcon from '@/assets/icons/location-icon.svg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useServices } from '@/data/useUserServices';
import { Skeleton } from '@/components/ui/skeleton';

const FindServices = () => {
  useWorkspaceMeta({
    title: 'Find Services',
    description: 'Discover trusted service providers for photography, catering, decoration, and more.'
  });

  const navigate = useNavigate();
  const { services, loading, error, refetch } = useServices();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [assignMode, setAssignMode] = useState(false);
  const [assignServiceId, setAssignServiceId] = useState<string | null>(null);
  const [assignEventId, setAssignEventId] = useState<string | null>(null);

  useEffect(() => {
    const assignServiceIdLocal = localStorage.getItem('assignServiceId');
    const assignEventIdLocal = localStorage.getItem('assignEventId');
    if (assignServiceIdLocal && assignEventIdLocal) {
      setAssignMode(true);
      setAssignServiceId(assignServiceIdLocal);
      setAssignEventId(assignEventIdLocal);
    }
  }, []);

  const handleAssignProvider = (providerName: string) => {
    if (!assignServiceId || !assignEventId) return;
    // This would call an API to assign the provider
    localStorage.removeItem('assignServiceId');
    localStorage.removeItem('assignEventId');
    navigate(`/event-management/${assignEventId}`);
  };

  // Get unique categories and locations from services
  const categories = [...new Set(services.map(s => s.service_category?.name).filter(Boolean))] as string[];
  const locations = [...new Set(services.map(s => s.location).filter(Boolean))] as string[];

  const filteredProviders = services.filter(provider => {
    const matchesSearch = provider.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         provider.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || provider.service_category?.name === selectedCategory;
    const matchesLocation = selectedLocation === 'all' || provider.location?.includes(selectedLocation);
    
    return matchesSearch && matchesCategory && matchesLocation;
  });

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
        }`}
      />
    ));
  };

  const formatPrice = (provider: any) => {
    if (provider.min_price && provider.max_price) {
      return `${provider.min_price.toLocaleString()} - ${provider.max_price.toLocaleString()} ${provider.currency || 'TZS'}`;
    }
    if (provider.min_price) {
      return `From ${provider.min_price.toLocaleString()} ${provider.currency || 'TZS'}`;
    }
    return 'Price on request';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-10 w-48" />
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex gap-6">
                  <Skeleton className="w-32 h-32 rounded-lg" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Find Services</h1>
          <p className="text-muted-foreground">Discover trusted service providers for your events</p>
        </div>
        <div className="text-center py-12">
          <p className="text-destructive mb-4">Failed to load services. Please try again.</p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">
          {assignMode ? 'Select a Service Provider' : 'Find Services'}
        </h1>
        <p className="text-muted-foreground">
          {assignMode 
            ? 'Choose a provider to assign to your service' 
            : 'Discover trusted service providers for your events'}
        </p>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search services..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category!}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map(location => (
                  <SelectItem key={location} value={location!}>{location}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {filteredProviders.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              {services.length === 0 
                ? 'No service providers available yet.' 
                : 'No service providers found matching your criteria.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:gap-6">
          {filteredProviders.map((provider) => (
            <Card 
              key={provider.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/services/view/${provider.id}`)}
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="w-full sm:w-28 h-32 sm:h-28 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {((provider as any).primary_image || (provider.images && provider.images.length > 0)) ? (
                      <img
                        src={(provider as any).primary_image || (typeof provider.images?.[0] === 'string' ? provider.images[0] : provider.images?.[0]?.url)}
                        alt={provider.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                        {provider.title?.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-lg font-semibold truncate">{provider.title}</h3>
                      {provider.verification_status === 'verified' && (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <div className="flex items-center gap-1">
                        {renderStars(provider.rating || 0)}
                        <span className="ml-1 font-medium text-sm">{provider.rating || 0}</span>
                        <span className="text-muted-foreground text-sm">({provider.review_count || 0})</span>
                      </div>
                      {provider.service_category?.name && (
                        <Badge variant="secondary" className="text-xs">{provider.service_category.name}</Badge>
                      )}
                    </div>
                    
                    <p className="text-muted-foreground mb-2 line-clamp-2 text-sm">{provider.description}</p>
                    
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-3">
                      {provider.location && (
                        <span className="flex items-center gap-1">
                          <img src={LocationIcon} alt="Location" className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{provider.location}</span>
                        </span>
                      )}
                      <span className="font-medium text-primary">{formatPrice(provider)}</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {assignMode ? (
                        <>
                          <Button 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAssignProvider(provider.title);
                            }}
                          >
                            Assign Provider
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/provider-chat?providerId=${(provider as any).provider?.id || provider.user_id || provider.id}&providerName=${encodeURIComponent(provider.title)}&serviceId=${assignServiceId}&eventId=${assignEventId}`);
                            }}
                          >
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Chat
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/services/view/${provider.id}`);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Profile
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/provider-chat?providerId=${(provider as any).provider?.id || provider.user_id || provider.id}&providerName=${encodeURIComponent(provider.title)}&serviceId=${provider.id}`);
                            }}
                          >
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Chat
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FindServices;
