import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Users, Crown, Plus, Loader2, Heart, Send, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { socialApi } from '@/lib/api/social';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getTimeAgo } from '@/utils/getTimeAgo';

const CommunityDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUserQuery = useCurrentUser();
  const currentUser = currentUserQuery.data as any;

  const [community, setCommunity] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  // Creator post form
  const [postContent, setPostContent] = useState('');
  const [postImages, setPostImages] = useState<File[]>([]);
  const [postPreviews, setPostPreviews] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).slice(0, 10 - postImages.length);
    setPostImages(prev => [...prev, ...files]);
    setPostPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = (idx: number) => {
    setPostImages(prev => prev.filter((_, i) => i !== idx));
    setPostPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCreatePost = async () => {
    if (!id || (!postContent.trim() && postImages.length === 0)) return;
    setPosting(true);
    try {
      const formData = new FormData();
      if (postContent.trim()) formData.append('content', postContent.trim());
      postImages.forEach(f => formData.append('images', f));
      const res = await socialApi.createCommunityPost(id, formData);
      if (res.success) {
        toast.success('Post shared!');
        setPostContent('');
        setPostImages([]);
        setPostPreviews([]);
        // Refresh posts
        const pRes = await socialApi.getCommunityPosts(id);
        if (pRes.success) {
          const pd = pRes.data as any;
          setPosts(pd?.posts || (Array.isArray(pd) ? pd : []));
        }
      } else {
        toast.error(res.message || 'Failed to post');
      }
    } catch { toast.error('Failed to create post'); }
    finally { setPosting(false); }
  };

  const handleGlow = async (postId: string, hasGlowed: boolean) => {
    if (!id) return;
    // Optimistic update
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, has_glowed: !hasGlowed, glow_count: (p.glow_count || 0) + (hasGlowed ? -1 : 1) }
        : p
    ));
    try {
      if (hasGlowed) {
        await socialApi.unglowCommunityPost(id, postId);
      } else {
        await socialApi.glowCommunityPost(id, postId);
      }
    } catch {
      // Revert
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, has_glowed: hasGlowed, glow_count: (p.glow_count || 0) + (hasGlowed ? 1 : -1) }
          : p
      ));
      toast.error('Failed to update glow');
    }
  };

  const isCreator = community?.is_creator && currentUser && community.created_by
    ? String(community.created_by) === String(currentUser.id)
    : community?.is_creator;

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
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            {community.name}
          </h1>
          <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => navigate('/communities')}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </div>
        
        <div className="relative h-40 w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center">
          {community.image ? (
            <img src={community.image} alt={community.name} className="w-full h-full object-cover" />
          ) : (
            <Users className="w-16 h-16 text-muted-foreground" />
          )}
        </div>

        <div className="flex items-start justify-between mt-4 gap-3">
          <div>
            <div className="flex items-center gap-2">
              {isCreator && <Badge className="bg-nuru-yellow text-foreground"><Crown className="w-3 h-3 mr-1" />Creator</Badge>}
            </div>
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

      {/* Creator post input */}
      {isCreator && (
        <Card>
          <CardContent className="pt-4">
            <Textarea
              placeholder="Share something with your community..."
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              className="min-h-[80px] resize-none mb-3"
              maxLength={2000}
            />
            {postPreviews.length > 0 && (
              <div className="flex gap-2 overflow-x-auto mb-3">
                {postPreviews.map((src, idx) => (
                  <div key={idx} className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border border-border">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => removeImage(idx)} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={postImages.length >= 10}>
                <ImageIcon className="w-4 h-4 mr-1" /> Photo
              </Button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
              <Button size="sm" onClick={handleCreatePost} disabled={posting || (!postContent.trim() && postImages.length === 0)} className="bg-nuru-yellow hover:bg-nuru-yellow/90 text-foreground">
                {posting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                Post
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Community Posts */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Community Posts</h2>
        {posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map((post: any) => {
              const author = post.author || {};
              const images = post.images || [];
              return (
                <Card key={post.id}>
                  <CardContent className="pt-4">
                    {/* Author */}
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={author.avatar} />
                        <AvatarFallback className="text-xs">{author.name?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-sm">{author.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{post.created_at ? getTimeAgo(post.created_at) : ''}</p>
                      </div>
                    </div>
                    {/* Content */}
                    {post.content && <p className="text-foreground whitespace-pre-wrap mb-3">{post.content}</p>}
                    {/* Images */}
                    {images.length > 0 && (
                      <div className={images.length === 1 ? '' : 'flex gap-2 overflow-x-auto mb-3'}>
                        {images.length === 1 ? (
                          <img src={images[0]} alt="" className="w-full max-h-[400px] object-contain rounded-lg bg-muted/30 mb-3" />
                        ) : (
                          images.map((img: string, idx: number) => (
                            <img key={idx} src={img} alt="" className="w-40 h-32 flex-shrink-0 object-cover rounded-lg" />
                          ))
                        )}
                      </div>
                    )}
                    {/* Glow action */}
                    <div className="flex items-center gap-3 pt-2 border-t border-border">
                      <button
                        onClick={() => handleGlow(post.id, post.has_glowed || false)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors text-sm ${
                          post.has_glowed ? 'bg-red-100 text-red-600' : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${post.has_glowed ? 'fill-current' : ''}`} />
                        {post.has_glowed ? 'Glowed' : 'Glow'}
                      </button>
                      <span className="text-xs text-muted-foreground">{post.glow_count || 0} {(post.glow_count || 0) === 1 ? 'Glow' : 'Glows'}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {isCreator
                ? 'No posts yet. Share something with your community!' 
                : 'No posts yet.'}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CommunityDetail;
