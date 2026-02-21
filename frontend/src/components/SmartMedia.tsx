import { useState, useEffect } from "react";
import VideoPlayer from "@/components/VideoPlayer";

interface SmartMediaProps {
  src: string;
  alt: string;
  className: string;
  isVideo: boolean;
  compact?: boolean;
}

/**
 * Renders media as either an image or video player.
 * Uses multiple detection strategies:
 * 1. isVideo prop (from media_type or URL pattern)
 * 2. onError fallback if img fails to load
 * 3. onLoad check if naturalWidth is 0 (video loaded as img)
 * 4. Content-type probe via HEAD request as last resort
 */
const SmartMedia = ({ src, alt, className, isVideo, compact }: SmartMediaProps) => {
  const [forceVideo, setForceVideo] = useState(false);
  const [probed, setProbed] = useState(false);

  // If not detected as video by props, probe the content-type
  useEffect(() => {
    if (isVideo || forceVideo || probed || !src) return;
    setProbed(true);

    // Try a HEAD request to check content-type
    fetch(src, { method: 'HEAD', mode: 'cors' })
      .then((res) => {
        const ct = res.headers.get('content-type') || '';
        if (ct.startsWith('video/')) {
          setForceVideo(true);
        }
      })
      .catch(() => {
        // CORS blocked or network error - rely on onError/onLoad fallbacks
      });
  }, [src, isVideo, forceVideo, probed]);

  if (isVideo || forceVideo) {
    return <VideoPlayer src={src} className={className} compact={compact} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setForceVideo(true)}
      onLoad={(e) => {
        const img = e.currentTarget;
        // If the browser loaded it but can't render (naturalWidth 0), it's likely a video
        if (img.naturalWidth === 0 && img.naturalHeight === 0) {
          setForceVideo(true);
        }
      }}
    />
  );
};

export default SmartMedia;
