import { useNavigate } from 'react-router-dom';
import { Star, MapPin, CheckCircle, Calendar, Users, Plus, Edit, Eye, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useUserServices } from '@/data/useUserServices';
import { useState } from 'react';
import { ServiceLoadingSkeleton } from '@/components/ui/ServiceLoadingSkeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

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
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  images: string[];
  pastEvents: number;
  availability: string;
  location: string;
  serviceTypeId: string;       // ✅ Added
  serviceTypeName: string;     // ✅ Added
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
  const { services, loading, error, refetch } = useUserServices();

  const [reviews] = useState<Review[]>([
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

  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [packageForm, setPackageForm] = useState({
    name: '',
    description: '',
    features: '',
    price: ''
  });

  const handleAddPackage = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setPackageDialogOpen(true);
  };

  const handleSavePackage = () => {
    if (!selectedServiceId) return;

    const packages = JSON.parse(localStorage.getItem(`service_packages_${selectedServiceId}`) || '[]');
    const newPackage = {
      id: Date.now().toString(),
      ...packageForm,
      features: packageForm.features.split('\n').filter(f => f.trim()),
      createdAt: new Date().toISOString()
    };
    
    packages.push(newPackage);
    localStorage.setItem(`service_packages_${selectedServiceId}`, JSON.stringify(packages));

    toast({
      title: 'Package Added',
      description: 'Your service package has been created successfully.'
    });

    setPackageDialogOpen(false);
    setPackageForm({ name: '', description: '', features: '', price: '' });
    setSelectedServiceId(null);
  };

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

  if (loading) return <ServiceLoadingSkeleton />;
  if (error) return <p className="text-red-500">{error}</p>;

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

      {/* Stats Section */}
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
                {/* Images */}
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

                {/* Details */}
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className="text-xl font-semibold">{service.title}</h3>
                    <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                      {service.verificationStatus === 'verified' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddPackage(service.id)}
                        >
                          <Package className="w-4 h-4 mr-2" />
                          Add Package
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/services/edit/${service.id}`)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button size="sm" onClick={() => navigate(`/service/${service.id}`)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    {service.verificationStatus === 'verified' && (
                      <Badge className="bg-green-600 hover:bg-green-700 text-white gap-1.5 px-3 py-1 flex-shrink-0">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Verified
                      </Badge>
                    )}
                    {service.verificationStatus === 'pending' && (
                      <Badge variant="outline" className="border-orange-500 text-orange-700 bg-orange-50 gap-1.5 px-3 py-1 flex-shrink-0">
                        <Calendar className="w-3.5 h-3.5" />
                        Pending Verification
                      </Badge>
                    )}
                    {service.verificationStatus === 'rejected' && (
                      <Badge variant="outline" className="border-red-500 text-red-700 bg-red-50 px-3 py-1 flex-shrink-0">
                        Verification Rejected
                      </Badge>
                    )}
                    <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">{service.category}</Badge>
                    {service.serviceTypeName && (
                      <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 px-3 py-1 flex-shrink-0">
                        {service.serviceTypeName}
                      </Badge>
                    )}
                  </div>

                  {/* Verification Progress */}
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
                        onClick={() =>
                          navigate(`/services/verify/${service.id}/${service.serviceTypeId}`)
                        }
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
                        <Badge
                          className={
                            service.availability === 'Available'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-orange-100 text-orange-800'
                          }
                        >
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
                <Avatar className="flex-shrink-0">
                  <AvatarImage src={review.avatar} />
                  <AvatarFallback>{review.author.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                    <h4 className="font-medium">{review.author}</h4>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center">
                        {renderStars(review.rating)}
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {review.eventType}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-muted-foreground mb-2 break-words">{review.comment}</p>
                  <p className="text-sm text-muted-foreground">{review.date}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add Package Dialog */}
      <Dialog open={packageDialogOpen} onOpenChange={setPackageDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Service Package</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="package-name">Package Name</Label>
              <Input
                id="package-name"
                value={packageForm.name}
                onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                placeholder="e.g., Premium Wedding Package"
              />
            </div>
            <div>
              <Label htmlFor="package-description">Description</Label>
              <Textarea
                id="package-description"
                value={packageForm.description}
                onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })}
                placeholder="Brief description of what's included"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="package-features">Features (one per line)</Label>
              <Textarea
                id="package-features"
                value={packageForm.features}
                onChange={(e) => setPackageForm({ ...packageForm, features: e.target.value })}
                placeholder="Full day coverage&#10;Professional editing&#10;200+ final photos"
                rows={5}
              />
            </div>
            <div>
              <Label htmlFor="package-price">Price (TZS)</Label>
              <Input
                id="package-price"
                type="number"
                value={packageForm.price}
                onChange={(e) => setPackageForm({ ...packageForm, price: e.target.value })}
                placeholder="e.g., 2500000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPackageDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePackage}>
              Save Package
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyServices;