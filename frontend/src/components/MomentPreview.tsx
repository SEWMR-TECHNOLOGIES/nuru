import { Heart, MessageCircle, Share2 } from 'lucide-react';
import CustomImageIcon from '@/assets/icons/image-icon.svg';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface LocationData {
  latitude: number;
  longitude: number;
  name?: string;
}

interface MomentPreviewProps {
  text: string;
  previews: string[];
  location: LocationData | null;
}

const MomentPreview = ({ text, previews, location }: MomentPreviewProps) => {
  const { data: currentUser } = useCurrentUser();
  
  // Don't show preview if nothing to display
  if (!text.trim() && previews.length === 0 && !location) {
    return null;
  }

  const renderAvatar = () => {
    if (currentUser?.avatar) {
      return (
        <img
          src={currentUser.avatar}
          alt="Profile"
          className="w-full h-full object-cover"
        />
      );
    } else if (currentUser) {
      const initials = `${currentUser.first_name[0]}${currentUser.last_name[0]}`.toUpperCase();
      return (
        <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-xs font-semibold">
          {initials}
        </div>
      );
    }
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
        ?
      </div>
    );
  };

  const userName = currentUser 
    ? `${currentUser.first_name} ${currentUser.last_name}`
    : 'You';

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
        <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
        Live Preview
      </div>
      
      <div className="bg-muted/30 rounded-xl p-3 md:p-4 border border-border/50">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-primary/20">
            {renderAvatar()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground text-sm">{userName}</span>
              <span className="text-xs text-muted-foreground">• Just now</span>
            </div>
            {location && (
              <span className="text-xs mt-0.5">
                <span className="text-muted-foreground">at </span>
                <span style={{ color: '#1c274c' }} className="font-medium">{location.name}</span>
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        {text.trim() && (
          <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap mb-3">
            {text}
          </p>
        )}

        {/* Images */}
        {previews.length > 0 && (
          <div className={`rounded-lg overflow-hidden ${previews.length === 1 ? '' : 'grid gap-1'}`}
            style={previews.length > 1 ? { gridTemplateColumns: previews.length === 2 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)' } : undefined}
          >
            {previews.slice(0, 6).map((src, idx) => (
              <div 
                key={idx} 
                className={`relative bg-muted ${previews.length === 1 ? 'aspect-video' : 'aspect-square'}`}
              >
                <img
                  src={src}
                  alt={`Preview ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                {idx === 5 && previews.length > 6 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white font-semibold text-lg">+{previews.length - 6}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty state placeholder */}
        {!text.trim() && previews.length === 0 && location && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <div className="text-center">
              <img src={CustomImageIcon} alt="Image" className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">Add text or images to your moment</p>
            </div>
          </div>
        )}

        {/* Engagement Preview */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50 text-muted-foreground text-xs">
          <span className="flex items-center gap-1">
            <Heart className="w-3.5 h-3.5" />
            Glow
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="w-3.5 h-3.5" />
            Echo
          </span>
          <span className="flex items-center gap-1">
            <Share2 className="w-3.5 h-3.5" />
            Spark
          </span>
        </div>
      </div>
    </div>
  );
};

export default MomentPreview;
