import { useState, useEffect, useCallback } from 'react';
import { getTimeAgo } from '@/utils/getTimeAgo';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Trash2, Globe, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from 'react-router-dom';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { socialApi } from '@/lib/api/social';
import { toast } from 'sonner';

const MyMoments = () => {
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [editText, setEditText] = useState('');
  const [editVisibility, setEditVisibility] = useState<string>('public');

  useWorkspaceMeta({
    title: "Your Moments",
    description: "Manage your moments, edit, delete, or change their visibility."
  });

  const fetchMyPosts = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await socialApi.getUserPosts(currentUser.id);
      if (response.success) {
        const data = response.data as any;
        const postsList = data?.posts || data?.items || (Array.isArray(data) ? data : []);
        setPosts(postsList);
      } else {
        setError(response.message || 'Failed to load posts');
      }
    } catch {
      setError('Failed to load your moments');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchMyPosts();
  }, [fetchMyPosts]);

  // getTimeAgo imported from shared utility

  const handleDelete = async (postId: string) => {
    try {
      const response = await socialApi.deletePost(postId);
      if (response.success) {
        setPosts(posts.filter(p => p.id !== postId));
        toast.success('Moment deleted successfully');
      } else {
        toast.error('Failed to delete moment');
      }
    } catch {
      toast.error('Failed to delete moment');
    }
  };

  const handleEdit = (post: any) => {
    setEditingPost(post);
    setEditText(post.content || '');
    setEditVisibility(post.visibility || 'public');
    setEditDialogOpen(true);
  };

  const handleVisibilityChange = async (postId: string, newVisibility: string) => {
    try {
      const response = await socialApi.updatePost(postId, { visibility: newVisibility });
      if (response.success) {
        setPosts(posts.map(p => p.id === postId ? { ...p, visibility: newVisibility } : p));
        toast.success(`Visibility changed to ${newVisibility === 'circle' ? 'My Circle' : 'Public'}`);
      } else {
        toast.error('Failed to change visibility');
      }
    } catch {
      toast.error('Failed to change visibility');
    }
  };

  const saveEdit = async () => {
    if (!editingPost) return;
    try {
      const response = await socialApi.updatePost(editingPost.id, { content: editText, visibility: editVisibility });
      if (response.success) {
        toast.success('Moment updated');
        setEditDialogOpen(false);
        fetchMyPosts();
      } else {
        toast.error('Failed to update');
      }
    } catch {
      toast.error('Failed to update moment');
    }
  };

  const viewPost = (post: any) => {
    navigate(`/post/${post.id}`);
  };

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">Your Moments</h1>
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="bg-card rounded-lg shadow-sm border border-border p-4">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-48 w-full rounded-lg mb-4" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Your Moments</h1>
        <Button onClick={() => navigate('/')} variant="outline">
          Share New Moment
        </Button>
      </div>

      {error && (
        <div className="bg-card rounded-lg shadow-sm border border-border p-8 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={fetchMyPosts}>Retry</Button>
        </div>
      )}

      {!error && posts.length === 0 && (
        <div className="bg-card rounded-lg shadow-sm border border-border p-8 text-center">
          <p className="text-muted-foreground mb-4">You haven't shared any moments yet.</p>
          <Button onClick={() => navigate('/')}>Share Your First Moment</Button>
        </div>
      )}

      {posts.map((post) => {
        const authorName = post.author?.name || `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() || 'You';
        const authorAvatar = post.author?.avatar || currentUser?.avatar;
        const images = post.images || post.media?.map((m: any) => m.url) || [];

        return (
          <div key={post.id} className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
            {/* Header */}
            <div className="p-3 md:p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                {authorAvatar ? (
                  <img src={authorAvatar} alt={authorName} className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                    {authorName.charAt(0)}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-sm md:text-base text-foreground">{authorName}</h3>
                  <div className="flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground">
                    <span>{post.created_at ? getTimeAgo(post.created_at) : 'Recently'}</span>
                    <span>·</span>
                    {(post.visibility || 'public') === 'circle' ? (
                      <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> Circle</span>
                    ) : (
                      <span className="flex items-center gap-0.5"><Globe className="w-3 h-3" /> Public</span>
                    )}
                  </div>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-background z-50">
                  <DropdownMenuItem onClick={() => handleEdit(post)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleVisibilityChange(post.id, post.visibility === 'circle' ? 'public' : 'circle')}>
                    {post.visibility === 'circle' ? (
                      <><Globe className="w-4 h-4 mr-2" /> Make Public</>
                    ) : (
                      <><Users className="w-4 h-4 mr-2" /> Circle Only</>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDelete(post.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Images */}
            {images.length > 0 && (
              <div className={`px-3 md:px-4 cursor-pointer ${images.length > 1 ? 'flex gap-2 overflow-x-auto py-1' : ''}`} onClick={() => viewPost(post)}>
                {images.length === 1 ? (
                  <img src={images[0]} alt="Post" className="w-full h-48 md:h-64 object-cover rounded-lg" />
                ) : (
                  images.map((img: string, idx: number) => (
                    <img key={idx} src={img} alt={`Post ${idx + 1}`} className="w-40 h-32 md:w-48 md:h-40 flex-shrink-0 object-cover rounded-lg" />
                  ))
                )}
              </div>
            )}

            {/* Content */}
            <div className="px-3 md:px-4 py-3 cursor-pointer" onClick={() => viewPost(post)}>
              {post.content && <p className="text-foreground">{post.content}</p>}
            </div>

            {/* Stats */}
            <div className="px-3 md:px-4 py-2 md:py-3 border-t border-border">
              <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground">
                <span>{post.glow_count || 0} {(post.glow_count || 0) === 1 ? 'Glow' : 'Glows'}</span>
                <span>{post.comment_count || 0} {(post.comment_count || 0) === 1 ? 'Echo' : 'Echoes'}</span>
              </div>
            </div>
          </div>
        );
      })}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Moment</DialogTitle>
            <DialogDescription>Make changes to your moment.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="text">Content</Label>
              <Textarea
                id="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                placeholder="What's on your mind?"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select value={editVisibility} onValueChange={setEditVisibility}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <span className="flex items-center gap-2"><Globe className="w-4 h-4" /> Public</span>
                  </SelectItem>
                  <SelectItem value="circle">
                    <span className="flex items-center gap-2"><Users className="w-4 h-4" /> My Circle</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyMoments;
