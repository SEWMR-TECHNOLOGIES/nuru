import { useState } from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from 'sonner';

interface MomentProps {
  post: {
    id: string;
    type: 'event' | 'memorial' | 'wedding' | 'birthday';
    author: {
      name: string;
      avatar: string;
      timeAgo: string;
    };
    // event and content may both exist; prefer event values but fallback to content
    event?: {
      title?: string;
      text?: string;
      image?: string;
      hostedBy?: string;
      date?: string;
    };
    content?: {
      title?: string;
      text?: string;
      image?: string;
    };
    likes: number;
    comments: number;
  };
}

const Moment = ({ post }: MomentProps) => {
  const [liked, setLiked] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const navigate = useNavigate();
  const toggleLike = () => setLiked(!liked);


  // Resolve fields from either event or content (event preferred)
  const title =
    post.event?.title?.trim() ||
    post.content?.title?.trim() ||
    // fallback title if nothing provided
    `${post.type.charAt(0).toUpperCase() + post.type.slice(1)} by ${post.author.name}`;

  const text =
    post.event?.text?.trim() ||
    post.content?.text?.trim() ||
    ''; // keep empty if no text available

  const image = post.event?.image || post.content?.image || undefined;
  const hostedBy = post.event?.hostedBy;
  const date = post.event?.date;

  const shareUrl = `${window.location.origin}/post/${post.id}`;
  const shareTitle = title;

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
        setShareOpen(false);
        return;
    }
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      setShareOpen(false);
    }
  };

  const handlePostClick = () => {
    const scrollContainer = document.querySelector('.flex-1.overflow-y-auto');
    if (scrollContainer) {
      sessionStorage.setItem('feedScrollPosition', scrollContainer.scrollTop.toString());
    }
    navigate(`/post/${post.id}`, { state: { post } });
  };

  return (
    <div
      className="bg-card rounded-lg shadow-sm border border-border overflow-hidden cursor-pointer"
      onClick={handlePostClick}
    >
      {/* Post Header */}
      <div className="p-3 md:p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-3">
          <img
            src={post.author.avatar}
            alt={post.author.name}
            className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover"
          />
          <div>
            <h3 className="font-semibold text-sm md:text-base text-foreground">{post.author.name}</h3>
            <p className="text-xs md:text-sm text-muted-foreground">{post.author.timeAgo}</p>
          </div>
        </div>

        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </div>

      {/* Image (if any) */}
      {image && (
        <div className="px-3 md:px-4">
          <img
            src={image}
            alt={title || 'Post image'}
            className="w-full h-48 md:h-64 object-cover rounded-lg"
          />
        </div>
      )}

      {/* Title and meta */}
      <div className="px-3 md:px-4 py-3">
        <h2 className="text-lg md:text-xl font-bold text-foreground mb-1">{title}</h2>

        {(hostedBy || date) && (
          <p className="text-xs md:text-sm text-muted-foreground">
            {hostedBy ? `Hosted by ${hostedBy}` : null}
            {hostedBy && date ? ' • ' : null}
            {date ? date : null}
          </p>
        )}

        {text ? (
          <div className="mt-2">
            <p className="text-foreground">{text}</p>
          </div>
        ) : null}
      </div>

      {/* Action Buttons */}
      <div className="px-3 md:px-4 py-2 md:py-3 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-2 w-full sm:w-auto justify-start">
          {/* Glow */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleLike();
            }}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-colors text-xs md:text-sm min-w-[60px] md:min-w-[80px] ${
              liked
                ? 'bg-red-100 text-red-600'
                : 'bg-gray-200/20 text-muted-foreground hover:bg-gray-200/30 hover:text-foreground'
            }`}
          >
            <Heart className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">{liked ? 'Glowed' : 'Glow'}</span>
          </button>

          {/* Echo */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              const scrollContainer = document.querySelector('.flex-1.overflow-y-auto');
              if (scrollContainer) {
                sessionStorage.setItem('feedScrollPosition', scrollContainer.scrollTop.toString());
              }
              navigate(`/post/${post.id}`, { state: { post } });
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-lg bg-gray-200/20 text-muted-foreground hover:bg-gray-200/30 hover:text-foreground transition-colors text-xs md:text-sm min-w-[60px] md:min-w-[80px]"
          >
            <MessageCircle className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">Echo</span>
          </button>

          {/* Spark */}
          <Popover open={shareOpen} onOpenChange={setShareOpen}>
            <PopoverTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-lg bg-gray-200/20 text-muted-foreground hover:bg-gray-200/30 hover:text-foreground transition-colors text-xs md:text-sm min-w-[60px] md:min-w-[80px]"
              >
                <Share2 className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline whitespace-nowrap">Spark</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  className="justify-start gap-2"
                  onClick={() => handleShare('whatsapp')}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start gap-2"
                  onClick={() => handleShare('facebook')}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Facebook
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start gap-2"
                  onClick={() => handleShare('twitter')}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                  Twitter
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start gap-2"
                  onClick={() => handleShare('linkedin')}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  LinkedIn
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start gap-2"
                  onClick={() => handleShare('copy')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Link
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Counts */}
        <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground">
          <span>
            {post.likes + (liked ? 1 : 0)}{' '}
            {(post.likes + (liked ? 1 : 0)) === 1 ? 'Glow' : 'Glows'}
          </span>
          <span>
            {post.comments} {post.comments === 1 ? 'Echo' : 'Echoes'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Moment;
