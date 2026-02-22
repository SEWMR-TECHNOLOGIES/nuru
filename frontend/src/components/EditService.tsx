import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Upload, X, Loader2, Music, Trash2, Play, Pause, Volume2, VolumeX, Phone, CheckCircle, Plus } from 'lucide-react';
import SvgIcon from '@/components/ui/svg-icon';
import VideoSVG from '@/assets/icons/video-icon.svg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useUserServiceDetails } from '@/data/useUserService';
import { useServiceCategories } from '@/data/useServiceCategories';
import { useServiceTypes } from '@/data/useServiceTypes';
import { userServicesApi, showApiErrors, showCaughtError } from '@/lib/api';
import { ServiceDetailLoadingSkeleton } from '@/components/ui/ServiceLoadingSkeleton';
import MapLocationPicker from '@/components/MapLocationPicker';
import type { LocationData } from '@/components/MapLocationPicker';
import { businessPhoneApi, type BusinessPhone } from '@/lib/api/businessPhone';

const EditService = () => {
  useWorkspaceMeta({
    title: 'Edit Service',
    description: 'Update your service details and information.'
  });

  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const { service, loading, error } = useUserServiceDetails(id!);
  const { categories, loading: loadingCategories } = useServiceCategories();
  const { serviceTypes, loading: loadingTypes, fetchServiceTypes } = useServiceTypes();

  const [title, setTitle] = useState('');
  const [serviceCategoryId, setServiceCategoryId] = useState('');
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [description, setDescription] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [location, setLocation] = useState('');
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [images, setImages] = useState<string[]>([]);

  // Intro media state
  const [introMedia, setIntroMedia] = useState<Array<{ id: string; media_type: string; media_url: string }>>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const [pendingMediaFile, setPendingMediaFile] = useState<File | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  // Business phone state
  const [businessPhones, setBusinessPhones] = useState<BusinessPhone[]>([]);
  const [selectedPhoneId, setSelectedPhoneId] = useState('');
  const [showAddPhone, setShowAddPhone] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [pendingPhoneId, setPendingPhoneId] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);

  useEffect(() => {
    businessPhoneApi.getAll().then(res => {
      if (res.success && res.data) setBusinessPhones(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {});
  }, []);

  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const initialCategoryRef = useRef<string | null>(null);

  // Track original values for detecting key field changes
  const originalTitleRef = useRef<string>('');
  const originalCategoryRef = useRef<string>('');
  const originalTypeRef = useRef<string>('');

  // When the service is loaded, set initial form values
  useEffect(() => {
    if (service) {
      setTitle(service.title || '');
      // Extract category ID - try flat field first, then nested object; coerce to string
      const categoryId = String(
        service.service_category_id 
        || (service.service_category as any)?.id 
        || (service as any).category_id 
        || ''
      );
      setServiceCategoryId(categoryId);
      initialCategoryRef.current = categoryId;
      // Extract type ID - try flat field first, then nested object; coerce to string
      const typeId = String(
        service.service_type_id 
        || (service.service_type as any)?.id 
        || ''
      );
      setServiceTypeId(typeId);
      // Store originals for change detection
      originalTitleRef.current = service.title || '';
      originalCategoryRef.current = categoryId;
      originalTypeRef.current = typeId;
      const minPriceValue = service.min_price?.toString() || '';
      const maxPriceValue = service.max_price?.toString() || '';
      setMinPrice(minPriceValue.replace(/,/g, ''));
      setMaxPrice(maxPriceValue.replace(/,/g, ''));
      setLocation(service.location || '');

      // Set location data if coordinates exist
      if ((service as any).latitude && (service as any).longitude) {
        setLocationData({
          latitude: (service as any).latitude,
          longitude: (service as any).longitude,
          name: service.location || '',
          address: (service as any).formatted_address || service.location || '',
        });
      } else if (service.location) {
        setLocationData({
          latitude: 0,
          longitude: 0,
          name: service.location,
          address: service.location,
        });
      }

      const imageUrls = (service.images || []).map(img =>
        typeof img === 'string' ? img : img.url
      );
      setImages(imageUrls);

      // Load intro media
      if ((service as any).intro_media) {
        setIntroMedia((service as any).intro_media);
      }

      setInitialLoadDone(true);
    }
  }, [service]);

  // Also fetch intro media separately to ensure fresh data
  useEffect(() => {
    if (id) {
      userServicesApi.getIntroMedia(id).then(res => {
        if (res.success && res.data) {
          setIntroMedia(Array.isArray(res.data) ? res.data : []);
        }
      }).catch(() => {});
    }
  }, [id]);

  useEffect(() => {
    if (serviceCategoryId) {
      fetchServiceTypes(serviceCategoryId);
      // Only clear serviceTypeId when user manually changes category, not on initial load
      if (initialLoadDone && initialCategoryRef.current !== serviceCategoryId) {
        setServiceTypeId('');
      }
      // After first check, clear the ref so subsequent changes are treated as manual
      if (initialCategoryRef.current === serviceCategoryId) {
        initialCategoryRef.current = null;
      }
    }
  }, [serviceCategoryId]);

  const formatPrice = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '');
    return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // Intro media handlers
  // Stage file for confirmation instead of auto-uploading
  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    if (!isVideo && !isAudio) {
      toast({ title: 'Invalid file', description: 'Please select a video or audio file', variant: 'destructive' });
      return;
    }
    setPendingMediaFile(file);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const handleConfirmUpload = async () => {
    if (!pendingMediaFile || !id) return;

    const isVideo = pendingMediaFile.type.startsWith('video/');
    setUploadingMedia(true);
    try {
      const form = new FormData();
      form.append('media_type', isVideo ? 'video' : 'audio');
      form.append('media', pendingMediaFile);

      const response = await userServicesApi.addIntroMedia(id, form);
      if (response.success && response.data) {
        setIntroMedia(prev => [...prev, response.data as any]);
        toast({ title: 'Media uploaded', description: 'Intro clip added successfully' });
        setPendingMediaFile(null);
      } else {
        showApiErrors(response, 'Failed to upload media');
      }
    } catch (err: any) {
      showCaughtError(err, 'Failed to upload media');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    if (!id) return;
    setDeletingMediaId(mediaId);
    try {
      const response = await userServicesApi.deleteIntroMedia(id, mediaId);
      if (response.success) {
        setIntroMedia(prev => prev.filter(m => m.id !== mediaId));
        toast({ title: 'Deleted', description: 'Intro media removed' });
      } else {
        showApiErrors(response, 'Failed to delete media');
      }
    } catch (err: any) {
      showCaughtError(err, 'Failed to delete media');
    } finally {
      setDeletingMediaId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const form = new FormData();
      form.append('title', title);
      if (serviceCategoryId) form.append('service_category_id', serviceCategoryId);
      if (serviceTypeId) form.append('service_type_id', serviceTypeId);
      form.append('description', description);
      form.append('min_price', String(parseInt(minPrice.replace(/,/g, ''), 10) || 0));
      form.append('max_price', String(parseInt(maxPrice.replace(/,/g, ''), 10) || 0));
      form.append('location', location);
      if (locationData && locationData.latitude) {
        form.append('latitude', String(locationData.latitude));
        form.append('longitude', String(locationData.longitude));
        if (locationData.address) form.append('formatted_address', locationData.address);
      }

      // Detect if key fields changed — requires KYC reset
      const keyFieldChanged =
        title !== originalTitleRef.current ||
        serviceCategoryId !== originalCategoryRef.current ||
        serviceTypeId !== originalTypeRef.current;

      if (keyFieldChanged) {
        form.append('reset_verification', 'true');
      }

      const response = await userServicesApi.update(id!, form);

      if (response.success) {
        toast({
          title: 'Service updated!',
          description: keyFieldChanged
            ? 'Key details changed — please complete verification again.'
            : (response.message || 'Your service has been updated successfully.'),
        });
        // If key fields changed, redirect to verification/KYC flow
        if (keyFieldChanged) {
          navigate(`/my-services/${id}/verify`);
        } else {
          navigate('/my-services');
        }
      } else {
        toast({
          title: 'Update failed',
          description: response.message || 'Failed to update service',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An error occurred while updating the service',
        variant: 'destructive',
      });
    }
  };

  if (loading) return <ServiceDetailLoadingSkeleton />;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!service) return <p className="text-red-500">Service not found</p>;


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Edit Service</h1>
        <Button variant="ghost" size="icon" onClick={() => navigate('/my-services')}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
      </div>
      <p className="text-muted-foreground mt-1">Update your service details and information</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Service Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Service Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Professional Photography" required />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="category">Service Category</Label>
                <Select value={serviceCategoryId} onValueChange={setServiceCategoryId} required>
                  <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                  <SelectContent>
                    {loadingCategories ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : (
                      (categories || []).map((cat: any) => (
                        <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Service Type</Label>
                <Select value={serviceTypeId} onValueChange={setServiceTypeId} required>
                  <SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger>
                  <SelectContent>
                    {loadingTypes ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : (
                      (serviceTypes || []).map((type: any) => (
                        <SelectItem key={type.id} value={String(type.id)}>{type.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your service, expertise, and what makes you unique..." rows={5} required />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="minPrice">Minimum Price (TZS)</Label>
                <Input id="minPrice" value={minPrice} onChange={(e) => setMinPrice(formatPrice(e.target.value))} placeholder="e.g., 50,000" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxPrice">Maximum Price (TZS)</Label>
                <Input id="maxPrice" value={maxPrice} onChange={(e) => setMaxPrice(formatPrice(e.target.value))} placeholder="e.g., 200,000" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Service Location</Label>
              <MapLocationPicker
                value={locationData}
                onChange={(loc) => {
                  if (loc) {
                    setLocationData(loc);
                    setLocation(loc.address || loc.name);
                  } else {
                    setLocationData(null);
                    setLocation('');
                  }
                }}
              />
              {location && (
                <p className="text-xs text-muted-foreground mt-1">📍 {location}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Intro Media Section */}
        <Card>
          <CardHeader>
            <CardTitle>Intro Clip</CardTitle>
            <p className="text-sm text-muted-foreground">Add a short video or audio clip to introduce your service (max 1 minute)</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing media - show actual players */}
            {introMedia.length > 0 && (
              <div className="space-y-3">
                {introMedia.map((media) => (
                  <div key={media.id} className="rounded-xl border border-border bg-muted/30 overflow-hidden">
                    {media.media_type === 'video' ? (
                      <div className="relative aspect-video bg-black rounded-t-xl overflow-hidden">
                        <video
                          src={media.media_url}
                          controls
                          playsInline
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="p-4 flex items-center gap-3 bg-gradient-to-r from-primary/5 to-transparent">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Music className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground mb-1">Audio Clip</p>
                          <audio src={media.media_url} controls className="w-full h-8" />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
                      <p className="text-xs text-muted-foreground capitalize">{media.media_type} intro</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-7 px-2 text-xs"
                        onClick={() => handleDeleteMedia(media.id)}
                        disabled={deletingMediaId === media.id}
                      >
                        {deletingMediaId === media.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                        )}
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pending file preview + confirm */}
            {pendingMediaFile && (
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 overflow-hidden">
                {pendingMediaFile.type.startsWith('video/') ? (
                  <div className="aspect-video bg-black rounded-t-xl overflow-hidden">
                    <video
                      src={URL.createObjectURL(pendingMediaFile)}
                      controls
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="p-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Music className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground mb-1">{pendingMediaFile.name}</p>
                      <audio src={URL.createObjectURL(pendingMediaFile)} controls className="w-full h-8" />
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-3 border-t border-primary/20">
                  <p className="text-xs text-muted-foreground">{(pendingMediaFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setPendingMediaFile(null)} className="h-8">
                      Cancel
                    </Button>
                    <Button type="button" size="sm" onClick={handleConfirmUpload} disabled={uploadingMedia} className="h-8">
                      {uploadingMedia ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Uploading...</> : <><Upload className="w-3.5 h-3.5 mr-1.5" />Upload</>}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Upload button - only show if no pending file */}
            {!pendingMediaFile && (
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <img src={VideoSVG} alt="" className="w-6 h-6 dark:invert" />
                  <Music className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-3">Upload a video or audio clip (max 1 minute)</p>
                <input
                  ref={mediaInputRef}
                  type="file"
                  accept="video/*,audio/*"
                  className="hidden"
                  onChange={handleMediaSelect}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => mediaInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />Choose File
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Business Phone */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Business Phone Number
            </CardTitle>
            <p className="text-sm text-muted-foreground">Add a verified business contact number for clients</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {businessPhones.filter(p => p.verification_status === 'verified').length > 0 && (
              <Select value={selectedPhoneId} onValueChange={setSelectedPhoneId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a verified phone" />
                </SelectTrigger>
                <SelectContent>
                  {businessPhones.filter(p => p.verification_status === 'verified').map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        {p.phone_number}
                        <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {!showAddPhone ? (
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setShowAddPhone(true)}>
                <Plus className="w-4 h-4" /> Add New Phone
              </Button>
            ) : pendingPhoneId ? (
              <div className="space-y-3 p-4 rounded-lg bg-muted/30">
                <p className="text-sm font-medium">Enter the verification code</p>
                <InputOTP maxLength={6} value={phoneOtp} onChange={setPhoneOtp}>
                  <InputOTPGroup className="gap-2 justify-center w-full">
                    {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} className="w-12 h-14 text-xl font-semibold rounded-xl border-2" />)}
                  </InputOTPGroup>
                </InputOTP>
                <Button type="button" size="sm" disabled={phoneOtp.length < 6 || phoneLoading}
                  onClick={async () => {
                    setPhoneLoading(true);
                    try {
                      const res = await businessPhoneApi.verify(pendingPhoneId, { otp_code: phoneOtp });
                      if (res.success) {
                        toast({ title: "Phone verified!" });
                        const refreshed = await businessPhoneApi.getAll();
                        if (refreshed.success && refreshed.data) setBusinessPhones(Array.isArray(refreshed.data) ? refreshed.data : []);
                        setSelectedPhoneId(pendingPhoneId);
                        setPendingPhoneId(''); setShowAddPhone(false); setPhoneOtp('');
                      } else { toast({ title: "Invalid code", variant: "destructive" }); }
                    } catch { toast({ title: "Verification failed", variant: "destructive" }); }
                    finally { setPhoneLoading(false); }
                  }}>
                  {phoneLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Verify
                </Button>
              </div>
            ) : (
              <div className="space-y-3 p-4 rounded-lg bg-muted/30">
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input placeholder="0712 345 678" value={newPhoneNumber} onChange={(e) => setNewPhoneNumber(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" disabled={!newPhoneNumber.trim() || phoneLoading}
                    onClick={async () => {
                      setPhoneLoading(true);
                      try {
                        const res = await businessPhoneApi.add({ phone_number: newPhoneNumber.trim() });
                        if (res.success && res.data) { setPendingPhoneId((res.data as any).id); toast({ title: "Verification code sent!" }); }
                        else { toast({ title: (res as any).message || "Failed", variant: "destructive" }); }
                      } catch { toast({ title: "Failed", variant: "destructive" }); }
                      finally { setPhoneLoading(false); }
                    }}>
                    {phoneLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Send Code
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setShowAddPhone(false); setNewPhoneNumber(''); }}>Cancel</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service Images</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">Click to upload or drag and drop images</p>
              <Input id="images" type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
              <Button type="button" variant="outline" onClick={() => document.getElementById('images')?.click()}>Choose Images</Button>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                {images.map((image, index) => (
                  <div key={index} className="relative group">
                    <img src={image} alt={`Service image ${index + 1}`} className="w-full h-32 object-cover rounded-lg" />
                    <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeImage(index)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" className="flex-1">Update Service</Button>
          <Button type="button" variant="outline" onClick={() => navigate('/my-services')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
};

export default EditService;
