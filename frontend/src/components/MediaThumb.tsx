import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaThumbProps {
  url: string;
  mediaType?: string | null;
  alt?: string;
  className?: string;
  showPlayBadge?: boolean;
  durationSeconds?: number | null;
  onClick?: (e: React.MouseEvent) => void;
  loading?: "eager" | "lazy";
}

const fmtDur = (s: number) => {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
};

/**
 * Renders a photo (<img>) or video thumbnail (<video preload=metadata>) so
 * browsers display the first frame instead of a broken-image icon.
 */
export const MediaThumb: React.FC<MediaThumbProps> = ({
  url,
  mediaType,
  alt = "",
  className,
  showPlayBadge = true,
  durationSeconds,
  onClick,
  loading = "lazy",
}) => {
  const isVideo = (mediaType || "").toLowerCase() === "video";

  if (!isVideo) {
    return (
      <img
        src={url}
        alt={alt}
        className={className}
        onClick={onClick}
        loading={loading}
      />
    );
  }

  return (
    <div className={cn("relative", className)} onClick={onClick}>
      <video
        src={url}
        muted
        playsInline
        preload="metadata"
        className="w-full h-full object-cover block"
      />
      {showPlayBadge && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-5 h-5 text-white fill-white" />
          </div>
        </div>
      )}
      {typeof durationSeconds === "number" && durationSeconds > 0 && (
        <span className="absolute bottom-1.5 right-1.5 text-[10px] font-semibold text-white bg-black/70 px-1.5 py-0.5 rounded">
          {fmtDur(durationSeconds)}
        </span>
      )}
    </div>
  );
};

export default MediaThumb;
