import { useState } from 'react';
import { Heart, MessageCircle, MoreHorizontal } from 'lucide-react';
import SvgIcon from '@/components/ui/svg-icon';
import ShareIcon from '@/assets/icons/share-icon.svg';
import { Button } from '@/components/ui/button';
import ShareMenu from '@/components/ShareMenu';
import { useNavigate } from 'react-router-dom';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";


interface PostProps {
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

const Post = ({ post }: PostProps) => {
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

  const shareUrl = `${window.location.origin}/shared/post/${post.id}`;
  const shareTitle = title;

  // Share logic moved to ShareMenu component

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
            <span className="text-sm flex-shrink-0">❤️</span>
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
                <img src={ShareIcon} alt="" className="w-4 h-4 flex-shrink-0 dark:invert opacity-70" />
                <span className="hidden sm:inline whitespace-nowrap">Spark</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col gap-1">
                <ShareMenu shareUrl={shareUrl} shareTitle={shareTitle} onClose={() => setShareOpen(false)} />
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

export default Post;
