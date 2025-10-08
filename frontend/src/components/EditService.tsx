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

interface Service {
  id: string;
  title: string;
  category: string;
  description: string;
  price: string;
  location: string;
  availability: string;
  images: string[];
  rating: number;
  reviewCount: number;
  pastEvents: number;
  isVerified: boolean;
}

const EditService = () => {
  useWorkspaceMeta({
    title: 'Edit Service',
    description: 'Update your service details and information.'
  });

  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [location, setLocation] = useState('');
  const [availability, setAvailability] = useState('');
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    // Load service data
    const userServices = JSON.parse(localStorage.getItem('userServices') || '[]');
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
        images: [
          'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=400&h=300&fit=crop'
        ],
        pastEvents: 38,
        availability: 'Booking for 2025',
        location: 'New York, NY'
      }
    ];

    const allServices = [...sampleServices, ...userServices];
    const service = allServices.find(s => s.id === id);

    if (service) {
      setTitle(service.title);
      setCategory(service.category);
      setDescription(service.description);
      
      // Parse price range
      const priceRange = service.price.replace(' TZS', '');
      const [min, max] = priceRange.split(' - ');
      setMinPrice(min?.replace(/,/g, '') || '');
      setMaxPrice(max?.replace(/,/g, '') || '');
      
      setLocation(service.location);
      setAvailability(service.availability);
      setImages(service.images);
    }
  }, [id]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const userServices = JSON.parse(localStorage.getItem('userServices') || '[]');
    const serviceIndex = userServices.findIndex((s: Service) => s.id === id);

    const updatedService = {
      id,
      title,
      category,
      description,
      price: `${minPrice} - ${maxPrice} TZS`,
      location,
      availability,
      images,
      rating: serviceIndex >= 0 ? userServices[serviceIndex].rating : 0,
      reviewCount: serviceIndex >= 0 ? userServices[serviceIndex].reviewCount : 0,
      pastEvents: serviceIndex >= 0 ? userServices[serviceIndex].pastEvents : 0,
      isVerified: serviceIndex >= 0 ? userServices[serviceIndex].isVerified : false,
    };

    if (serviceIndex >= 0) {
      userServices[serviceIndex] = updatedService;
    } else {
      // Handle sample services by creating a copy
      userServices.push(updatedService);
    }

    localStorage.setItem('userServices', JSON.stringify(userServices));

    toast({
      title: 'Service updated!',
      description: 'Your service has been updated successfully.',
    });

    navigate('/my-services');
  };

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

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Service Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
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

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Photography">Photography</SelectItem>
                    <SelectItem value="Videography">Videography</SelectItem>
                    <SelectItem value="Catering">Catering</SelectItem>
                    <SelectItem value="Venue">Venue</SelectItem>
                    <SelectItem value="Planning">Event Planning</SelectItem>
                    <SelectItem value="Music">Music & DJ</SelectItem>
                    <SelectItem value="Decoration">Decoration</SelectItem>
                    <SelectItem value="Transportation">Transportation</SelectItem>
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
            
            <div className="grid md:grid-cols-2 gap-6">

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
                <Label htmlFor="availability">Availability</Label>
                <Input
                  id="availability"
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  placeholder="e.g., Available, Booking for 2025"
                  required
                />
              </div>
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
