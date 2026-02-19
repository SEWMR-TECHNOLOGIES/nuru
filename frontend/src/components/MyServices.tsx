import { useNavigate } from 'react-router-dom';
import { formatPrice } from '@/utils/formatPrice';
import { Star, CheckCircle, Users, Plus, Edit, Eye, Package, Loader2, Camera, MapPin, ChevronRight, BookOpen, Upload, Trash2, X, ImagePlus } from 'lucide-react';
import CalendarSVG from '@/assets/icons/calendar-icon.svg';
import PhotosSVG from '@/assets/icons/photos-icon.svg';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useUserServices } from '@/data/useUserServices';
import { useRef, useState } from 'react';
import { ServiceLoadingSkeleton } from '@/components/ui/ServiceLoadingSkeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { showApiErrors, showCaughtError } from '@/lib/api';
import { userServicesApi } from '@/lib/api';
import type { ServiceReview } from '@/lib/api/types';

// Detect if a service is photography type
const isPhotographyService = (service: any): boolean => {
  const name = (service.service_type_name || service.service_type?.name || service.category || '').toLowerCase();
  return name.includes('photo') || name.includes('cinema') || name.includes('video') || name.includes('film');
};

const MyServices = () => {
  useWorkspaceMeta({
    title: 'My Services',
    description: 'Manage your service offerings, track performance, and connect with event organizers.'
  });

  const navigate = useNavigate();
  const { services, summary, recentReviews, loading, error, refetch } = useUserServices();

  const reviews = (recentReviews || []).map((r: any) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    user_name: r.user_name,
    user_avatar: r.user_avatar,
    created_at: r.created_at,
    service_title: r.service_title,
    service_id: r.service_id || '',
    user_id: '',
    verified_booking: false,
  })) as ServiceReview[];

  const reviewsLoading = loading;
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [packageForm, setPackageForm] = useState({ name: '', description: '', features: '', price: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageDialogService, setImageDialogService] = useState<any | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);

  const handleAddPackage = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setPackageDialogOpen(true);
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !imageDialogService) return;
    setImageUploading(true);
    let success = 0;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) { toast.error(`${file.name}: only images allowed`); continue; }
      if (file.size > 512 * 1024) { toast.error(`${file.name}: max 0.5MB per file`); continue; }
      try {
        const form = new FormData();
        form.append('images', file);
        const res = await userServicesApi.addImages(imageDialogService.id, form);
        if (!showApiErrors(res)) success++;
      } catch (err) { showCaughtError(err); }
    }
    setImageUploading(false);
    if (success > 0) {
      toast.success(`${success} photo${success > 1 ? 's' : ''} added!`);
      await refetch();
      setImageDialogService(null);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!imageDialogService) return;
    setDeletingImageId(imageId);
    try {
      const res = await userServicesApi.deleteImage(imageDialogService.id, imageId);
      if (!showApiErrors(res)) {
        toast.success('Photo removed');
        await refetch();
        setImageDialogService((prev: any) => {
          const updated = services.find((s: any) => s.id === prev?.id);
          return updated || prev;
        });
      }
    } catch (err) { showCaughtError(err); }
    finally { setDeletingImageId(null); }
  };

  const handleSavePackage = async () => {
    if (!selectedServiceId) return;
    if (!packageForm.name.trim()) { toast.error('Please provide a package name.'); return; }
    if (!packageForm.description.trim()) { toast.error('Please include a brief description.'); return; }
    if (!packageForm.price || Number(packageForm.price) <= 0) { toast.error('Please enter a valid price.'); return; }
    if (!packageForm.features.trim()) { toast.error('Please list at least one feature.'); return; }

    setIsSubmitting(true);
    try {
      const result = await userServicesApi.addPackage(selectedServiceId, {
        name: packageForm.name.trim(),
        description: packageForm.description.trim(),
        price: Number(packageForm.price),
        features: packageForm.features.split(',').map(f => f.trim()).filter(Boolean),
      });
      if (showApiErrors(result, 'Failed to add package.')) return;
      toast.success(result.message || 'Package added successfully.');
      setPackageDialogOpen(false);
      setPackageForm({ name: '', description: '', features: '', price: '' });
      setSelectedServiceId(null);
    } catch (err: any) { showCaughtError(err); }
    finally { setIsSubmitting(false); }
  };

  const renderStars = (rating: number) => Array.from({ length: 5 }, (_, i) => (
    <Star key={i} className={`w-3.5 h-3.5 ${i < Math.floor(rating) ? 'text-yellow-400 fill-current' : i < rating ? 'text-yellow-400 fill-current opacity-50' : 'text-muted-foreground/30'}`} />
  ));

  const getImageUrl = (img: any): string => {
    if (typeof img === 'string') return img;
    if (img && typeof img === 'object') return img.url || img.image_url || img.file_url || '';
    return '';
  };

  const getServiceImages = (service: any): any[] => {
    if (Array.isArray(service.images) && service.images.length > 0) return service.images;
    if (service.primary_image) return [{ url: service.primary_image }];
    return [];
  };

  const formatPriceDisplay = (service: any): string => {
    if (service.min_price && service.max_price) return `${formatPrice(service.min_price)} – ${formatPrice(service.max_price)}`;
    if (service.min_price) return `From ${formatPrice(service.min_price)}`;
    return 'Price on request';
  };

  const getCategoryName = (service: any): string => service.category || service.service_category?.name || 'Uncategorized';
  const getServiceTypeName = (service: any): string => service.service_type_name || service.service_type?.name || '';

  if (loading) return <ServiceLoadingSkeleton />;
  if (error) return <p className="text-destructive">{error}</p>;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Services</h1>
          <p className="text-muted-foreground mt-1">Your professional portfolio on Nuru</p>
        </div>
        <Button size="lg" className="shadow-md" onClick={() => navigate('/services/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Add New Service
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Services', value: services.length, icon: <Package className="w-5 h-5" />, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Avg Rating', value: summary?.average_rating != null && summary.average_rating > 0 ? Number(summary.average_rating).toFixed(1) : '–', icon: <Star className="w-5 h-5" />, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
          { label: 'Total Reviews', value: summary?.total_reviews ?? services.reduce((s, x) => s + (x.review_count || 0), 0), icon: <Users className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
          { label: 'Completed Events', value: services.reduce((s, x) => s + (x.completed_events || 0), 0), icon: <CheckCircle className="w-5 h-5" />, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
        ].map((stat, i) => (
          <Card key={i} className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`w-11 h-11 ${stat.bg} rounded-xl flex items-center justify-center ${stat.color}`}>
                  {stat.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Services Portfolio */}
      <div className="space-y-6">
        {services.map((service) => {
          const images = getServiceImages(service);
          const isPhoto = isPhotographyService(service);
          const isVerified = service.verification_status === 'verified';

          return (
            <Card key={service.id} className="overflow-hidden border-border/60 shadow-sm hover:shadow-md transition-all">
              {/* Portfolio Image Strip */}
              {images.length > 0 && (
                <div className="relative h-52 bg-muted overflow-hidden group">
                  {images.length === 1 ? (
                    <img src={getImageUrl(images[0])} alt={service.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : images.length === 2 ? (
                    <div className="grid grid-cols-2 h-full gap-0.5">
                      {images.slice(0, 2).map((img, idx) => (
                        <img key={idx} src={getImageUrl(img)} alt={service.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ))}
                    </div>
                  ) : images.length === 3 ? (
                    <div className="grid grid-cols-3 h-full gap-0.5">
                      {images.slice(0, 3).map((img, idx) => (
                        <img key={idx} src={getImageUrl(img)} alt={service.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 h-full gap-0.5">
                      <div className="col-span-2 row-span-2">
                        <img src={getImageUrl(images[0])} alt={service.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                      {images.slice(1, 4).map((img, idx) => (
                        <img key={idx} src={getImageUrl(img)} alt={service.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ))}
                    </div>
                  )}

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                  {/* Verification badge */}
                  <div className="absolute top-3 left-3 flex gap-2">
                    {isVerified && (
                      <Badge className="bg-green-500 text-white border-0 shadow">
                        <CheckCircle className="w-3 h-3 mr-1" /> Verified
                      </Badge>
                    )}
                    {!isVerified && service.verification_status === 'pending' && (
                      <Badge className="bg-amber-500/90 text-white border-0 shadow">Pending Verification</Badge>
                    )}
                    {isPhoto && (
                      <Badge className="bg-purple-600 text-white border-0 shadow">
                        <Camera className="w-3 h-3 mr-1" /> Photography
                      </Badge>
                    )}
                  </div>

                  {/* Image count */}
                  {images.length > 4 && (
                    <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                      +{images.length - 4} more
                    </div>
                  )}

                  {/* Action buttons overlay */}
                  <div className="absolute bottom-3 left-3 flex gap-2">
                    <Button size="sm" variant="secondary" className="bg-white/90 hover:bg-white text-foreground shadow"
                      onClick={() => navigate(`/service/${service.id}`)}>
                      <Eye className="w-3.5 h-3.5 mr-1.5" /> View
                    </Button>
                    {service.verification_status !== 'verified' && (
                      <Button size="sm" variant="secondary" className="bg-white/90 hover:bg-white text-foreground shadow"
                        onClick={() => navigate(`/services/edit/${service.id}`)}>
                        <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit
                      </Button>
                    )}
                    {isVerified && (
                      <Button size="sm" variant="secondary" className="bg-white/90 hover:bg-white text-foreground shadow"
                        onClick={() => handleAddPackage(service.id)}>
                        <Package className="w-3.5 h-3.5 mr-1.5" /> Package
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" className="bg-white/90 hover:bg-white text-foreground shadow"
                      onClick={() => setImageDialogService(service)}>
                      <ImagePlus className="w-3.5 h-3.5 mr-1.5" /> Photos
                    </Button>
                  </div>
                </div>
              )}

              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* No images fallback actions */}
                  {images.length === 0 && (
                    <div className="flex gap-2 flex-wrap mb-2">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/service/${service.id}`)}>
                        <Eye className="w-3.5 h-3.5 mr-1.5" /> View
                      </Button>
                      {service.verification_status !== 'verified' && (
                        <Button size="sm" variant="outline" onClick={() => navigate(`/services/edit/${service.id}`)}>
                          <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit
                        </Button>
                      )}
                      {isVerified && (
                        <Button size="sm" variant="outline" onClick={() => handleAddPackage(service.id)}>
                          <Package className="w-3.5 h-3.5 mr-1.5" /> Add Package
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setImageDialogService(service)}>
                        <ImagePlus className="w-3.5 h-3.5 mr-1.5" /> Photos
                      </Button>
                    </div>
                  )}

                  <div className="flex-1 space-y-4">
                    {/* Title + badges */}
                    <div>
                      <div className="flex items-start gap-3 flex-wrap">
                        <h3 className="text-xl font-bold">{service.title}</h3>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        <Badge variant="secondary">{getCategoryName(service)}</Badge>
                        {getServiceTypeName(service) && (
                          <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
                            {getServiceTypeName(service)}
                          </Badge>
                        )}
                        <Badge variant="outline" className={service.availability === 'available' ? 'border-green-300 text-green-700 bg-green-50 dark:bg-green-900/20' : 'border-orange-300 text-orange-700'}>
                          {service.availability || 'available'}
                        </Badge>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 text-sm flex-wrap">
                      <div className="flex items-center gap-1">
                        {renderStars(service.rating || 0)}
                        <span className="ml-1 font-semibold">{(service.rating || 0).toFixed(1)}</span>
                        <span className="text-muted-foreground">({service.review_count || 0})</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>{service.completed_events || 0} events completed</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span>{service.location || 'Location not set'}</span>
                      </div>
                    </div>

                    <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">{service.description}</p>

                    {/* Price */}
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-primary">{formatPriceDisplay(service)}</span>
                    </div>

                    {/* Verification Progress */}
                    {!isVerified && (
                      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">Verification Progress</span>
                          <span className="text-xs font-bold text-amber-700">{service.verification_progress || 0}%</span>
                        </div>
                        <div className="w-full bg-amber-100 dark:bg-amber-900/40 rounded-full h-2 mb-2">
                          <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${service.verification_progress || 0}%` }} />
                        </div>
                        <Button variant="link" size="sm" className="h-auto p-0 text-xs text-amber-700 dark:text-amber-300"
                          onClick={() => navigate(`/services/verify/${service.id}/${service.service_type_id || 'default'}`)}>
                          {(service.verification_progress || 0) > 0 ? 'Continue Verification →' : 'Start Verification →'}
                        </Button>
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/bookings?service=${service.id}`)}
                        className="gap-2"
                      >
                        <BookOpen className="w-4 h-4" />
                        Bookings
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/services/events/${service.id}`)}
                        className="gap-2"
                      >
                        <img src={CalendarSVG} alt="" className="w-4 h-4 dark:invert" />
                        My Events
                      </Button>

                      {isPhoto && isVerified && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/services/photo-libraries/${service.id}`)}
                          className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:border-purple-700"
                        >
                          <img src={PhotosSVG} alt="" className="w-4 h-4 dark:invert" />
                          Photo Libraries
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {services.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed border-muted-foreground/20 rounded-2xl">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">No Services Yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first service to start connecting with event organizers and growing your business on Nuru.
            </p>
            <Button size="lg" onClick={() => navigate('/services/new')}>
              <Plus className="w-5 h-5 mr-2" />
              Create Your First Service
            </Button>
          </div>
        )}
      </div>

      {/* Recent Reviews */}
      {reviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500 fill-current" />
              Recent Reviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reviewsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((review: any) => (
                  <div key={review.id} className="flex gap-4 p-4 border rounded-xl hover:bg-muted/30 transition-colors">
                    <Avatar className="flex-shrink-0">
                      <AvatarImage src={review.user_avatar} alt={review.user_name} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {review.user_name ? review.user_name.slice(0, 2).toUpperCase() : 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-semibold text-sm">{review.user_name}</h4>
                        <div className="flex items-center gap-0.5">{renderStars(review.rating)}</div>
                        {review.service_title && <Badge variant="secondary" className="text-xs">{review.service_title}</Badge>}
                      </div>
                      <p className="text-muted-foreground text-sm">{review.comment}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {review.created_at ? new Date(review.created_at).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Package Dialog */}
      <Dialog open={packageDialogOpen} onOpenChange={setPackageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Service Package</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Package Name</Label>
              <Input value={packageForm.name} onChange={(e) => setPackageForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Basic, Premium, Gold" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={packageForm.description} onChange={(e) => setPackageForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description..." rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Price (TZS)</Label>
              <Input type="number" min="0" value={packageForm.price} onChange={(e) => setPackageForm(f => ({ ...f, price: e.target.value }))} placeholder="e.g. 150000" />
            </div>
            <div className="space-y-2">
              <Label>Features (comma-separated)</Label>
              <Textarea value={packageForm.features} onChange={(e) => setPackageForm(f => ({ ...f, features: e.target.value }))} placeholder="e.g. 5 hours coverage, 200 edited photos, Online gallery" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPackageDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePackage} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {isSubmitting ? 'Saving...' : 'Save Package'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── PHOTO MANAGEMENT DIALOG ─── */}
      <Dialog open={!!imageDialogService} onOpenChange={(open) => { if (!open) setImageDialogService(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImagePlus className="w-5 h-5 text-primary" />
              Manage Photos
              {imageDialogService && (
                <span className="text-sm font-normal text-muted-foreground truncate">— {imageDialogService.title}</span>
              )}
            </DialogTitle>
          </DialogHeader>

          {imageDialogService && (() => {
            const imgs = getServiceImages(imageDialogService);
            return (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-1">
                {/* Upload zone */}
                <div
                  className="border-2 border-dashed border-border rounded-2xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                  onClick={() => imageFileRef.current?.click()}
                >
                  {imageUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Uploading photos…</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Upload className="w-7 h-7 text-primary" />
                      </div>
                      <p className="font-semibold text-foreground mb-1">Click to upload photos</p>
                      <p className="text-xs text-muted-foreground">PNG, JPG or WebP · Max 0.5MB per file</p>
                    </>
                  )}
                  <input
                    ref={imageFileRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={e => handleImageUpload(e.target.files)}
                  />
                </div>

                {/* Existing photos grid */}
                {imgs.length > 0 ? (
                  <>
                    <p className="text-sm font-semibold text-foreground">{imgs.length} photo{imgs.length !== 1 ? 's' : ''}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {imgs.map((img: any, idx: number) => {
                        const url = getImageUrl(img);
                        const imgId = img?.id || img?.image_id || String(idx);
                        return (
                          <div key={imgId} className="relative group rounded-xl overflow-hidden bg-muted aspect-square border border-border">
                            <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <button
                                onClick={() => handleDeleteImage(imgId)}
                                disabled={deletingImageId === imgId}
                                className="p-2.5 bg-destructive/90 hover:bg-destructive rounded-full transition-colors shadow-lg"
                              >
                                {deletingImageId === imgId
                                  ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                                  : <Trash2 className="w-4 h-4 text-white" />
                                }
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Camera className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No photos yet. Upload your first photo above.</p>
                  </div>
                )}
              </div>
            );
          })()}

          <DialogFooter className="pt-4 border-t border-border mt-4">
            <Button variant="outline" onClick={() => setImageDialogService(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyServices;
