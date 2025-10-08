import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, MapPin, CheckCircle, Calendar, Users, Plus, Edit, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';

interface Service {
  id: string;
  title: string;
  category: string;
  description: string;
  price: string;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  verificationProgress?: number;
  verificationStatus?: 'pending' | 'in-progress' | 'verified' | 'not-started';
  images: string[];
  pastEvents: number;
  availability: string;
  location: string;
}

interface Review {
  id: string;
  author: string;
  avatar: string;
  rating: number;
  comment: string;
  date: string;
  eventType: string;
}

const MyServices = () => {
  useWorkspaceMeta({
    title: 'My Services',
    description: 'Manage your service offerings, track performance, and connect with event organizers.'
  });

  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);

  // Load services from localStorage
  useEffect(() => {
    const sampleServices = [
      {
        id: '1',
        title: 'Professional Wedding Photography',
        category: 'Photography',
        description: 'Capture your special moments with artistic flair. Specializing in candid shots, formal portraits, and artistic compositions.',
        price: '800,000 - 2,500,000 TZS',
        rating: 4.9,
        reviewCount: 47,
        isVerified: true,
        verificationProgress: 100,
        verificationStatus: 'verified' as const,
        images: [
          'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=300&fit=crop',
          'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=400&h=300&fit=crop'
        ],
        pastEvents: 52,
        availability: 'Available',
        location: 'New York, NY'
      },
      {
        id: '2',
        title: 'Event Planning & Coordination',
        category: 'Planning',
        description: 'Full-service event planning from concept to execution. Weddings, birthdays, corporate events, and more.',
        price: '1,200,000 - 5,000,000 TZS',
        rating: 4.8,
        reviewCount: 31,
        isVerified: false,
        verificationProgress: 60,
        verificationStatus: 'in-progress' as const,
        images: [
          'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=400&h=300&fit=crop'
        ],
        pastEvents: 38,
        availability: 'Booking for 2025',
        location: 'New York, NY'
      }
    ];

    const userServices = JSON.parse(localStorage.getItem('userServices') || '[]');
    const allServices = [...sampleServices, ...userServices];
    
    // Update verification status for all services
    const updatedServices = allServices.map(service => {
      const verificationData = localStorage.getItem(`verification-${service.id}`);
      if (verificationData) {
        const items = JSON.parse(verificationData);
        const completedCount = items.filter((item: any) => item.completed).length;
        const progress = (completedCount / items.length) * 100;
        
        let status: 'pending' | 'in-progress' | 'verified' | 'not-started' = 'not-started';
        if (progress === 100) status = 'verified';
        else if (progress > 0) status = 'in-progress';
        else status = 'not-started';
        
        return {
          ...service,
          verificationProgress: progress,
          verificationStatus: status,
          isVerified: progress === 100
        };
      }
      return service;
    });
    
    setServices(updatedServices);
  }, []);

  // Refresh verification progress periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const userServices = JSON.parse(localStorage.getItem('userServices') || '[]');
      const sampleServices = services.filter(s => s.id === '1' || s.id === '2');
      const allServices = [...sampleServices, ...userServices];
      
      const updatedServices = allServices.map(service => {
        const verificationData = localStorage.getItem(`verification-${service.id}`);
        if (verificationData) {
          const items = JSON.parse(verificationData);
          const completedCount = items.filter((item: any) => item.completed).length;
          const progress = (completedCount / items.length) * 100;
          
          let status: 'pending' | 'in-progress' | 'verified' | 'not-started' = 'not-started';
          if (progress === 100) status = 'verified';
          else if (progress > 0) status = 'in-progress';
          else status = 'not-started';
          
          return {
            ...service,
            verificationProgress: progress,
            verificationStatus: status,
            isVerified: progress === 100
          };
        }
        return service;
      });
      
      setServices(updatedServices);
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  const [reviews, setReviews] = useState<Review[]>([
    {
      id: '1',
      author: 'Jennifer Liu',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b5c5?w=150&h=150&fit=crop&crop=face',
      rating: 5,
      comment: 'Absolutely amazing photography! Sarah captured every special moment of our wedding day perfectly.',
      date: '2024-11-15',
      eventType: 'Wedding'
    },
    {
      id: '2',
      author: 'Michael Chen',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      rating: 5,
      comment: 'The event planning was flawless. Every detail was perfect and the day went smoothly.',
      date: '2024-10-28',
      eventType: 'Birthday Party'
    },
    {
      id: '3',
      author: 'Emily Davis',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      rating: 4,
      comment: 'Great photography service with quick delivery of edited photos. Highly recommend!',
      date: '2024-10-12',
      eventType: 'Graduation'
    }
  ]);

  // Save service data to localStorage for ServiceDetail component
  useEffect(() => {
    const serviceData = services.map(service => ({
      ...service,
      name: service.title,
      basePrice: service.price,
      totalReviews: service.reviewCount,
      yearsExperience: Math.floor(service.pastEvents / 12) + 2,
      verified: service.isVerified,
      pastEvents: Array.from({ length: Math.min(service.pastEvents, 5) }, (_, i) => ({
        name: `Event ${i + 1}`,
        date: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        type: service.category,
        rating: Math.floor(Math.random() * 2) + 4
      })),
      reviews: reviews.filter(r => Math.random() > 0.5).map(review => ({
        ...review,
        clientName: review.author
      })),
      packages: [
        {
          name: 'Basic',
          price: service.price.split(' - ')[0],
          features: ['Basic coverage', 'Digital delivery', '2 hours service']
        },
        {
          name: 'Premium',
          price: service.price.split(' - ')[1] || service.price,
          features: ['Extended coverage', 'Digital + Print delivery', 'Full day service', 'Additional edits']
        }
      ]
    }));
    localStorage.setItem('myServices', JSON.stringify(serviceData));
  }, [services, reviews]);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < Math.floor(rating)
            ? 'text-yellow-400 fill-current'
            : i < rating
            ? 'text-yellow-400 fill-current opacity-50'
            : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Services</h1>
          <p className="text-muted-foreground mt-1">Manage your service offerings and track performance</p>
        </div>
        <Button onClick={() => navigate('/services/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Add New Service
        </Button>
      </div>

      {/* Service Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Services</p>
                <p className="text-2xl font-bold">{services.length}</p>
              </div>
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Events</p>
                <p className="text-2xl font-bold">
                  {services.reduce((sum, service) => sum + service.pastEvents, 0)}
                </p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Rating</p>
                <p className="text-2xl font-bold">
                  {services.length > 0 && services.some(s => s.rating > 0)
                    ? (services.reduce((sum, service) => sum + service.rating, 0) / services.length).toFixed(1)
                    : '0.0'}
                </p>
              </div>
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Star className="w-5 h-5 text-yellow-600 fill-current" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Reviews</p>
                <p className="text-2xl font-bold">
                  {services.reduce((sum, service) => sum + service.reviewCount, 0)}
                </p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Services List */}
      <div className="space-y-6">
        {services.map((service) => (
          <Card key={service.id}>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Service Images */}
                <div className="w-full md:w-48 flex-shrink-0">
                  <div className="grid grid-cols-2 gap-2">
                    {service.images.map((image, index) => (
                      <img
                        key={index}
                        src={image}
                        alt={service.title}
                        className="w-full h-20 object-cover rounded-lg"
                      />
                    ))}
                  </div>
                </div>

                {/* Service Details */}
                <div className="flex-1">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="text-xl font-semibold">{service.title}</h3>
                        {service.verificationStatus === 'verified' && (
                          <Badge className="bg-green-600 gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Verified
                          </Badge>
                        )}
                        {service.verificationStatus === 'in-progress' && (
                          <Badge variant="outline" className="border-yellow-500 text-yellow-700 gap-1">
                            <Calendar className="w-3 h-3" />
                            In Progress
                          </Badge>
                        )}
                        {service.verificationStatus === 'pending' && (
                          <Badge variant="outline" className="border-orange-500 text-orange-700">
                            Pending Review
                          </Badge>
                        )}
                        {service.verificationStatus === 'not-started' && (
                          <Badge variant="outline" className="border-red-500 text-red-700">
                            Not Verified
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">{service.category}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/services/edit/${service.id}`)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => navigate(`/service/${service.id}`)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </div>

                  {/* Verification Progress - Full Width */}
                  {service.verificationStatus !== 'verified' && (
                    <div className="mb-4 p-3 bg-secondary/30 rounded-lg w-full">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium">Verification Progress</span>
                        <span className="text-xs text-muted-foreground">
                          {service.verificationProgress || 0}%
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1.5 mb-2">
                        <div 
                          className="bg-primary h-1.5 rounded-full transition-all"
                          style={{ width: `${service.verificationProgress || 0}%` }}
                        />
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => navigate(`/services/verify/${service.id}`)}
                      >
                        {service.verificationProgress && service.verificationProgress > 0 
                          ? 'Continue Verification' 
                          : 'Start Verification'}
                      </Button>
                    </div>
                  )}

                  <p className="text-muted-foreground mb-4">{service.description}</p>

                  <div className="grid md:grid-cols-2 gap-6 mb-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Price Range:</span>
                        <span className="text-muted-foreground">{service.price}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Location:</span>
                        <span className="text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {service.location}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Availability:</span>
                        <Badge className={service.availability === 'Available' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                          {service.availability}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Rating:</span>
                        <div className="flex items-center gap-1">
                          {renderStars(service.rating)}
                          <span className="text-muted-foreground ml-1">
                            {service.rating} ({service.reviewCount} reviews)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Past Events:</span>
                        <span className="text-muted-foreground">{service.pastEvents}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Reviews */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="flex gap-4 p-4 border rounded-lg">
                <Avatar>
                  <AvatarImage src={review.avatar} />
                  <AvatarFallback>{review.author.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">{review.author}</h4>
                    <div className="flex items-center">
                      {renderStars(review.rating)}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {review.eventType}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mb-2">{review.comment}</p>
                  <p className="text-sm text-muted-foreground">{review.date}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MyServices;