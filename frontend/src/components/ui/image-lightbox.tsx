import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { createPortal } from 'react-dom';
import { downloadFile } from '@/utils/downloadFile';

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

const ImageLightbox = ({ images, initialIndex = 0, open, onClose }: ImageLightboxProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);
  const [entering, setEntering] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setZoomed(false);
      setEntering(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntering(false));
      });
    }
  }, [open, initialIndex]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, currentIndex]);

  const handleClose = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setExiting(false);
      onClose();
    }, 200);
  }, [onClose]);

  const next = useCallback(() => {
    if (images.length > 1) {
      setCurrentIndex(i => (i + 1) % images.length);
      setZoomed(false);
    }
  }, [images.length]);

  const prev = useCallback(() => {
    if (images.length > 1) {
      setCurrentIndex(i => (i - 1 + images.length) % images.length);
      setZoomed(false);
    }
  }, [images.length]);

  const handleDownload = () => {
    downloadFile(images[currentIndex], `image-${currentIndex + 1}`);
  };

  if (!open && !exiting) return null;

  const opacity = entering || exiting ? 'opacity-0' : 'opacity-100';
  const scale = entering || exiting ? 'scale-95' : 'scale-100';

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-200 ${opacity}`}
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3">
        <div className="text-white/70 text-sm font-medium">
          {images.length > 1 && `${currentIndex + 1} / ${images.length}`}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setZoomed(z => !z); }}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={zoomed ? 'Zoom out' : 'Zoom in'}
          >
            {zoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Download"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleClose(); }}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-2 md:left-4 z-10 p-2 md:p-3 rounded-full bg-black/40 text-white/80 hover:bg-black/60 hover:text-white transition-all active:scale-95"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-2 md:right-4 z-10 p-2 md:p-3 rounded-full bg-black/40 text-white/80 hover:bg-black/60 hover:text-white transition-all active:scale-95"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </>
      )}

      {/* Image */}
      <div
        className={`relative z-[1] flex items-center justify-center w-full h-full px-12 py-16 transition-transform duration-200 ${scale}`}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={images[currentIndex]}
          alt={`Image ${currentIndex + 1}`}
          className={`max-w-full max-h-full object-contain select-none transition-transform duration-300 ${
            zoomed ? 'scale-[2] cursor-zoom-out' : 'cursor-zoom-in'
          }`}
          onClick={() => setZoomed(z => !z)}
          draggable={false}
        />
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center gap-2 px-4">
          <div className="flex gap-1.5 p-1.5 rounded-full bg-black/50 backdrop-blur-sm max-w-[90vw] overflow-x-auto">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); setZoomed(false); }}
                className={`w-10 h-10 md:w-12 md:h-12 rounded-lg overflow-hidden flex-shrink-0 ring-2 transition-all active:scale-95 ${
                  idx === currentIndex ? 'ring-white scale-105' : 'ring-transparent opacity-50 hover:opacity-80'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default ImageLightbox;

/** Convenience hook to manage lightbox state */
export const useLightbox = () => {
  const [state, setState] = useState<{ open: boolean; images: string[]; index: number }>({
    open: false, images: [], index: 0,
  });

  const openLightbox = useCallback((images: string[], index = 0) => {
    setState({ open: true, images, index });
  }, []);

  const closeLightbox = useCallback(() => {
    setState(prev => ({ ...prev, open: false }));
  }, []);

  return { ...state, openLightbox, closeLightbox };
};
