import { useState } from 'react';
import VideoPlayer from '@/components/VideoPlayer';
import SmartMedia from '@/components/SmartMedia';
import { Heart, MessageCircle, Bookmark } from 'lucide-react';
import SvgIcon from '@/components/ui/svg-icon';
import ShareIcon from '@/assets/icons/share-icon.svg';
import ShareMenu from '@/components/ShareMenu';
import TicketIcon from '@/assets/icons/ticket-icon.svg';
import CustomCalendarIcon from '@/assets/icons/calendar-icon.svg';
import CustomLocationIcon from '@/assets/icons/location-icon.svg';
import CustomClockIcon from '@/assets/icons/clock-icon.svg';
import { VerifiedUserBadge } from '@/components/ui/verified-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { socialApi } from '@/lib/api/social';
import { usePostViewTracking, useInteractionLogger } from '@/hooks/useFeedTracking';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';

interface SharedEvent {
  id: string;
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  location?: string;
  cover_image?: string;
  images?: string[];
  event_type?: string;
  sells_tickets?: boolean;
  is_public?: boolean;
  expected_guests?: number;
  dress_code?: string;
}

interface MomentProps {
  post: {
    id: string;
    type: string;
    author: {
      name: string;
      avatar: string;
      timeAgo: string;
      is_verified?: boolean;
    };
    content?: {
      title?: string;
      text?: string;
      image?: string;
      images?: string[];
      media_types?: string[];
    };
    likes: number;
    comments: number;
    has_glowed?: boolean;
    has_saved?: boolean;
    shared_event?: SharedEvent | null;
    share_expires_at?: string | null;
  };
}

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.charAt(0).toUpperCase();
};

