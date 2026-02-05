import { Camera, Image, MapPin, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useMoments } from '@/data/useSocial';
import { toast } from 'sonner';

const CreatePostBox = () => {
  const [text, setText] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { createMoment } = useMoments();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setImages(prev => [...prev, ...filesArray]);
      setPreviews(prev => [
        ...prev,
        ...filesArray.map(file => URL.createObjectURL(file))
      ]);
    }
  };

  const removeImage = (index: number) => {
    // Clean up the URL object to prevent memory leaks
    URL.revokeObjectURL(previews[index]);
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!text.trim() && images.length === 0) {
      toast.error('Please add some content or images');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('content', text);
      
      images.forEach((image, index) => {
        formData.append(`images`, image);
      });

      await createMoment(formData);
      
      // Clear form on success
      setText('');
      previews.forEach(url => URL.revokeObjectURL(url));
      setImages([]);
      setPreviews([]);
      
      toast.success('Moment shared successfully!');
    } catch (error) {
      console.error('Failed to share moment:', error);
      toast.error('Failed to share moment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-card rounded-lg p-3 md:p-4 border border-border mb-4 md:mb-6">
      {/* Input row */}
      <div className="flex items-center justify-between gap-2 md:gap-4">
        <input
          type="text"
          placeholder="Share a moment..."
          value={text}
          onChange={e => setText(e.target.value)}
          disabled={isSubmitting}
          className="flex-1 bg-transparent text-foreground text-base md:text-lg outline-none border-0 placeholder:text-muted-foreground disabled:opacity-50"
        />

        <div className="flex items-center gap-1 md:gap-2">
          <button 
            className="p-1.5 md:p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
            disabled={isSubmitting}
          >
            <Camera className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
          </button>

          <label className="p-1.5 md:p-2 hover:bg-muted rounded-lg cursor-pointer transition-colors">
            <Image className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageChange}
              disabled={isSubmitting}
            />
          </label>

          <button 
            className="p-1.5 md:p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
            disabled={isSubmitting}
          >
            <MapPin className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

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

      {/* Post button */}
      <div className="mt-3 md:mt-4 flex justify-end">
        <Button
          size="sm"
          className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-nuru-yellow text-black font-medium hover:bg-nuru-yellow/95 text-sm"
          disabled={(!text.trim() && images.length === 0) || isSubmitting}
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
  );
};

export default CreatePostBox;
