import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Crown, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { socialApi } from '@/lib/api/social';
import Post from './Post';

const CommunityDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const [cRes, mRes, pRes] = await Promise.all([
          socialApi.getCommunity(id),
          socialApi.getCommunityMembers(id),
          socialApi.getCommunityPosts(id).catch(() => ({ success: false, data: { posts: [] } } as any)),
        ]);
        if (cRes.success) setCommunity(cRes.data);
        if (mRes.success) {
          const md = mRes.data as any;
          setMembers(md?.members || (Array.isArray(md) ? md : []));
        }
        if (pRes.success) {
          const pd = pRes.data as any;
          setPosts(pd?.posts || (Array.isArray(pd) ? pd : []));
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  const handleJoin = async () => {
    if (!id) return;
    setJoining(true);
    try {
      const res = await socialApi.joinCommunity(id);
      if (res.success) {
        toast.success('Joined community!');
        setCommunity((prev: any) => prev ? { ...prev, is_member: true, member_count: (prev.member_count || 0) + 1 } : prev);
      }
    } catch { toast.error('Failed to join'); }
    finally { setJoining(false); }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <div className="grid grid-cols-1 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      </div>
    );
  }

  if (!community) {
    return <div className="text-center py-12 text-muted-foreground">Community not found</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/communities')} className="mb-3">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Communities
        </Button>
        
        <div className="relative h-40 w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center">
          {community.image ? (
            <img src={community.image} alt={community.name} className="w-full h-full object-cover" />
          ) : (
            <Users className="w-16 h-16 text-muted-foreground" />
          )}
        </div>

        <div className="flex items-start justify-between mt-4 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              {community.name}
              {community.is_creator && <Badge className="bg-nuru-yellow text-foreground"><Crown className="w-3 h-3 mr-1" />Creator</Badge>}
            </h1>
            <p className="text-muted-foreground mt-1">{community.description || 'No description'}</p>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <Users className="w-4 h-4" /> {community.member_count || 0} members
            </p>
          </div>
          {!community.is_member && (
            <Button onClick={handleJoin} disabled={joining} className="bg-nuru-yellow hover:bg-nuru-yellow/90 text-foreground">
              {joining ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Join
            </Button>
          )}
        </div>
      </div>

      {/* Members preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {members.slice(0, 10).map((m: any) => (
              <div key={m.id} className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={m.avatar} />
                  <AvatarFallback className="text-xs">{m.first_name?.[0]}{m.last_name?.[0]}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{m.first_name} {m.last_name}</span>
                {m.role === 'admin' && <Badge variant="outline" className="text-xs">Admin</Badge>}
              </div>
            ))}
            {members.length > 10 && (
              <span className="text-sm text-muted-foreground self-center">+{members.length - 10} more</span>
            )}
            {members.length === 0 && <p className="text-sm text-muted-foreground">No members yet</p>}
          </div>
        </CardContent>
      </Card>

      {/* Posts */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Community Posts</h2>
        {posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map((post: any) => (
              <Post key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {community.is_member || community.is_creator 
                ? 'No posts yet. Be the first to share something!' 
                : 'Join this community to see posts.'}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CommunityDetail;
