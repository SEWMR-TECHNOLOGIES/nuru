import { useState } from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { socialApi } from '@/lib/api/social';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from 'sonner';

interface MomentProps {
  post: {
    id: string;
    type: string;
    author: {
      name: string;
      avatar: string;
      timeAgo: string;
    };
    content?: {
      title?: string;
      text?: string;
      image?: string;
    };
    likes: number;
    comments: number;
    has_glowed?: boolean;
  };
}

const Moment = ({ post }: MomentProps) => {
  const [glowed, setGlowed] = useState(post.has_glowed || false);
  const [glowCount, setGlowCount] = useState(post.likes);
  const [glowing, setGlowing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const navigate = useNavigate();

  const handleGlow = async () => {
    if (glowing) return;
    setGlowing(true);
    // Optimistic update
    const wasGlowed = glowed;
    setGlowed(!wasGlowed);
    setGlowCount(prev => wasGlowed ? prev - 1 : prev + 1);
    try {
      if (wasGlowed) {
        await socialApi.unglowPost(post.id);
      } else {
        await socialApi.glowPost(post.id);
      }
    } catch {
      // Revert on failure
      setGlowed(wasGlowed);
      setGlowCount(prev => wasGlowed ? prev + 1 : prev - 1);
      toast.error('Failed to update glow');
    } finally {
      setGlowing(false);
    }
  };

  const title = post.content?.title?.trim() || '';
  const text = post.content?.text?.trim() || '';
  const image = post.content?.image || undefined;

  const shareUrl = `${window.location.origin}/post/${post.id}`;
  const shareTitle = title || text?.slice(0, 50) || 'Check this out';

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
      case 'copy':
        navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied!');
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
    navigate(`/post/${post.id}`);
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

      {/* Image */}
      {image && (
        <div className="px-3 md:px-4">
          <img
            src={image}
            alt={title || 'Post image'}
            className="w-full max-h-[500px] object-contain rounded-lg bg-muted/30"
          />
        </div>
      )}

      {/* Title and text */}
      <div className="px-3 md:px-4 py-3">
        {title && <h2 className="text-lg md:text-xl font-bold text-foreground mb-1">{title}</h2>}
        {text && <p className="text-foreground text-sm md:text-base">{text}</p>}
      </div>

      {/* Action Buttons */}
      <div className="px-3 md:px-4 py-2 md:py-3 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-2 w-full sm:w-auto justify-start">
          {/* Glow */}
          <button
            onClick={(e) => { e.stopPropagation(); handleGlow(); }}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-colors text-xs md:text-sm min-w-[60px] md:min-w-[80px] ${
              glowed
                ? 'bg-red-100 text-red-600'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Heart className={`w-4 h-4 flex-shrink-0 ${glowed ? 'fill-current' : ''}`} />
            <span className="hidden sm:inline whitespace-nowrap">{glowed ? 'Glowed' : 'Glow'}</span>
          </button>

          {/* Echo */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePostClick();
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-xs md:text-sm min-w-[60px] md:min-w-[80px]"
          >
            <MessageCircle className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">Echo</span>
          </button>

          {/* Spark */}
          <Popover open={shareOpen} onOpenChange={setShareOpen}>
            <PopoverTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-xs md:text-sm min-w-[60px] md:min-w-[80px]"
              >
                <Share2 className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline whitespace-nowrap">Spark</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col gap-1">
                {['whatsapp', 'facebook', 'twitter', 'copy'].map((p) => (
                  <Button key={p} variant="ghost" className="justify-start gap-2 text-sm capitalize" onClick={() => handleShare(p)}>
                    {p === 'copy' ? 'Copy Link' : p}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Counts */}
        <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground">
          <span>{glowCount} {glowCount === 1 ? 'Glow' : 'Glows'}</span>
          <span>{post.comments} {post.comments === 1 ? 'Echo' : 'Echoes'}</span>
        </div>
      </div>
    </div>
  );
};

export default Moment;
