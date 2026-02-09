import { X, Loader2, Navigation } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { socialApi } from '@/lib/api/social';
import { useFeed } from '@/data/useSocial';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import CameraIcon from '@/assets/icons/camera-icon.svg';
import ImageIcon from '@/assets/icons/image-icon.svg';
import LocationIcon from '@/assets/icons/location-icon.svg';
import MomentPreview from './MomentPreview';

// Sanitize text to prevent XSS attacks
const sanitizeText = (text: string): string => {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Validate content
const validateContent = (text: string, images: File[]): { valid: boolean; message: string } => {
  const trimmedText = text.trim();
  
  if (!trimmedText && images.length === 0) {
    return { valid: false, message: 'Please add some content or images' };
  }
  
  if (trimmedText.length > 2000) {
    return { valid: false, message: 'Content cannot exceed 2000 characters' };
  }
  
  if (images.length > 10) {
    return { valid: false, message: 'Maximum 10 images allowed' };
  }
  
  // Check file sizes (max 10MB per image)
  for (const image of images) {
    if (image.size > 10 * 1024 * 1024) {
      return { valid: false, message: `Image "${image.name}" exceeds 10MB limit` };
    }
  }
  
  return { valid: true, message: '' };
};

interface LocationData {
  latitude: number;
  longitude: number;
  name?: string;
}

const CreatePostBox = () => {
  const [text, setText] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  
  const { refetch: refetchFeed } = useFeed();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      
      // Validate file types
      const validFiles = filesArray.filter(file => {
        if (!file.type.startsWith('image/')) {
          toast.error(`"${file.name}" is not an image`);
          return false;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`"${file.name}" exceeds 10MB limit`);
          return false;
        }
        return true;
      });
      
      if (images.length + validFiles.length > 10) {
        toast.error('Maximum 10 images allowed');
        const remaining = 10 - images.length;
        validFiles.splice(remaining);
      }
      
      setImages(prev => [...prev, ...validFiles]);
      setPreviews(prev => [
        ...prev,
        ...validFiles.map(file => URL.createObjectURL(file))
      ]);
    }
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Camera functionality
  const openCamera = async () => {
    // Check if device supports camera
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Fallback to file input with capture attribute
      cameraInputRef.current?.click();
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setCameraStream(stream);
      setShowCameraDialog(true);
      
      // Wait for dialog to open and video element to be available
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (error) {
      console.error('Camera access denied:', error);
      // Fallback to file input
      cameraInputRef.current?.click();
    }
  };

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        if (images.length >= 10) {
          toast.error('Maximum 10 images allowed');
          return;
        }
        
        setImages(prev => [...prev, file]);
        setPreviews(prev => [...prev, URL.createObjectURL(blob)]);
        closeCamera();
        toast.success('Photo captured!');
      }
    }, 'image/jpeg', 0.9);
  }, [images.length]);

  const closeCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCameraDialog(false);
  }, [cameraStream]);

  // Location functionality
  const getLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    
    setIsGettingLocation(true);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // Try to get location name using reverse geocoding
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await response.json();
          
          const locationName = data.address?.city || 
                              data.address?.town || 
                              data.address?.village || 
                              data.address?.county ||
                              'Unknown location';
          
          setLocation({
            latitude,
            longitude,
            name: locationName
          });
          toast.success(`Location set: ${locationName}`);
        } catch {
          setLocation({ latitude, longitude, name: 'Current location' });
          toast.success('Location added');
        }
        
        setIsGettingLocation(false);
      },
      (error) => {
        setIsGettingLocation(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error('Location permission denied. Please enable it in your browser settings.');
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error('Location information unavailable.');
            break;
          case error.TIMEOUT:
            toast.error('Location request timed out.');
            break;
          default:
            toast.error('Unable to get your location.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  };

  const removeLocation = () => {
    setLocation(null);
    toast.success('Location removed');
  };

  const handleSubmit = async () => {
    const validation = validateContent(text, images);
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      
      // Sanitize and add content
      const sanitizedContent = sanitizeText(text.trim());
      formData.append('content', sanitizedContent);
      
      // Add location if available
      if (location?.name) {
        formData.append('location', location.name);
      }
      
      // Add images
      images.forEach((image) => {
        formData.append('images', image);
      });

      const response = await socialApi.createPost(formData);
      if (!response.success) {
        throw new Error(response.message || 'Failed to create post');
      }
      
      // Refresh the feed
      refetchFeed();
      
      // Clear form on success
      setText('');
      previews.forEach(url => URL.revokeObjectURL(url));
      setImages([]);
      setPreviews([]);
      setLocation(null);
      
      toast.success('Moment shared successfully!');
    } catch (error) {
      // Show API error message or fallback
      const errorMessage = error instanceof Error ? error.message : 'Failed to share moment. Please try again.';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const characterCount = text.length;
  const isOverLimit = characterCount > 2000;

  return (
    <>
      <div className="bg-card rounded-lg p-3 md:p-4 border border-border mb-4 md:mb-6">
        {/* Textarea for multiline input */}
        <div className="flex flex-col gap-2 md:gap-3">
          <textarea
            placeholder="Share a moment..."
            value={text}
            onChange={e => setText(e.target.value)}
            disabled={isSubmitting}
            rows={3}
            className="w-full bg-transparent text-foreground text-base md:text-lg outline-none border-0 placeholder:text-muted-foreground disabled:opacity-50 resize-none"
          />
          
          {/* Character counter */}
          <div className="flex items-center justify-between">
            <span className={`text-xs ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
              {characterCount}/2000
            </span>
            
            <div className="flex items-center gap-1 md:gap-2">
              {/* Camera button */}
              <button 
                type="button"
                onClick={openCamera}
                className="p-1.5 md:p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
                disabled={isSubmitting}
                title="Take a photo"
              >
                <img src={CameraIcon} alt="Camera" className="w-4 h-4 md:w-5 md:h-5" />
              </button>

              {/* Gallery button */}
              <label className="p-1.5 md:p-2 hover:bg-muted rounded-lg cursor-pointer transition-colors">
                <img src={ImageIcon} alt="Gallery" className="w-4 h-4 md:w-5 md:h-5" />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageChange}
                  disabled={isSubmitting}
                />
              </label>

              {/* Location button */}
              <button 
                type="button"
                onClick={location ? removeLocation : getLocation}
                className={`p-1.5 md:p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50 ${location ? 'bg-primary/10' : ''}`}
                disabled={isSubmitting || isGettingLocation}
                title={location ? 'Remove location' : 'Add location'}
              >
                {isGettingLocation ? (
                  <Loader2 className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground animate-spin" />
                ) : (
                  <img 
                    src={LocationIcon} 
                    alt="Location" 
                    className={`w-4 h-4 md:w-5 md:h-5 ${location ? 'opacity-100' : 'opacity-70'}`} 
                  />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Location badge */}
        {location && (
          <div className="mt-2 flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs">
              <Navigation className="w-3 h-3" />
              <span>{location.name}</span>
              <button 
                type="button"
                onClick={removeLocation}
                className="hover:bg-primary/20 rounded-full p-0.5"
                disabled={isSubmitting}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Preview uploaded images */}
        {previews.length > 0 && (
          <div className="mt-3 md:mt-4">
            {previews.length === 1 ? (
              <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden border border-border">
                <img
                  src={previews[0]}
                  alt="preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(0)}
                  disabled={isSubmitting}
                  className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto py-1">
                {previews.map((src, idx) => (
                  <div
                    key={idx}
                    className="relative w-32 h-24 md:w-40 md:h-32 flex-shrink-0 rounded-lg overflow-hidden border border-border"
                  >
                    <img
                      src={src}
                      alt={`preview ${idx}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      disabled={isSubmitting}
                      className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition-colors disabled:opacity-50"
                    >
                      <X className="w-3 h-3 md:w-4 md:h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Live Preview */}
        <MomentPreview 
          text={text}
          previews={previews}
          location={location}
        />

        {/* Post button */}
        <div className="mt-3 md:mt-4 flex justify-end">
          <Button
            size="sm"
            className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-nuru-yellow text-black font-medium hover:bg-nuru-yellow/95 text-sm"
            disabled={(!text.trim() && images.length === 0) || isSubmitting || isOverLimit}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sharing...
              </>
            ) : (
              'Share Moment'
            )}
          </Button>
        </div>
      </div>

      {/* Hidden camera input for fallback */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleImageChange}
      />

      {/* Camera dialog */}
      <Dialog open={showCameraDialog} onOpenChange={(open) => !open && closeCamera()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Take a Photo</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-full aspect-[4/3] bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeCamera}>
                Cancel
              </Button>
              <Button onClick={capturePhoto}>
                <img src={CameraIcon} alt="Capture" className="w-4 h-4 mr-2" />
                Capture
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreatePostBox;
