import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Globe, Lock, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { photoLibrariesApi, PhotoLibrary } from '@/lib/api/photoLibraries';
import { showCaughtError } from '@/lib/api';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import SvgIcon from '@/components/ui/svg-icon';
import PhotosIcon from '@/assets/icons/photos-icon.svg';
import CalendarIconSVG from '@/assets/icons/calendar-icon.svg';
import LocationIconSVG from '@/assets/icons/location-icon.svg';

// ─── Module-level cache ───
const _librariesCache: Record<string, PhotoLibrary[]> = {};
const _storageCache: Record<string, { used_mb: number; limit_mb: number; remaining_mb: number }> = {};
const _librariesLoaded: Record<string, boolean> = {};

const ServicePhotoLibraries = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const [libraries, setLibraries] = useState<PhotoLibrary[]>(serviceId ? (_librariesCache[serviceId] || []) : []);
  const [storageInfo, setStorageInfo] = useState(serviceId && _storageCache[serviceId] ? _storageCache[serviceId] : { used_mb: 0, limit_mb: 200, remaining_mb: 200 });
  const [loading, setLoading] = useState(serviceId ? !_librariesLoaded[serviceId] : true);

  useWorkspaceMeta({ title: 'Photo Libraries', description: 'Manage your event photo libraries' });

  const initialLoad = useRef(!serviceId || !_librariesLoaded[serviceId]);

  const fetchLibraries = useCallback(async () => {
    if (!serviceId) return;
    if (initialLoad.current) setLoading(true);
    try {
      const res = await photoLibrariesApi.getServiceLibraries(serviceId);
      if (res.success && res.data) {
        const storage = {
          used_mb: res.data.storage_used_mb,
          limit_mb: res.data.storage_limit_mb,
          remaining_mb: res.data.storage_remaining_mb,
        };
        _librariesCache[serviceId] = res.data.libraries;
        _storageCache[serviceId] = storage;
        _librariesLoaded[serviceId] = true;
        initialLoad.current = false;
        setLibraries(res.data.libraries);
        setStorageInfo(storage);
      }
    } catch (err) { showCaughtError(err); }
    finally { setLoading(false); }
  }, [serviceId]);

  useEffect(() => { fetchLibraries(); }, [fetchLibraries]);

  const storagePct = (storageInfo.used_mb / storageInfo.limit_mb) * 100;
  const storageColor = storagePct > 90 ? 'text-destructive' : storagePct > 70 ? 'text-amber-600' : 'text-emerald-600';

  // Collect a random sample of up to 6 images from all libraries for the header mosaic
  const allPhotos = libraries.flatMap(lib => lib.photos || []);
  // Shuffle deterministically using first photo ids
  const mosaicPhotos = allPhotos.slice(0, 6);

  return (
    <div className="max-w-5xl mx-auto pb-16">

      {/* ─── TOP BAR: back on right, new library button inline ─── */}
      <div className="flex items-center justify-between py-4 px-1 mb-2">
        <Button size="sm" onClick={() => navigate(`/services/events/${serviceId}`)}>
          <Plus className="w-4 h-4 mr-1.5" />
          New Library
        </Button>
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Go back">
          <ChevronLeft className="w-5 h-5" />
        </Button>
      </div>

      {/* ─── HEADER with mosaic ─── */}
      <div className="relative rounded-2xl overflow-hidden mb-6 border border-border h-44 bg-gradient-to-br from-primary/20 via-primary/10 to-background">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)', backgroundSize: '28px 28px' }} />

        {/* Mosaic of library photos in background */}
        {mosaicPhotos.length > 0 && (
          <div className={`absolute inset-0 grid gap-0.5 opacity-25 ${mosaicPhotos.length >= 4 ? 'grid-cols-3' : mosaicPhotos.length >= 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {mosaicPhotos.slice(0, mosaicPhotos.length >= 4 ? 6 : mosaicPhotos.length).map((p, i) => (
              <img key={i} src={p.url} alt="" className="w-full h-full object-cover" />
            ))}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/40 to-transparent" />

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 backdrop-blur-sm flex items-center justify-center">
            <img src={PhotosIcon} alt="Photos" className="w-8 h-8 dark:invert" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Photo Libraries</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Event photo collections for your service</p>
          </div>
        </div>
      </div>

      {/* ─── STORAGE METER ─── */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm text-foreground">Service Storage</span>
          </div>
          <span className={`font-bold text-sm ${storageColor}`}>
            {storageInfo.used_mb.toFixed(1)} / {storageInfo.limit_mb}MB
          </span>
        </div>
        <Progress value={storagePct} className="h-2.5 rounded-full" />
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>{loading ? '...' : `${libraries.length} photo ${libraries.length === 1 ? 'library' : 'libraries'}`}</span>
          <span>{storageInfo.remaining_mb.toFixed(1)}MB remaining</span>
        </div>
      </div>

      {/* ─── SKELETON ─── */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-border bg-card">
              <Skeleton className="h-44 w-full rounded-none" />
              <div className="p-4 space-y-2.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/5" />
              </div>
            </div>
          ))}
        </div>
      ) : libraries.length === 0 ? (
        /* ─── EMPTY STATE ─── */
        <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
          <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <img src={PhotosIcon} alt="Photos" className="w-10 h-10 dark:invert" />
          </div>
          <h3 className="text-xl font-bold mb-2">No Photo Libraries Yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto text-sm">
            Create photo libraries for events you've been confirmed to photograph. Share beautiful memories with event organizers.
          </p>
          <Button size="lg" onClick={() => navigate(`/services/events/${serviceId}`)}>
            <Plus className="w-5 h-5 mr-2" />
            Create First Library
          </Button>
        </div>
      ) : (
        /* ─── LIBRARIES GRID ─── */
        <div className="grid gap-5 md:grid-cols-2">
          {libraries.map(lib => (
            <div
              key={lib.id}
              className="group rounded-2xl overflow-hidden border border-border bg-card hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
              onClick={() => navigate(`/photo-library/${lib.id}`)}
            >
              {/* Cover mosaic or placeholder */}
              <div className="relative h-48 bg-muted overflow-hidden">
                {lib.photos && lib.photos.length > 0 ? (
                  lib.photos.length === 1 ? (
                    <img src={lib.photos[0].url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : lib.photos.length === 2 ? (
                    <div className="grid grid-cols-2 h-full gap-0.5">
                      {lib.photos.slice(0, 2).map((p, i) => (
                        <img key={i} src={p.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 h-full gap-0.5">
                      <img src={lib.photos[0].url} alt="" className="col-span-2 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="flex flex-col gap-0.5">
                        {lib.photos.slice(1, 3).map((p, i) => (
                          <img key={i} src={p.url} alt="" className="w-full flex-1 object-cover" />
                        ))}
                      </div>
                    </div>
                  )
                ) : lib.event?.cover_image_url ? (
                  /* ── No API photos but has event cover ── */
                  <div className="relative w-full h-full">
                    <img src={lib.event.cover_image_url} alt="" className="w-full h-full object-cover opacity-55 group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/25">
                      <img src={PhotosIcon} alt="" className="w-10 h-10 invert opacity-90" />
                      {lib.photo_count > 0 && (
                        <span className="text-white text-sm font-semibold drop-shadow">{lib.photo_count} photo{lib.photo_count !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  /* ── Truly empty library ── */
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <img src={PhotosIcon} alt="Photos" className="w-12 h-12 opacity-20 dark:invert" />
                    <p className="text-xs text-muted-foreground">No photos yet</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                {/* Privacy badge + count */}
                <div className="absolute top-3 left-3">
                  <Badge className={`text-[11px] gap-1 backdrop-blur-sm border-0 ${lib.privacy === 'public' ? 'bg-emerald-500/90 text-white' : 'bg-black/50 text-white'}`}>
                    {lib.privacy === 'public' ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                    {lib.privacy === 'public' ? 'Public' : 'Private'}
                  </Badge>
                </div>
                <div className="absolute top-3 right-3">
                  <span className="text-xs text-white/90 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full font-medium">
                    {lib.photo_count} photo{lib.photo_count !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Name overlay */}
                <div className="absolute bottom-3 left-4 right-4">
                  <h3 className="font-bold text-white text-base truncate leading-tight">{lib.name}</h3>
                </div>
              </div>

              <div className="p-4 space-y-2">
                {lib.event && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {lib.event.start_date && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <img src={CalendarIconSVG} alt="" className="w-3 h-3 flex-shrink-0 dark:invert opacity-60" />
                        <span>{new Date(lib.event.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    )}
                    {lib.event.location && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <img src={LocationIconSVG} alt="" className="w-3 h-3 flex-shrink-0 dark:invert opacity-60" />
                        <span className="truncate max-w-[140px]">{lib.event.location}</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{lib.total_size_mb.toFixed(1)}MB</span>
                  </div>
                  <span className="text-xs text-primary font-medium group-hover:underline">Open →</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ServicePhotoLibraries;
