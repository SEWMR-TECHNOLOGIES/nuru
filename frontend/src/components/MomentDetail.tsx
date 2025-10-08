import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Heart, MessageCircle, Share2, Send, Image as ImageIcon, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from 'sonner';

interface Comment {
  id: string;
  author: string;
  avatar: string;
  content?: string;
  image?: string;
  timestamp: string;
}

const MomentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [input, setInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [shareOpenTop, setShareOpenTop] = useState(false);
  const [shareOpenBottom, setShareOpenBottom] = useState(false);
  const inputFileRef = useRef<HTMLInputElement | null>(null);

  const shareUrl = `${window.location.origin}/post/${id}`;
  const shareTitle = post?.event?.title || post?.content?.title || 'Check out this moment';

  const handleShare = (platform: string) => {
    let url = '';
    switch (platform) {
      case 'whatsapp':
        url = `https://wa.me/?text=${encodeURIComponent(shareTitle + ' ' + shareUrl)}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
        setShareOpenTop(false);
        setShareOpenBottom(false);
        return;
    }
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      setShareOpenTop(false);
      setShareOpenBottom(false);
    }
  };

  const handleBack = () => {
    // If there's history state, go back normally, otherwise navigate to home
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  useEffect(() => {
    if (location.state?.post) {
      setPost(location.state.post);
    } else {
      const posts = JSON.parse(localStorage.getItem('posts') || '[]');
      const foundPost = posts.find((p: any) => p.id === id);

      if (!foundPost) {
        setPost({
          id,
          type: 'event',
          author: {
            name: 'Sarah Johnson',
            avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b5c5?w=150&h=150&fit=crop&crop=face',
            timeAgo: '2 hours ago',
          },
          event: {
            title: "Sarah & John's Wedding Celebration",
            text: "Join us for our special day! Ceremony at 4 PM followed by reception. Dress code: Formal. Can't wait to celebrate with all our loved ones!",
            image: '/src/assets/feed-images/sophia-wedding.png',
            hostedBy: 'Sarah & John',
            date: 'December 25, 2024',
          },
          likes: 24,
          comments: 8,
        });
      } else {
        setPost(foundPost);
      }
    }

    const savedComments = JSON.parse(localStorage.getItem(`comments_${id}`) || '[]');
    setComments(savedComments);
  }, [id, location.state]);

  // Image handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (inputFileRef.current) inputFileRef.current.value = '';
  };

  const sendEcho = () => {
    if (!input.trim() && !imagePreview) return;

    const comment: Comment = {
      id: Date.now().toString(),
      author: 'You',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      content: input.trim() || undefined,
      image: imagePreview || undefined,
      timestamp: 'Just now'
    };

    const updated = [...comments, comment];
    setComments(updated);
    localStorage.setItem(`comments_${id}`, JSON.stringify(updated));
    setInput('');
    removeImage();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendEcho();
    }
  };

  if (!post) return <div>Loading...</div>;

  return (
    <>
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h1 className="text-2xl md:text-3xl font-bold">Moment Details</h1>
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
      </div>

      {/* Moment Content */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden mb-4 md:mb-6">
        {/* Moment Header */}
        <div className="p-3 md:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <img src={post.author.avatar} alt={post.author.name} className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground text-sm md:text-base truncate">{post.author.name}</h3>
              <p className="text-xs md:text-sm text-muted-foreground">{post.author.timeAgo}</p>
            </div>
          </div>

          <Popover open={shareOpenTop} onOpenChange={setShareOpenTop}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground flex-shrink-0">
                <Share2 className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2 bg-background z-50" align="end">
              <div className="flex flex-col gap-1">
                <Button variant="ghost" className="justify-start gap-2" onClick={() => handleShare('whatsapp')}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </Button>
                <Button variant="ghost" className="justify-start gap-2" onClick={() => handleShare('facebook')}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Facebook
                </Button>
                <Button variant="ghost" className="justify-start gap-2" onClick={() => handleShare('twitter')}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                  Twitter
                </Button>
                <Button variant="ghost" className="justify-start gap-2" onClick={() => handleShare('linkedin')}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  LinkedIn
                </Button>
                <Button variant="ghost" className="justify-start gap-2" onClick={() => handleShare('copy')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Link
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Image */}
        {post.event?.image && (
          <div className="px-3 md:px-4">
            <img src={post.event.image} alt={post.event.title || 'Moment image'} className="w-full h-48 md:h-64 object-cover rounded-lg" />
          </div>
        )}

        {/* Content */}
        <div className="px-3 md:px-4 py-2 md:py-3">
          <h2 className="text-lg md:text-xl font-bold text-foreground mb-1">{post.event?.title || 'Moment Title'}</h2>
          {(post.event?.hostedBy || post.event?.date) && (
            <p className="text-xs md:text-sm text-muted-foreground">
              {post.event.hostedBy ? `Hosted by ${post.event.hostedBy}` : null}
              {post.event.hostedBy && post.event.date ? ' • ' : null}
              {post.event.date ? post.event.date : null}
            </p>
          )}
          {post.event?.text && <p className="mt-2 text-sm md:text-base text-foreground">{post.event.text}</p>}
        </div>

        {/* Action Buttons */}
        <div className="px-3 md:px-4 py-2 md:py-3 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex gap-2 w-full sm:w-auto justify-start">
            <button
              onClick={() => setLiked(!liked)}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-colors text-xs md:text-sm min-w-[60px] md:min-w-[80px] ${
                liked ? 'bg-red-100 text-red-600' : 'bg-gray-200/20 text-muted-foreground hover:bg-gray-200/30 hover:text-foreground'
              }`}
            >
              <Heart className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline whitespace-nowrap">{liked ? 'Glowed' : 'Glow'}</span>
            </button>

            <button
              onClick={() => {
                const echoSection = document.querySelector('.space-y-2.md\\:space-y-3');
                if (echoSection) {
                  echoSection.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-lg bg-gray-200/20 text-muted-foreground hover:bg-gray-200/30 hover:text-foreground transition-colors text-xs md:text-sm min-w-[60px] md:min-w-[80px]"
            >
              <MessageCircle className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline whitespace-nowrap">Echo</span>
            </button>

            <Popover open={shareOpenBottom} onOpenChange={setShareOpenBottom}>
              <PopoverTrigger asChild>
                <button className="flex items-center justify-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-lg bg-gray-200/20 text-muted-foreground hover:bg-gray-200/30 hover:text-foreground transition-colors text-xs md:text-sm min-w-[60px] md:min-w-[80px]">
                  <Share2 className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden sm:inline whitespace-nowrap">Spark</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2 bg-background z-50" align="start">
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" className="justify-start gap-2" onClick={() => handleShare('whatsapp')}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </Button>
                  <Button variant="ghost" className="justify-start gap-2" onClick={() => handleShare('facebook')}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Facebook
                  </Button>
                  <Button variant="ghost" className="justify-start gap-2" onClick={() => handleShare('twitter')}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                    </svg>
                    Twitter
                  </Button>
                  <Button variant="ghost" className="justify-start gap-2" onClick={() => handleShare('linkedin')}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    LinkedIn
                  </Button>
                  <Button variant="ghost" className="justify-start gap-2" onClick={() => handleShare('copy')}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Link
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground">
            <span>{post.likes + (liked ? 1 : 0)} {post.likes + (liked ? 1 : 0) === 1 ? 'Glow' : 'Glows'}</span>
            <span>{comments.length} {comments.length === 1 ? 'Echo' : 'Echoes'}</span>
          </div>
        </div>
      </div>

      {/* Echoes */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-3 md:p-4">
        <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Echoes ({comments.length})</h2>

        {/* Image preview (if any) */}
        {imagePreview && (
          <div className="mb-3 relative w-full max-h-40 md:max-h-48 rounded-lg overflow-hidden border border-border">
            <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
            <button
              onClick={removeImage}
              className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition-colors"
              aria-label="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input row using the same UI as Messages */}
        <div className="flex gap-2 md:gap-3 mb-3 md:mb-4">
          <img
            src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"
            alt="Your avatar"
            className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover flex-shrink-0"
          />

          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 md:gap-2 bg-transparent rounded-lg px-2 md:px-3 py-2 flex-1 border border-border min-w-0">
              <input
                type="text"
                placeholder="Add an echo..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                className="flex-1 bg-transparent text-muted-foreground text-sm outline-none placeholder:text-muted-foreground min-w-0"
                aria-label="Add an echo"
              />

              <label className="p-1.5 md:p-2 hover:bg-muted rounded-lg cursor-pointer transition-colors flex-shrink-0" title="Attach image">
                <ImageIcon className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                <input
                  ref={inputFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              <button className="p-1.5 md:p-2 hover:bg-muted rounded-lg transition-colors flex-shrink-0" title="Location">
                <MapPin className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
              </button>
            </div>

            <Button
              size="sm"
              className="px-3 md:px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 flex-shrink-0"
              onClick={sendEcho}
              disabled={!input.trim() && !imagePreview}
              aria-label="Post Echo"
            >
              <Send className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </Button>
          </div>
        </div>

        {/* Comments List */}
        <div className="space-y-2 md:space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-2 md:gap-3">
              <img src={comment.avatar} alt={comment.author} className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="bg-muted/50 rounded-lg p-2 md:p-3">
                  <div className="flex items-center gap-2 mb-1.5 md:mb-2">
                    <span className="font-semibold text-xs md:text-sm truncate">{comment.author}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{comment.timestamp}</span>
                  </div>

                  {comment.image && (
                    <div className="mb-2 rounded-lg overflow-hidden border border-border">
                      <img src={comment.image} alt="echo image" className="w-full h-32 md:h-40 object-cover" />
                    </div>
                  )}

                  {comment.content && <p className="text-sm break-words">{comment.content}</p>}
                </div>
              </div>
            </div>
          ))}

          {comments.length === 0 && <p className="text-center text-muted-foreground py-3 md:py-4 text-sm md:text-base">No echoes yet. Be the first to add one!</p>}
        </div>
      </div>
    </>
  );
};

export default MomentDetail;
