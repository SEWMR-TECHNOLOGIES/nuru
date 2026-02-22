import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Globe, Lock, X, ZoomIn, Download, ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { photoLibrariesApi, PhotoLibrary } from '@/lib/api/photoLibraries';
import { showCaughtError } from '@/lib/api';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import nuruLogo from '@/assets/nuru-logo.png';
import SvgIcon from '@/components/ui/svg-icon';
import PhotosIcon from '@/assets/icons/photos-icon.svg';
import CalendarIconSVG from '@/assets/icons/calendar-icon.svg';
import LocationIcon from '@/assets/icons/location-icon.svg';

const SharedPhotoLibrary = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { data: currentUser, userIsLoggedIn } = useCurrentUser();
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

  const photos = library?.photos || [];

  // ── User initials for avatar fallback ──
  const userInitials = currentUser
    ? `${currentUser.first_name?.[0] || ''}${currentUser.last_name?.[0] || ''}`.toUpperCase()
    : '';

  // ─── LOADING ───
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 pt-10 pb-16">
          <Skeleton className="h-48 w-full rounded-2xl mb-8" />
          <div className="columns-2 md:columns-3 gap-3 space-y-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className={`w-full rounded-xl break-inside-avoid ${i % 3 === 0 ? 'h-52' : i % 3 === 1 ? 'h-36' : 'h-44'}`} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── ERROR ───
  if (error || !library) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link to="/">
              <img src={nuruLogo} alt="Nuru" className="h-8 w-auto" />
            </Link>
            {userIsLoggedIn ? (
              <button onClick={() => navigate('/')} className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  {currentUser?.avatar && <AvatarImage src={currentUser.avatar} />}
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{userInitials}</AvatarFallback>
                </Avatar>
              </button>
            ) : (
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link to="/register">Join Nuru</Link>
              </Button>
            )}
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-6">
              <img src={PhotosIcon} alt="" className="w-10 h-10 opacity-30 dark:invert" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Library Not Found</h2>
            <p className="text-muted-foreground mb-6">{error || 'This photo library does not exist or is private.'}</p>
            <Button asChild variant="outline">
              <Link to="/">Go Home</Link>
            </Button>
          </div>
        </div>
        <footer className="border-t border-border py-6 text-center">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Nuru — Plan Smarter</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ─── BRANDED HEADER ─── */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={nuruLogo} alt="Nuru" className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-muted-foreground">
              Shared Photo Library
            </span>
            {userIsLoggedIn ? (
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                title="Go to Dashboard"
              >
                <Avatar className="w-7 h-7">
                  {currentUser?.avatar && <AvatarImage src={currentUser.avatar} />}
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">{userInitials}</AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-foreground hidden sm:inline">
                  {currentUser?.first_name || 'Dashboard'}
                </span>
              </button>
            ) : (
              <Button asChild size="sm" className="rounded-full bg-foreground text-background hover:bg-foreground/90 px-5 text-xs font-medium">
                <Link to="/register">Join Nuru</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-6 pt-8 pb-16">

          {/* ─── HERO BANNER ─── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative rounded-2xl overflow-hidden mb-8 h-56 sm:h-64"
          >
            {photos.length > 0 ? (
              <img src={photos[0].url} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-background" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

            <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {library.event && (
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Badge className="bg-white/15 backdrop-blur-sm text-white border-white/20 text-[11px] font-medium gap-1.5">
                        <Camera className="w-3 h-3" />
                        Event Gallery
                      </Badge>
                      <Badge className={`text-[11px] gap-1 border-0 ${library.privacy === 'public' ? 'bg-emerald-500/80 text-white' : 'bg-white/15 backdrop-blur-sm text-white border-white/20'}`}>
                        {library.privacy === 'public' ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {library.privacy === 'public' ? 'Public' : 'Private'}
                      </Badge>
                    </div>
                  )}
                  <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight truncate">{library.name}</h1>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2">
                    {library.event?.start_date && (
                      <div className="flex items-center gap-1.5 text-white/70 text-xs">
                        <img src={CalendarIconSVG} alt="" className="w-3.5 h-3.5 invert" />
                        <span>{new Date(library.event.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      </div>
                    )}
                    {library.event?.location && (
                      <div className="flex items-center gap-1.5 text-white/70 text-xs">
                        <img src={LocationIcon} alt="" className="w-3.5 h-3.5 invert" />
                        <span>{library.event.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-white/70 text-xs">
                      <img src={PhotosIcon} alt="" className="w-3.5 h-3.5 invert" />
                      <span>{library.photo_count} photo{library.photo_count !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>

                <div className="hidden sm:flex flex-col items-end shrink-0">
                  <img src={nuruLogo} alt="Nuru" className="h-5 w-auto brightness-0 invert opacity-60" />
                  <span className="text-[10px] text-white/40 mt-1">Plan Smarter</span>
                </div>
              </div>
            </div>
          </motion.div>

          {library.description && (
            <p className="text-sm text-muted-foreground mb-6 max-w-2xl">{library.description}</p>
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="columns-2 md:columns-3 gap-3 space-y-3"
            >
              {photos.map((photo, idx) => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 * Math.min(idx, 12), duration: 0.4 }}
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
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* ─── CTA BANNER ─── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mt-16 rounded-2xl bg-foreground text-background p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6"
          >
            <div className="text-center sm:text-left">
              {userIsLoggedIn ? (
                <>
                  <h3 className="text-xl font-bold mb-1.5">Create your own photo library</h3>
                  <p className="text-background/60 text-sm">Manage event photos, share galleries, and coordinate with vendors — all in one workspace.</p>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold mb-1.5">Plan your own event with Nuru</h3>
                  <p className="text-background/60 text-sm">Create photo libraries, manage guests, and coordinate vendors — all in one workspace.</p>
                </>
              )}
            </div>
            {userIsLoggedIn ? (
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-full px-8 font-semibold shrink-0" onClick={() => navigate('/')}>
                Go to Dashboard
              </Button>
            ) : (
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-full px-8 font-semibold shrink-0">
                <Link to="/register">Get Started Free</Link>
              </Button>
            )}
          </motion.div>
        </div>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-border bg-muted/30">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={nuruLogo} alt="Nuru" className="h-5 w-auto opacity-60" />
            <span className="text-xs text-muted-foreground">© {new Date().getFullYear()} Nuru | SEWMR TECHNOLOGIES</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/privacy-policy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
            <a href="mailto:hello@nuru.tz" className="text-xs text-muted-foreground hover:text-foreground transition-colors">hello@nuru.tz</a>
          </div>
        </div>
      </footer>

      {/* ─── LIGHTBOX ─── */}
      {lightboxIdx !== null && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={() => setLightboxIdx(null)}>
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <img src={nuruLogo} alt="Nuru" className="h-5 w-auto brightness-0 invert opacity-70" />
              <span className="text-white/40 text-xs hidden sm:inline">•</span>
              <span className="text-white/40 text-xs hidden sm:inline truncate max-w-[200px]">{library.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={photos[lightboxIdx].url}
                download={photos[lightboxIdx].original_name || `photo-${lightboxIdx + 1}.jpg`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors inline-flex"
                onClick={(e) => e.stopPropagation()}
                title="Download photo"
              >
                <Download className="w-5 h-5" />
              </a>
              <button className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors" onClick={() => setLightboxIdx(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
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
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl"
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
