import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Users, UserPlus, UserMinus, Loader2, 
  Link as LinkIcon, Briefcase, Star
} from 'lucide-react';
import { VerifiedUserBadge, VerifiedServiceBadge } from '@/components/ui/verified-badge';
import SvgIcon from '@/components/ui/svg-icon';
import CalendarIcon from '@/assets/icons/calendar-icon.svg';
import LocationIcon from '@/assets/icons/location-icon.svg';
import CameraIcon from '@/assets/icons/camera-icon.svg';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PillTabsNav } from '@/components/ui/pill-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { profileApi } from '@/lib/api/profile';
import { searchApi } from '@/lib/api/search';
import { socialApi } from '@/lib/api/social';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useCircles } from '@/data/useSocial';
import { toast } from 'sonner';
import { showCaughtError } from '@/lib/api';
import { formatDateMedium } from '@/utils/formatDate';

interface PublicUser {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  avatar?: string | null;
  bio?: string;
  location?: string;
  website?: string;
  social_links?: Record<string, string>;
  is_identity_verified?: boolean;
  is_vendor?: boolean;
  follower_count?: number;
  following_count?: number;
  event_count?: number;
  service_count?: number;
  post_count?: number;
  moments_count?: number;
  created_at?: string;
  is_following?: boolean;
  is_followed_by?: boolean;
  mutual_followers_count?: number;
}