const Moment = ({ post }: MomentProps) => {
  const [glowed, setGlowed] = useState(post.has_glowed || false);
  const [glowCount, setGlowCount] = useState(post.likes);
  const [glowing, setGlowing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [saved, setSaved] = useState(post.has_saved || false);
  const [saving, setSaving] = useState(false);

  // Feed ranking: viewport tracking for view/dwell signals
  const viewTrackingRef = usePostViewTracking(post.id);
  const { logInteraction } = useInteractionLogger();

  const handleGlow = async () => {
    if (glowing) return;
    setGlowing(true);
    const wasGlowed = glowed;
    setGlowed(!wasGlowed);
    setGlowCount(prev => wasGlowed ? prev - 1 : prev + 1);
    // Track interaction for ranking
    logInteraction(post.id, wasGlowed ? 'unglow' : 'glow');
    try {
      if (wasGlowed) await socialApi.unglowPost(post.id);
      else await socialApi.glowPost(post.id);
    } catch {
      setGlowed(wasGlowed);
      setGlowCount(prev => wasGlowed ? prev + 1 : prev - 1);
      toast.error('Failed to update glow');
    } finally {
      setGlowing(false);
    }
  };

  const navigate = useNavigate();

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saving) return;
    setSaving(true);
    const wasSaved = saved;
    setSaved(!wasSaved);
    logInteraction(post.id, wasSaved ? 'unsave' : 'save');
    try {
      if (wasSaved) await socialApi.unsavePost(post.id);
      else await socialApi.savePost(post.id);
      toast.success(wasSaved ? 'Unsaved' : 'Saved!');
    } catch {
      setSaved(wasSaved);
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const isEventShare = post.type === 'event_share' && !!post.shared_event;
  const sharedEvent = post.shared_event;

  const title = post.content?.title?.trim() || '';
  const text = post.content?.text?.trim() || '';
  const image = post.content?.image || undefined;
  const allImages = post.content?.images?.length ? post.content.images : (image ? [image] : []);
  const mediaTypes = post.content?.media_types || [];

  const isVideoUrl = (url: string, idx: number) => {
    const mt = mediaTypes[idx];
    if (mt && mt !== 'image' && (mt === 'video' || mt.startsWith('video'))) return true;
    const urlPath = url.split('?')[0];
    return /\.(mp4|webm|mov|avi|mkv|m4v|3gp)$/i.test(urlPath) || /video/i.test(url);
  };

  // For event shares, use event images if post has none
  const eventImages = sharedEvent?.images?.length ? sharedEvent.images : (sharedEvent?.cover_image ? [sharedEvent.cover_image] : []);

  // Use /shared/post/ URL for sharing
  const shareUrl = `${window.location.origin}/shared/post/${post.id}`;
  const shareTitle = isEventShare ? (sharedEvent?.title || 'Event') : (title || text?.slice(0, 50) || 'Check this out');


  const handlePostClick = () => {
    const scrollContainer = document.querySelector('.flex-1.overflow-y-auto');
    if (scrollContainer) {
      sessionStorage.setItem('feedScrollPosition', scrollContainer.scrollTop.toString());
    }
    navigate(`/post/${post.id}`);
  };

  const authorAvatar = post.author.avatar;
  const isPlaceholderAvatar = !authorAvatar || authorAvatar.includes('unsplash.com');

  return (
    <div
      ref={viewTrackingRef}
      className="bg-card rounded-lg shadow-sm border border-border overflow-hidden cursor-pointer"
      onClick={handlePostClick}
    >
      {/* Post Header */}
      <div className="p-3 md:p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-3">
          {!isPlaceholderAvatar ? (
            <img
              src={authorAvatar}
              alt={post.author.name}
              className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
              {getInitials(post.author.name)}
            </div>
          )}
          <div>
            <h3 className="font-semibold text-sm md:text-base text-foreground flex items-center gap-1.5">
              {post.author.name}
              {post.author.is_verified && <VerifiedUserBadge size="xs" />}
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground">{post.author.timeAgo}</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
        >
          <Bookmark className={`w-4 h-4 ${saved ? 'fill-current text-primary' : ''}`} />
        </button>
      </div>

      {/* ── EVENT SHARE CARD ── */}
      {isEventShare && sharedEvent ? (
        <div className="mx-3 md:mx-4 mb-3">
          {/* Caption above event card */}
          {text && (
            <p className="text-foreground text-sm md:text-base whitespace-pre-wrap break-words mb-3">{text}</p>
          )}

          <div
            className="rounded-xl border border-border overflow-hidden bg-muted/20 hover:bg-muted/40 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/event/${sharedEvent.id}`);
            }}
          >
            {/* Event Hero Image(s) */}
            {eventImages.length > 0 && (
              <div className="relative">
                {eventImages.length === 1 ? (
                  <img
                    src={eventImages[0]}
                    alt={sharedEvent.title}
                    className="w-full h-48 sm:h-56 object-cover"
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-0.5 h-48 sm:h-56">
                    <img
                      src={eventImages[0]}
                      alt={sharedEvent.title}
                      className={`w-full h-full object-cover ${eventImages.length === 2 ? '' : 'row-span-2'}`}
                    />
                    {eventImages.length === 2 ? (
                      <img src={eventImages[1]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <img src={eventImages[1]} alt="" className="w-full flex-1 object-cover" />
                        {eventImages.length > 2 && (
                          <div className="relative flex-1">
                            <img src={eventImages[2]} alt="" className="w-full h-full object-cover" />
                            {eventImages.length > 3 && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <span className="text-white font-bold text-lg">+{eventImages.length - 3}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {/* Overlay badges */}
                <div className="absolute top-3 left-3 flex gap-2">
                  {sharedEvent.event_type && (
                    <Badge className="bg-primary/90 text-primary-foreground text-xs backdrop-blur-sm">
                      {sharedEvent.event_type}
                    </Badge>
                  )}
                  {sharedEvent.sells_tickets && (
                    <Badge className="bg-accent text-accent-foreground text-xs backdrop-blur-sm gap-1">
                      <img src={TicketIcon} alt="Ticket" className="w-3 h-3 dark:invert" /> Tickets
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Event Info */}
            <div className="p-4 space-y-3">
              <h3 className="text-lg font-bold text-foreground leading-tight">{sharedEvent.title}</h3>

              {sharedEvent.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{sharedEvent.description}</p>
              )}

              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {sharedEvent.start_date && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <img src={CustomCalendarIcon} alt="" className="w-4 h-4 flex-shrink-0 dark:invert" />
                    <span>
                      {new Date(sharedEvent.start_date).toLocaleDateString('en-GB', {
                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </span>
                  </div>
                )}
                {sharedEvent.start_time && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <img src={CustomClockIcon} alt="" className="w-4 h-4 flex-shrink-0 dark:invert" />
                    <span>{sharedEvent.start_time}</span>
                  </div>
                )}
                {sharedEvent.location && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <img src={CustomLocationIcon} alt="" className="w-4 h-4 flex-shrink-0 dark:invert" />
                    <span className="truncate max-w-[200px]">{sharedEvent.location}</span>
                  </div>
                )}
              </div>

              {sharedEvent.dress_code && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Dress Code:</span> {sharedEvent.dress_code}
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 mt-1"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/event/${sharedEvent.id}`);
                }}
              >
                View Event Details
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Regular Media (Images + Videos) */}
          {allImages.length > 0 && (
            <div className={`px-3 md:px-4 ${allImages.length > 1 ? 'flex gap-2 overflow-x-auto py-1' : ''}`}>
              {allImages.length === 1 ? (
                <SmartMedia
                  src={allImages[0]}
                  alt={title || 'Post image'}
                  className="w-full max-h-[500px] object-contain rounded-lg bg-muted/30"
                  isVideo={isVideoUrl(allImages[0], 0)}
                />
              ) : (
                allImages.map((imgUrl, idx) => (
                  <SmartMedia
                    key={idx}
                    src={imgUrl}
                    alt={`Post ${idx + 1}`}
                    className={isVideoUrl(imgUrl, idx)
                      ? "w-40 h-32 md:w-48 md:h-40 flex-shrink-0 rounded-lg"
                      : "w-40 h-32 md:w-48 md:h-40 flex-shrink-0 object-cover rounded-lg"
                    }
                    isVideo={isVideoUrl(imgUrl, idx)}
                    compact
                  />
                ))
              )}
            </div>
          )}

          {/* Title and text */}
          <div className="px-3 md:px-4 py-3">
            {title && <h2 className="text-lg md:text-xl font-bold text-foreground mb-1">{title}</h2>}
            {text && <p className="text-foreground text-sm md:text-base whitespace-pre-wrap break-words">{text}</p>}
          </div>
        </>
      )}

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
            <span className="text-sm flex-shrink-0">❤️</span>
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
                <img src={ShareIcon} alt="" className="w-4 h-4 flex-shrink-0 dark:invert opacity-70" />
                <span className="hidden sm:inline whitespace-nowrap">Spark</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start" onClick={(e) => e.stopPropagation()}>
              <ShareMenu shareUrl={shareUrl} shareTitle={shareTitle} onClose={() => setShareOpen(false)} />
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
