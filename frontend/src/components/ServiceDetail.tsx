import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Calendar, MapPin, CheckCircle, Award, Users, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ServiceData {
  id: string;
  name: string;
  category: string;
  description: string;
  basePrice: string;
  rating: number;
  totalReviews: number;
  location: string;
  yearsExperience: number;
  verified: boolean;
  availability: string;
  images: string[];
  pastEvents: Array<{
    name: string;
    date: string;
    type: string;
    rating: number;
  }>;
  reviews: Array<{
    id: string;
    clientName: string;
    rating: number;
    comment: string;
    date: string;
    eventType: string;
  }>;
  packages: Array<{
    name: string;
    price: string;
    features: string[];
  }>;
}

const ServiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState<ServiceData | null>(null);

  useEffect(() => {
    const services = JSON.parse(localStorage.getItem('myServices') || '[]');
    const foundService = services.find((s: ServiceData) => s.id === id);
    setService(foundService || null);
  }, [id]);

  if (!service) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Service not found</p>
      </div>
    );
  }

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/my-services')}
          className="hover:bg-muted"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Services
        </Button>
      </div>

      {/* Service Hero */}
      <Card className="overflow-hidden">
        <div className="h-48 bg-gradient-to-r from-primary/10 to-primary/20 relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-foreground mb-2">{service.name}</h1>
              <p className="text-muted-foreground">{service.category}</p>
            </div>
          </div>
        </div>
        
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1">
                  {renderStars(service.rating)}
                  <span className="ml-2 font-semibold">{service.rating}</span>
                  <span className="text-muted-foreground">({service.totalReviews} reviews)</span>
                </div>
                {service.verified && (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>
              
              <p className="text-muted-foreground mb-4">{service.description}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="font-medium">Base Price</p>
                  <p className="text-muted-foreground">{service.basePrice}</p>
                </div>
                <div>
                  <p className="font-medium">Experience</p>
                  <p className="text-muted-foreground">{service.yearsExperience} years</p>
                </div>
                <div>
                  <p className="font-medium">Location</p>
                  <p className="text-muted-foreground">{service.location}</p>
                </div>
                <div>
                  <p className="font-medium">Availability</p>
                  <p className="text-muted-foreground">{service.availability}</p>
                </div>
              </div>
            </div>
            
            <div className="w-full md:w-80">
              <Card>
                <CardHeader>
                  <CardTitle>Service Packages</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {service.packages.map((pkg, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">{pkg.name}</h4>
                        <span className="font-bold text-primary">{pkg.price}</span>
                      </div>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {pkg.features.map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Past Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Past Events ({service.pastEvents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {service.pastEvents.map((event, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">{event.name}</h4>
                  <p className="text-sm text-muted-foreground">{event.type} • {event.date}</p>
                </div>
                <div className="flex items-center gap-1">
                  {renderStars(event.rating)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reviews */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Client Reviews
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {service.reviews.map((review) => (
            <div key={review.id} className="border-b pb-4 last:border-b-0">
              <div className="flex items-start gap-4">
                <Avatar>
                  <AvatarFallback>{review.clientName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-medium">{review.clientName}</h4>
                      <p className="text-sm text-muted-foreground">{review.eventType} • {review.date}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {renderStars(review.rating)}
                    </div>
                  </div>
                  <p className="text-muted-foreground">{review.comment}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default ServiceDetail;