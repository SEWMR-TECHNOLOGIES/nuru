import { useState, useRef, useEffect } from "react";
import { Pause, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";
import PlayIcon from "@/assets/icons/play-icon.svg";
import SvgIcon from "@/components/ui/svg-icon";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  compact?: boolean;
}

const VideoPlayer = ({ src, poster, className = "", autoPlay = false, compact = false }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState("0:00");
  const [currentTime, setCurrentTime] = useState("0:00");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
        setCurrentTime(formatTime(video.currentTime));
      }
    };
    const onLoadedMetadata = () => {
      setDuration(formatTime(video.duration));
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, []);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      videoRef.current.play();
      setPlaying(true);
    } else {
      videoRef.current.pause();
      setPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setMuted(!muted);
  };

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    videoRef.current.currentTime = percent * videoRef.current.duration;
  };

  return (
    <div
      ref={containerRef}
      className={`relative group rounded-2xl overflow-hidden bg-[#0A0A0A] ${className}`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-contain"
        autoPlay={autoPlay}
        muted={muted}
        loop
        playsInline
        onClick={togglePlay}
        onEnded={() => setPlaying(false)}
      />

      {/* Play overlay when not playing */}
      {!playing && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer backdrop-blur-[1px]"
          onClick={togglePlay}
        >
          <div className="flex items-center justify-center">
            <SvgIcon src={PlayIcon} alt="Play" className="w-12 h-12 drop-shadow-xl" forceWhite />
          </div>
        </div>
      )}

      {/* Duration badge */}
      {!playing && (
        <div className="absolute top-3 right-3 px-2.5 py-1 bg-black/60 rounded-lg backdrop-blur-sm">
          <span className="text-[11px] font-semibold text-white/90 font-mono">{duration}</span>
        </div>
      )}

      {/* Controls bar */}
      {showControls && playing && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent pt-8 pb-3 px-3">
          {/* Progress bar */}
          <div
            className="w-full h-1 bg-white/20 rounded-full mb-3 cursor-pointer group/progress"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-primary rounded-full relative transition-all"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover/progress:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="p-1.5 text-white/90 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              {playing ? <Pause className="w-4 h-4" /> : <SvgIcon src={PlayIcon} alt="Play" className="w-4 h-4" forceWhite />}
            </button>
            <button
              onClick={toggleMute}
              className="p-1.5 text-white/90 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <span className="text-[11px] text-white/60 font-mono ml-1">
              {currentTime} / {duration}
            </span>

            <div className="flex-1" />

            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-white/90 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
