import { useNavigate } from 'react-router-dom';
import { Star, MapPin, CheckCircle, Calendar, Users, Plus, Edit, Eye, Package, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useUserServices } from '@/data/useUserServices';
import { useState, useEffect } from 'react';
import { ServiceLoadingSkeleton } from '@/components/ui/ServiceLoadingSkeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { showApiErrors, showCaughtError } from '@/lib/api';
import { userServicesApi } from '@/lib/api';
import type { ServiceReview } from '@/lib/api/types';

const MyServices = () => {
  useWorkspaceMeta({
    title: 'My Services',
    description: 'Manage your service offerings, track performance, and connect with event organizers.'
  });

  const navigate = useNavigate();
  const { services, loading, error, refetch } = useUserServices();

  
  // Reviews state - fetched from API
  const [reviews, setReviews] = useState<ServiceReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // Fetch reviews for first service when services load
  useEffect(() => {
    const fetchReviews = async () => {
      if (services.length > 0) {
        setReviewsLoading(true);
        try {
          const response = await userServicesApi.getReviews(services[0].id, { limit: 5 });
          if (response.success) {
            setReviews(response.data.reviews);
          }
        } catch {
          // ignore
        } finally {
          setReviewsLoading(false);
        }
      }
    };
    fetchReviews();
  }, [services]);
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [packageForm, setPackageForm] = useState({
    name: '',
    description: '',
    features: '',
    price: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddPackage = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setPackageDialogOpen(true);
  };

  const handleSavePackage = async () => {
    if (!selectedServiceId) return;

    if (!packageForm.name.trim()) {
      toast.error('Please provide a package name.');
      return;
    }
    if (!packageForm.description.trim()) {
      toast.error('Please include a brief description of this package.');
      return;
    }
    if (!packageForm.price || Number(packageForm.price) <= 0) {
      toast.error('Please enter a valid package price greater than zero.');
      return;
    }
    if (!packageForm.features.trim()) {
      toast.error('Please list at least one feature for this package.');
      return;
    }

    setIsSubmitting(true);
    try {
      const packageData = {
        name: packageForm.name.trim(),
        description: packageForm.description.trim(),
        price: Number(packageForm.price),
        features: packageForm.features.split(',').map(f => f.trim()).filter(Boolean),
      };

      const result = await userServicesApi.addPackage(selectedServiceId, packageData);

      if (showApiErrors(result, 'Failed to add package.')) {
        return;
      }

      toast.success(result.message || 'Package added successfully.');
      setPackageDialogOpen(false);
      setPackageForm({ name: '', description: '', features: '', price: '' });
      setSelectedServiceId(null);
    } catch (err: any) {
      showCaughtError(err);
    } finally {
      setIsSubmitting(false);
    }
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

  // Helper function to get image URL from service images
  const getImageUrl = (img: any): string => {
    if (typeof img === 'string') return img;
    if (img && typeof img === 'object' && img.url) return img.url;
    return '';
  };

  // Helper function to format price display (API returns snake_case)
  const formatPriceDisplay = (service: any): string => {
    if (service.min_price && service.max_price) {
      return `${service.min_price.toLocaleString()} - ${service.max_price.toLocaleString()} ${service.currency || 'TZS'}`;
    }
    if (service.min_price) {
      return `From ${service.min_price.toLocaleString()} ${service.currency || 'TZS'}`;
    }
    return 'Price on request';
  };

  // Helper to get category name (API returns category as string)
  const getCategoryName = (service: any): string => {
    if (service.category) return service.category;
    if (service.service_category?.name) return service.service_category.name;
    return 'Uncategorized';
  };

  // Helper to get service type name (API returns service_type_name as string)
  const getServiceTypeName = (service: any): string => {
    if (service.service_type_name) return service.service_type_name;
    if (service.service_type?.name) return service.service_type.name;
    return '';
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
                  {services.reduce((sum, service) => sum + (service.completed_events || 0), 0)}
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
                  {services.length > 0 && services.some(s => (s.rating || 0) > 0)
                    ? (services.reduce((sum, service) => sum + (service.rating || 0), 0) / services.length).toFixed(1)
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
                  {services.reduce((sum, service) => sum + (service.review_count || 0), 0)}
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
                    {(service.images || []).slice(0, 4).map((image, index) => (
                      <img
                        key={index}
                        src={getImageUrl(image)}
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
                      {service.verification_status === 'verified' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddPackage(service.id)}
                        >
                          <Package className="w-4 h-4 mr-2" />
                          Add Package
                        </Button>
                      )}
                      {service.verification_status !== 'verified' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/services/edit/${service.id}`)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      )}
                      <Button size="sm" onClick={() => navigate(`/service/${service.id}`)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    {service.verification_status === 'verified' && (
                      <Badge className="bg-green-600 hover:bg-green-700 text-white gap-1.5 px-3 py-1 flex-shrink-0">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Verified
                      </Badge>
                    )}
                    {service.verification_status === 'pending' && (
                      <Badge variant="outline" className="border-orange-500 text-orange-700 bg-orange-50 gap-1.5 px-3 py-1 flex-shrink-0">
                        <Calendar className="w-3.5 h-3.5" />
                        Pending Verification
                      </Badge>
                    )}
                    {service.verification_status === 'rejected' && (
                      <Badge variant="outline" className="border-red-500 text-red-700 bg-red-50 px-3 py-1 flex-shrink-0">
                        Verification Rejected
                      </Badge>
                    )}
                    <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">{getCategoryName(service)}</Badge>
                    {getServiceTypeName(service) && (
                      <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 px-3 py-1 flex-shrink-0">
                        {getServiceTypeName(service)}
                      </Badge>
                    )}
                  </div>

                  {/* Verification Progress - only show if not verified */}
                  {service.verification_status !== 'verified' && (
                    <div className="mb-4 p-3 bg-secondary/30 rounded-lg w-full">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium">Verification Progress</span>
                        <span className="text-xs text-muted-foreground">
                          {service.verification_progress || 0}%
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1.5 mb-2">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all"
                          style={{ width: `${service.verification_progress || 0}%` }}
                        />
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => {
                          const typeId = service.service_type_id || service.service_type?.id || 'default';
                          navigate(`/services/verify/${service.id}/${typeId}`);
                        }}
                      >
                        {service.verification_progress && service.verification_progress > 0
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
                        <span className="text-muted-foreground">{formatPriceDisplay(service)}</span>
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
                            service.availability === 'available'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-orange-100 text-orange-800'
                          }
                        >
                          {service.availability || 'available'}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Rating:</span>
                        <div className="flex items-center gap-1">
                          {renderStars(service.rating || 0)}
                          <span className="text-muted-foreground ml-1">
                            {service.rating || 0} ({service.review_count || 0} reviews)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Completed Events:</span>
                        <span className="text-muted-foreground">{service.completed_events || 0}</span>
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
          {reviewsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No reviews yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Reviews will appear here once clients leave feedback
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="flex gap-4 p-4 border rounded-lg">
                  <Avatar className="flex-shrink-0">
                    <AvatarImage src={review.user_avatar} />
                    <AvatarFallback>
                      {review.user_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                      <h4 className="font-medium">{review.user_name}</h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center">
                          {renderStars(review.rating)}
                        </div>
                        {review.event_type && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {review.event_type}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-muted-foreground">{review.comment}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {review.created_at ? new Date(review.created_at).toLocaleDateString() : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Package Dialog */}
      <Dialog open={packageDialogOpen} onOpenChange={setPackageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Service Package</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pkg-name">Package Name</Label>
              <Input
                id="pkg-name"
                value={packageForm.name}
                onChange={(e) => setPackageForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Basic, Premium, Gold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pkg-description">Description</Label>
              <Textarea
                id="pkg-description"
                value={packageForm.description}
                onChange={(e) => setPackageForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="A brief description of this package..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pkg-price">Price (TZS)</Label>
              <Input
                id="pkg-price"
                type="number"
                min="0"
                value={packageForm.price}
                onChange={(e) => setPackageForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="e.g. 150000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pkg-features">Features (comma-separated)</Label>
              <Textarea
                id="pkg-features"
                value={packageForm.features}
                onChange={(e) => setPackageForm((f) => ({ ...f, features: e.target.value }))}
                placeholder="e.g. 5 hours coverage, 200 edited photos, Online gallery"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPackageDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePackage} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Package'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyServices;