const PublicProfile = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: currentUser } = useCurrentUser();
  const showAddToCircle = searchParams.get('from') === 'add';
  
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [circleLoading, setCircleLoading] = useState(false);
  const [circleRequestSent, setCircleRequestSent] = useState(false);
  
  const [events, setEvents] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [profileTab, setProfileTab] = useState('moments');

  // Is this my own profile?
  const isOwnProfile = currentUser?.username === username;

  useWorkspaceMeta({
    title: user ? `${user.first_name} ${user.last_name} (@${user.username})` : 'Profile',
    description: user?.bio || 'View this user\'s profile on Nuru.'
  });

  useEffect(() => {
    if (!username) return;

    // If it's the current user, redirect to own profile
    if (currentUser?.username === username) {
      navigate('/profile', { replace: true });
      return;
    }

    setLoading(true);

    // Step 1: Search for user by exact username to get their ID
    searchApi.searchPeople(username, 10).then(async (res) => {
      if (!res.success) {
        setLoading(false);
        return;
      }

      const match = res.data?.items?.find(
        (u: any) => u.username?.toLowerCase() === username.toLowerCase()
      );

      if (!match) {
        setLoading(false);
        return;
      }

      // Step 2: Fetch full profile via GET /users/{id}
      try {
        const profileRes = await profileApi.getById(match.id);
        if (profileRes.success && profileRes.data) {
          const p = profileRes.data as any;
          const userData: PublicUser = {
            id: p.id,
            first_name: p.first_name || match.full_name?.split(' ')[0] || '',
            last_name: p.last_name || match.full_name?.split(' ').slice(1).join(' ') || '',
            username: p.username || match.username,
            avatar: p.avatar || match.avatar,
            bio: p.bio,
            location: p.location,
            website: p.website,
            social_links: p.social_links,
            is_identity_verified: p.is_identity_verified ?? match.is_verified,
            is_vendor: p.is_vendor ?? false,
            follower_count: p.follower_count ?? 0,
            following_count: p.following_count ?? 0,
            event_count: p.event_count ?? 0,
            service_count: p.service_count ?? 0,
            post_count: p.post_count ?? 0,
            moments_count: p.moments_count ?? 0,
            created_at: p.created_at,
            is_following: p.is_following,
            is_followed_by: p.is_followed_by,
            mutual_followers_count: p.mutual_followers_count,
          };

          setUser(userData);
          setIsFollowing(!!userData.is_following);
          setFollowerCount(userData.follower_count || 0);

          // Step 3: Load content tabs
          setContentLoading(true);
          Promise.all([
            profileApi.getEvents(match.id, { limit: 12, status: 'published' }).catch(() => null),
            profileApi.getPosts(match.id, { limit: 12 }).catch(() => null),
            profileApi.getServices(match.id, { limit: 12 }).catch(() => null),
          ]).then(([eventsRes, postsRes, servicesRes]) => {
            if (eventsRes?.success) setEvents(eventsRes.data?.events || []);
            if (postsRes?.success) setPosts(postsRes.data?.posts || []);
            if (servicesRes?.success) setServices(servicesRes.data?.services || []);
          }).finally(() => setContentLoading(false));
        } else {
          // Fallback: use search data only
          setUser({
            id: match.id,
            first_name: match.full_name?.split(' ')[0] || '',
            last_name: match.full_name?.split(' ').slice(1).join(' ') || '',
            username: match.username,
            avatar: match.avatar,
            is_identity_verified: match.is_verified,
          });
        }
      } catch {
        // Fallback: use search data
        setUser({
          id: match.id,
          first_name: match.full_name?.split(' ')[0] || '',
          last_name: match.full_name?.split(' ').slice(1).join(' ') || '',
          username: match.username,
          avatar: match.avatar,
          is_identity_verified: match.is_verified,
        });
      } finally {
        setLoading(false);
      }
    }).catch(() => {
      setLoading(false);
    });
  }, [username, currentUser, navigate]);

  const handleFollow = async () => {
    if (!user) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await profileApi.unfollow(user.id);
        setIsFollowing(false);
        setFollowerCount(c => Math.max(0, c - 1));
        toast.success(`Unfollowed @${user.username}`);
      } else {
        await profileApi.follow(user.id);
        setIsFollowing(true);
        setFollowerCount(c => c + 1);
        toast.success(`Following @${user.username}`);
      }
    } catch (err: any) {
      showCaughtError(err, 'Failed to update follow');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleAddToCircle = async () => {
    if (!user) return;
    setCircleLoading(true);
    try {
      // Use the circle API directly
      const res = await socialApi.addCircleMember('me', user.id);
      if (res.success) {
        setCircleRequestSent(true);
        toast.success(`Circle request sent to ${user.first_name}`);
      } else {
        toast.error((res as any).message || 'Failed to send request');
      }
    } catch (err: any) {
      showCaughtError(err, 'Failed to send circle request');
    } finally {
      setCircleLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Cover skeleton */}
        <Card className="overflow-hidden border-0 shadow-xl">
          <Skeleton className="h-56 md:h-64 w-full rounded-none" />
          <CardContent className="pt-0 pb-6">
            <div className="flex flex-col md:flex-row gap-6 -mt-20 relative z-10 px-1">
              <Skeleton className="w-[136px] h-[136px] rounded-full flex-shrink-0" />
              <div className="flex-1 mt-14 md:mt-6 space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-64 mt-2" />
                <div className="flex gap-4 mt-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-4 text-center space-y-2">
                <Skeleton className="h-7 w-10 mx-auto" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">User not found</h2>
        <p className="text-muted-foreground mb-6">The profile you're looking for doesn't exist or has been removed.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const fullName = `${user.first_name} ${user.last_name}`.trim();
  const initials = `${(user.first_name || 'U')[0]}${(user.last_name || '')[0] || ''}`.toUpperCase();
  const joinDate = user.created_at ? formatDateMedium(user.created_at) : null;

  return (
    <div className="space-y-6">
      {/* Profile Header — Premium Cover (matches UserProfile) */}
      <Card className="overflow-hidden border-0 shadow-xl">
        <div className="relative h-56 md:h-64">
          {/* Multi-layered gradient cover */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-accent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

          {/* Animated mesh pattern */}
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.3) 1px, transparent 1px), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.2) 1px, transparent 1px)`,
            backgroundSize: '30px 30px, 20px 20px',
          }} />

          {/* Large decorative blobs */}
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-primary-foreground/8 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-accent/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-primary-foreground/5 rounded-full blur-2xl" />

          {/* Subtle geometric accent lines */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary-foreground/20 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary-foreground/10 to-transparent" />

          {/* Follow / Add to Circle buttons */}
          {!isOwnProfile && (
            <div className="absolute top-4 right-4 flex gap-2">
              {showAddToCircle && (
                <Button
                  onClick={handleAddToCircle}
                  disabled={circleLoading || circleRequestSent}
                  variant="secondary"
                  size="sm"
                  className="gap-1.5 rounded-full px-4 shadow-lg backdrop-blur-md bg-background/70 hover:bg-background/90 border border-border/50"
                >
                  {circleLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Users className="w-4 h-4" />
                  )}
                  {circleRequestSent ? 'Request Sent' : 'Add to Circle'}
                </Button>
              )}
              <Button
                onClick={handleFollow}
                disabled={followLoading}
                variant={isFollowing ? 'secondary' : 'default'}
                size="sm"
                className="gap-1.5 rounded-full px-5 shadow-lg backdrop-blur-md"
              >
                {followLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isFollowing ? (
                  <UserMinus className="w-4 h-4" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {isFollowing ? 'Unfollow' : 'Follow'}
              </Button>
            </div>
          )}

          {/* Bottom gradient for text readability */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-card to-transparent" />
        </div>

        <CardContent className="pt-0 pb-6">
          <div className="flex flex-col md:flex-row gap-6 -mt-20 relative z-10 px-1">
            {/* Avatar with gradient ring */}
            <div className="relative flex-shrink-0">
              <div className="p-1 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 shadow-2xl">
                <Avatar className="w-32 h-32 border-4 border-background shadow-xl">
                  <AvatarImage src={user.avatar || undefined} alt={fullName} />
                  <AvatarFallback className="text-2xl font-semibold bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
              </div>
            </div>

            <div className="flex-1 mt-14 md:mt-6">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  {fullName}
                  {user.is_identity_verified && <VerifiedUserBadge size="md" />}
                </h1>
                {user.is_vendor && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-semibold text-primary">
                    <Briefcase className="w-3 h-3" /> Vendor
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-sm mb-2">@{user.username}</p>

              {user.bio && (
                <p className="text-muted-foreground mb-4 max-w-lg">{user.bio}</p>
              )}

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
                {user.location && (
                  <span className="flex items-center gap-1.5">
                    <SvgIcon src={LocationIcon} alt="" className="w-4 h-4" /> {user.location}
                  </span>
                )}
                {joinDate && (
                  <span className="flex items-center gap-1.5">
                    <SvgIcon src={CalendarIcon} alt="" className="w-4 h-4" /> Joined {joinDate}
                  </span>
                )}
                {user.website && (
                  <a
                    href={user.website.startsWith('http') ? user.website : `https://${user.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <LinkIcon className="w-4 h-4" />
                    {user.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>

              {/* Follows you badge & mutual count */}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {!isOwnProfile && user.is_followed_by && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-[10px] font-medium text-accent-foreground">
                    <Users className="w-3 h-3" /> Follows you
                  </span>
                )}
                {!isOwnProfile && (user.mutual_followers_count ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground">
                    <Star className="w-3 h-3" /> {user.mutual_followers_count} mutual{user.mutual_followers_count! > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {[
          { label: 'Followers', value: followerCount },
          { label: 'Following', value: user.following_count ?? 0 },
          { label: 'Events', value: user.event_count ?? 0 },
          { label: 'Moments', value: user.post_count ?? user.moments_count ?? 0 },
        ].map(stat => (
          <Card key={stat.label} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Content Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs value={profileTab} onValueChange={setProfileTab} className="space-y-4">
          <PillTabsNav
            activeTab={profileTab}
            onTabChange={setProfileTab}
            tabs={[
              { value: 'moments', label: 'Moments', icon: <SvgIcon src={CameraIcon} alt="" className="w-4 h-4" /> },
              { value: 'events', label: 'Events', icon: <SvgIcon src={CalendarIcon} alt="" className="w-4 h-4" /> },
              ...(user.is_vendor ? [{ value: 'services', label: 'Services', icon: <Briefcase className="w-4 h-4" /> }] : []),
            ]}
          />

          {/* Moments Tab */}
          <TabsContent value="moments" className="mt-0">
            {contentLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="aspect-square rounded-xl" />)}
              </div>
            ) : posts.length === 0 ? (
              <EmptyState icon={<SvgIcon src={CameraIcon} alt="" className="w-8 h-8 opacity-40" />} text="No public moments yet" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {posts.map(post => (
                  <Card 
                    key={post.id} 
                    className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer border-0 shadow-sm group"
                    onClick={() => navigate(`/post/${post.id}`)}
                  >
                    <CardContent className="p-0 relative">
                      {post.images?.[0]?.url ? (
                        <div className="aspect-square overflow-hidden">
                          <img 
                            src={post.images[0].url} 
                            alt="" 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                          />
                          {post.images.length > 1 && (
                            <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-md px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                              +{post.images.length - 1}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="aspect-square p-3 flex items-center justify-center bg-muted/30">
                          <p className="text-xs text-muted-foreground line-clamp-5 text-center">{post.content}</p>
                        </div>
                      )}
                      {/* Engagement overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-3 text-[10px] text-white">
                          {post.like_count > 0 && <span>❤ {post.like_count}</span>}
                          {post.comment_count > 0 && <span>💬 {post.comment_count}</span>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events" className="mt-0">
            {contentLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1,2].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
              </div>
            ) : events.length === 0 ? (
              <EmptyState icon={<SvgIcon src={CalendarIcon} alt="" className="w-8 h-8 opacity-40" />} text="No published events" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {events.map(event => (
                  <Card 
                    key={event.id} 
                    className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer border-0 shadow-sm group" 
                    onClick={() => navigate(`/event/${event.id}`)}
                  >
                    <CardContent className="p-0">
                      {(event.cover_image || event.images?.find((i: any) => i.is_featured || i.is_primary)?.image_url || event.images?.[0]?.image_url || event.images?.[0]?.url) && (
                        <div className="h-28 overflow-hidden">
                          <img 
                            src={event.cover_image || event.images?.find((i: any) => i.is_featured || i.is_primary)?.image_url || event.images?.[0]?.image_url || event.images?.[0]?.url} 
                            alt={event.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                          />
                        </div>
                      )}
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-medium text-sm text-foreground truncate">{event.title}</h3>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                              {event.start_date && (
                                <span className="flex items-center gap-0.5">
                                  <SvgIcon src={CalendarIcon} alt="" className="w-3 h-3" />
                                  {new Date(event.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              )}
                              {event.location && (
                                <span className="flex items-center gap-0.5 truncate">
                                  <SvgIcon src={LocationIcon} alt="" className="w-3 h-3" />
                                  {event.venue || event.location}
                                </span>
                              )}
                            </div>
                          </div>
                          {event.event_type?.name && (
                            <Badge variant="secondary" className="text-[9px] shrink-0">{event.event_type.name}</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Services Tab */}
          {user.is_vendor && (
            <TabsContent value="services" className="mt-0">
              {contentLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[1,2].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
                </div>
              ) : services.length === 0 ? (
                <EmptyState icon={<Briefcase className="w-8 h-8 text-muted-foreground/40" />} text="No services listed" />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {services.map(service => {
                    const img = service.primary_image || service.images?.find((i: any) => i.is_primary)?.url || service.images?.[0]?.url;
                    return (
                      <Card 
                        key={service.id} 
                        className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer border-0 shadow-sm group" 
                        onClick={() => navigate(`/services/view/${service.id}`)}
                      >
                        <CardContent className="p-0">
                          <div className="aspect-[16/10] overflow-hidden bg-muted/30">
                            {img ? (
                              <img src={img} alt={service.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Briefcase className="w-10 h-10 text-muted-foreground/30" />
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-medium text-sm text-foreground truncate">{service.title}</h3>
                              {service.verification_status === 'verified' && (
                                <VerifiedServiceBadge size="xs" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{service.service_category?.name}</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </motion.div>
    </div>
  );
};

const EmptyState = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    {icon}
    <p className="text-sm text-muted-foreground mt-2">{text}</p>
  </div>
);

export default PublicProfile;
