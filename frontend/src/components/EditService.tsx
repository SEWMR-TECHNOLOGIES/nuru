import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { ServiceDetailLoadingSkeleton } from '@/components/ui/ServiceLoadingSkeleton';

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
  const [images, setImages] = useState<string[]>([]);

  const [initialLoadDone, setInitialLoadDone] = useState(false);
  // When the service is loaded, set initial form values
  useEffect(() => {
    if (service) {
      setTitle(service.title || '');
      const categoryId = service.categoryId || service.category_id || '';
      setServiceCategoryId(categoryId);
      setServiceTypeId(service.serviceTypeId || service.service_type_id || ''); // <-- only here
      setDescription(service.description || '');
      setMinPrice((service.price?.split('-')[0] || '').replace(/,/g, ''));
      setMaxPrice((service.price?.split('-')[1] || '').replace(/,/g, ''));
      setLocation(service.location || '');
      setImages(service.images || []);
      setInitialLoadDone(true);
    }
  }, [service]);

  useEffect(() => {
    if (serviceCategoryId) {
      fetchServiceTypes(serviceCategoryId);
      
      if (initialLoadDone) {
        setServiceTypeId(''); 
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      const formattedPrice = `${formatPrice(minPrice)} - ${formatPrice(maxPrice)} TZS`;

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/user-services/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          credentials: 'include',
          body: JSON.stringify({
            title,
            service_category_id: serviceCategoryId,
            service_type_id: serviceTypeId,
            description,
            price: formattedPrice,
            location,
            images,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Service updated!',
          description: 'Your service has been updated successfully.',
        });
        navigate('/my-services');
      } else {
        toast({
          title: 'Update failed',
          description: data.message || 'Failed to update service',
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

  // helper function to get category id from type
  const getTypeCategoryId = (t: any) =>
    t?.service_category_id ?? t?.categoryId ?? t?.service_category ?? t?.category_id ?? t?.category_id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Edit Service</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/my-services')}
        >
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
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Professional Photography"
                required
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="category">Service Category</Label>
                <Select value={serviceCategoryId} onValueChange={setServiceCategoryId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingCategories ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : (
                      (categories || []).map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Service Type</Label>
                <Select value={serviceTypeId} onValueChange={setServiceTypeId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingTypes ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : (
                      (serviceTypes || [])
                        .filter((t: any) => {
                          const tCat = getTypeCategoryId(t);
                          return !!tCat && String(tCat) === String(serviceCategoryId);
                        })
                        .map((type: any) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your service, expertise, and what makes you unique..."
                rows={5}
                required
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="minPrice">Minimum Price (TZS)</Label>
                <Input
                  id="minPrice"
                  value={minPrice}
                  onChange={(e) => setMinPrice(formatPrice(e.target.value))}
                  placeholder="e.g., 50,000"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="maxPrice">Maximum Price (TZS)</Label>
                <Input
                  id="maxPrice"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(formatPrice(e.target.value))}
                  placeholder="e.g., 200,000"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Dar es Salaam"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="images">Service Images</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Click to upload or drag and drop images
                </p>
                <Input
                  id="images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('images')?.click()}
                >
                  Choose Images
                </Button>
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  {images.map((image, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={image}
                        alt={`Service image ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <Button type="submit" className="flex-1">
                Update Service
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/my-services')}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default EditService;
