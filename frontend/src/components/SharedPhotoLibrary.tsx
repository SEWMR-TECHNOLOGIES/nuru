import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Globe, Lock, X, ZoomIn, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { photoLibrariesApi, PhotoLibrary } from '@/lib/api/photoLibraries';
import { showCaughtError } from '@/lib/api';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import PhotosIcon from '@/assets/icons/photos-icon.svg';
import CalendarIconSVG from '@/assets/icons/calendar-icon.svg';
import LocationIcon from '@/assets/icons/location-icon.svg';

const SharedPhotoLibrary = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [library, setLibrary] = useState<PhotoLibrary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useWorkspaceMeta({
    title: library?.name || 'Shared Photo Library',
    description: 'View shared event photo library'
  });

  const fetchLibrary = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await photoLibrariesApi.getLibraryByToken(token);
      if (res.success && res.data) {
        setLibrary(res.data);
      } else {
        setError(res.message || 'Library not found');
      }
    } catch (err) {
      showCaughtError(err);
      setError('Library not found or access denied');
    }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchLibrary(); }, [fetchLibrary]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto pb-16 px-4">
        <Skeleton className="w-full h-44 rounded-2xl mb-6 mt-4" />
        <div className="columns-2 md:columns-3 gap-3 space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className={`w-full rounded-xl break-inside-avoid ${i % 3 === 0 ? 'h-52' : i % 3 === 1 ? 'h-36' : 'h-44'}`} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !library) {
    return (
      <div className="max-w-5xl mx-auto px-4 text-center py-24">
        <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-6">
          <img src={PhotosIcon} alt="" className="w-10 h-10 opacity-30 dark:invert" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Library Not Found</h2>
        <p className="text-muted-foreground mb-6">{error || 'This photo library does not exist or is private.'}</p>
        <Button variant="outline" onClick={() => navigate('/')}>Go Home</Button>
      </div>
    );
  }

  const photos = library.photos || [];

  return (
    <div className="max-w-5xl mx-auto pb-16 px-4">

      {/* no back button on shared/public view */}

      {/* ─── HERO HEADER ─── */}
      <div className="relative rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-primary/20 via-primary/10 to-background border border-border h-44">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)', backgroundSize: '28px 28px' }} />
        {photos.length > 0 && (
          <div className="absolute inset-0">
            <img src={photos[0].url} alt="" className="w-full h-full object-cover opacity-30" />
          </div>
        )}
        <div className="absolute inset-0 flex flex-col justify-end p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{library.name}</h1>
              {library.event && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                  {library.event.start_date && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <img src={CalendarIconSVG} alt="" className="w-3.5 h-3.5 dark:invert opacity-60" />
                      <span>{new Date(library.event.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                  )}
                  {library.event.location && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <img src={LocationIcon} alt="" className="w-3.5 h-3.5 dark:invert opacity-60" />
                      <span>{library.event.location}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Badge className={`text-[11px] gap-1 border-0 ${library.privacy === 'public' ? 'bg-emerald-500/90 text-white' : 'bg-black/50 text-white'}`}>
                {library.privacy === 'public' ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {library.privacy === 'public' ? 'Public' : 'Private'}
              </Badge>
              <span className="text-xs text-muted-foreground bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full">
                {library.photo_count} photo{library.photo_count !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {library.description && (
        <p className="text-sm text-muted-foreground mb-6">{library.description}</p>
      )}

      {/* ─── PHOTO GRID ─── */}
      {photos.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
          <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <img src={PhotosIcon} alt="" className="w-10 h-10 opacity-30 dark:invert" />
          </div>
          <h3 className="text-xl font-bold mb-2">No Photos Yet</h3>
          <p className="text-muted-foreground text-sm">This library doesn't have any photos yet.</p>
        </div>
      ) : (
        <div className="columns-2 md:columns-3 gap-3 space-y-3">
          {photos.map((photo, idx) => (
            <div
              key={photo.id}
              className="break-inside-avoid relative group rounded-xl overflow-hidden cursor-zoom-in bg-muted"
              onClick={() => setLightboxIdx(idx)}
            >
              <img src={photo.url} alt={photo.caption || `Photo ${idx + 1}`} className="w-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <p className="text-white text-xs">{photo.caption}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── LIGHTBOX ─── */}
      {lightboxIdx !== null && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={() => setLightboxIdx(null)}>
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <a
              href={photos[lightboxIdx].url}
              download
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              onClick={e => e.stopPropagation()}
              title="Download photo"
            >
              <Download className="w-5 h-5" />
            </a>
            <button className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors" onClick={() => setLightboxIdx(null)}>
              <X className="w-5 h-5" />
            </button>
          </div>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onClick={(e) => { e.stopPropagation(); setLightboxIdx(i => i !== null ? Math.max(0, i - 1) : 0); }}
          ><ChevronLeft className="w-5 h-5" /></button>
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onClick={(e) => { e.stopPropagation(); setLightboxIdx(i => i !== null ? Math.min(photos.length - 1, i + 1) : 0); }}
          ><ChevronRight className="w-5 h-5" /></button>
          <img
            src={photos[lightboxIdx].url}
            alt=""
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm bg-black/40 px-3 py-1 rounded-full">
            {lightboxIdx + 1} / {photos.length}
          </div>
        </div>
      )}
    </div>
  );
};

export default SharedPhotoLibrary;
