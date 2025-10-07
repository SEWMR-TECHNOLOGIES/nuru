import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Star, MapPin, CheckCircle, Eye, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const serviceProviders = [
  {
    id: '1',
    name: 'Elite Photography Studios',
    category: 'Photography',
    rating: 4.9,
    reviews: 127,
    location: 'Dar es Salaam',
    price: 'From TZS 300,000',
    verified: true,
    image: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=150&h=150&fit=crop&crop=face',
    description: 'Professional wedding and event photography with 8+ years experience'
  },
  {
    id: '2',
    name: 'Royal Events Decoration',
    category: 'Decoration',
    rating: 4.8,
    reviews: 89,
    location: 'Arusha',
    price: 'From TZS 500,000',
    verified: true,
    image: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=150&h=150&fit=crop',
    description: 'Luxury event decoration and styling for weddings, parties, and corporate events'
  },
  {
    id: '3',
    name: 'Master Chef Catering',
    category: 'Catering',
    rating: 4.7,
    reviews: 156,
    location: 'Mwanza',
    price: 'From TZS 15,000/person',
    verified: false,
    image: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=150&h=150&fit=crop',
    description: 'Authentic Tanzanian and international cuisine for all event sizes'
  },
  {
    id: '4',
    name: 'Sound & Lights Pro',
    category: 'Audio/Visual',
    rating: 4.9,
    reviews: 98,
    location: 'Dodoma',
    price: 'From TZS 200,000',
    verified: true,
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=150&h=150&fit=crop',
    description: 'Professional sound systems, lighting, and DJ services'
  }
];

const FindServices = () => {
  const navigate = useNavigate();
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

    const events = JSON.parse(localStorage.getItem('events') || '[]');
    const updatedEvents = events.map((event: any) => {
      if (event.id === assignEventId) {
        return {
          ...event,
          services: event.services.map((service: any) =>
            service.id === assignServiceId
              ? { ...service, providerName }
              : service
          )
        };
      }
      return event;
    });

    localStorage.setItem('events', JSON.stringify(updatedEvents));
    localStorage.removeItem('assignServiceId');
    localStorage.removeItem('assignEventId');
    navigate(`/event-management/${assignEventId}`);
  };

  const filteredProviders = serviceProviders.filter(provider => {
    const matchesSearch = provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         provider.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || provider.category === selectedCategory;
    const matchesLocation = selectedLocation === 'all' || provider.location.includes(selectedLocation);
    
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
                <SelectItem value="Photography">Photography</SelectItem>
                <SelectItem value="Decoration">Decoration</SelectItem>
                <SelectItem value="Catering">Catering</SelectItem>
                <SelectItem value="Audio/Visual">Audio/Visual</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="Dar es Salaam">Dar es Salaam</SelectItem>
                <SelectItem value="Arusha">Arusha</SelectItem>
                <SelectItem value="Mwanza">Mwanza</SelectItem>
                <SelectItem value="Dodoma">Dodoma</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="grid gap-6">
        {filteredProviders.map((provider) => (
          <Card 
            key={provider.id} 
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(`/service/${provider.id}`)}
          >
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-32 h-32 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  <img
                    src={provider.image}
                    alt={provider.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <div className="flex-1">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-semibold">{provider.name}</h3>
                        {provider.verified && (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 mb-3">
                        <div className="flex items-center gap-1">
                          {renderStars(provider.rating)}
                          <span className="ml-1 font-medium">{provider.rating}</span>
                          <span className="text-muted-foreground">({provider.reviews} reviews)</span>
                        </div>
                        <Badge variant="secondary">{provider.category}</Badge>
                      </div>
                      
                      <p className="text-muted-foreground mb-3">{provider.description}</p>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {provider.location}
                        </span>
                        <span className="font-medium text-primary">{provider.price}</span>
                      </div>

                      <div className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        Click card to view provider profile
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {assignMode ? (
                        <>
                          <Button 
                            size="sm" 
                            className="w-full md:w-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAssignProvider(provider.name);
                            }}
                          >
                            Assign Provider
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full md:w-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/provider-chat?providerId=${provider.id}&providerName=${encodeURIComponent(provider.name)}&providerImage=${encodeURIComponent(provider.image)}&serviceId=${assignServiceId}&eventId=${assignEventId}`);
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
                            className="w-full md:w-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/service/${provider.id}`);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Profile
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full md:w-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/provider-chat?providerId=${provider.id}&providerName=${encodeURIComponent(provider.name)}&providerImage=${encodeURIComponent(provider.image)}`);
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
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {filteredProviders.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No service providers found matching your criteria.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FindServices
