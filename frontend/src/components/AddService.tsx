import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useServiceCategories } from '@/data/useServiceCategories';
import { useServiceTypes } from '@/data/useServiceTypes';
import { userServicesApi, showApiErrors, showCaughtError } from '@/lib/api';

const AddService = () => {
  useWorkspaceMeta({
    title: 'Add Service',
    description: 'Create a new service offering and showcase your expertise to event organizers.'
  });

  const navigate = useNavigate();
  const { categories } = useServiceCategories();
  const { serviceTypes, fetchServiceTypes } = useServiceTypes();

  const [formData, setFormData] = useState({
    title: '',
    category: '',
    serviceType: '',
    description: '',
    minPrice: '',
    maxPrice: '',
    location: '',
  });
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);

  useEffect(() => {
    if (formData.category) {
      setIsLoadingTypes(true);
      fetchServiceTypes(formData.category).finally(() => setIsLoadingTypes(false));
    }
  }, [formData.category]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const filesArray = Array.from(files);
    setImages(prev => [...prev, ...filesArray]);
    setPreviews(prev => [...prev, ...filesArray.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const form = new FormData();
      form.append("title", formData.title.trim());
      form.append("description", formData.description.trim());
      form.append("category_id", formData.category);
      form.append("service_type_id", formData.serviceType);
      form.append("min_price", formData.minPrice.replace(/,/g, ""));
      form.append("max_price", formData.maxPrice.replace(/,/g, ""));
      form.append("location", formData.location || "");

      images.forEach((file) => {
        form.append("images", file);
      });

      const response = await userServicesApi.create(form);

      if (showApiErrors(response, "Failed to create service")) {
        return;
      }

      toast.success(response.message || "Service created successfully");
      navigate(`/services/verify/${(response.data as any)?.id}/${formData.serviceType}`);
    } catch (err: any) {
      console.error(err);
      showCaughtError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '');
    return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl md:text-3xl font-bold">Add New Service</h1>
          <Button variant="ghost" size="icon" onClick={() => navigate('/my-services')}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Service Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Professional Wedding Photography"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value, serviceType: '' })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceType">Service Type *</Label>
                <Select
                  value={formData.serviceType}
                  onValueChange={(value) => setFormData({ ...formData, serviceType: value })}
                  required
                  disabled={!formData.category || isLoadingTypes}
                >
                  <SelectTrigger>
                    {isLoadingTypes ? (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />Loading types...
                      </span>
                    ) : (
                      <SelectValue placeholder="Select a service type" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map(st => (
                      <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your service, experience, and what makes you unique..."
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing & Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minPrice">Minimum Price (TZS) *</Label>
                  <Input
                    id="minPrice"
                    placeholder="e.g., 300,000"
                    value={formData.minPrice}
                    onChange={(e) => setFormData({ ...formData, minPrice: formatPrice(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxPrice">Maximum Price (TZS) *</Label>
                  <Input
                    id="maxPrice"
                    placeholder="e.g., 2,500,000"
                    value={formData.maxPrice}
                    onChange={(e) => setFormData({ ...formData, maxPrice: formatPrice(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  placeholder="e.g., Dar es Salaam"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Service Images</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {previews.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {previews.map((src, index) => (
                      <div key={index} className="relative group">
                        <img src={src} alt={`Service ${index + 1}`} className="w-full h-32 object-cover rounded-lg" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImage(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-2">Click to upload or drag and drop</p>
                  <p className="text-sm text-muted-foreground">PNG, JPG, or WEBP (max. 0.5MB per file)</p>
                  <label htmlFor="image-upload">
                    <Button type="button" variant="outline" className="mt-4" onClick={() => document.getElementById('image-upload')?.click()}>
                      Choose Files
                    </Button>
                  </label>
                  <input
                    id="image-upload"
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => navigate('/my-services')} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Add Service"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddService;
