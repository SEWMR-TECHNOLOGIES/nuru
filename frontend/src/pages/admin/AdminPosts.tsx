import { useEffect, useState, useCallback, useRef } from "react";
import { Newspaper, Search, ChevronLeft, ChevronRight, Heart, MessageCircle, MapPin, Eye, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/api/admin";
import { adminCaches } from "@/lib/api/adminCache";
import { usePolling } from "@/hooks/usePolling";
import { useAdminMeta } from "@/hooks/useAdminMeta";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { getTimeAgo } from "@/utils/getTimeAgo";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

function PostSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="w-9 h-9 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    </div>
  );
}

export default function AdminPosts() {
  useAdminMeta("Posts / Feed");
  const navigate = useNavigate();
  const cache = adminCaches.posts;
  const [items, setItems] = useState<any[]>(cache.data);
  const [loading, setLoading] = useState(!cache.loaded);
  const initialLoad = useRef(!cache.loaded);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(adminCaches.pagination["posts"] ?? null);
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [removeTarget, setRemoveTarget] = useState<any | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    if (initialLoad.current) setLoading(true);
    const res = await adminApi.getPosts({ q: q || undefined, page, limit: 20 });
    if (res.success) {
      const data = Array.isArray(res.data) ? res.data : [];
      cache.set(data);
      adminCaches.pagination["posts"] = (res as any).pagination ?? null;
      setItems(data);
      setPagination((res as any).pagination ?? null);
    } else if (initialLoad.current) toast.error("Failed to load posts");
    setLoading(false);
    initialLoad.current = false;
  }, [q, page]);

  useEffect(() => {
    if (q || page > 1) { initialLoad.current = true; load(); return; }
    if (!cache.loaded) { initialLoad.current = true; load(); }
    else load();
  }, [load, q, page]);
  usePolling(load);

  const handleRemoveConfirm = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    const res = await adminApi.updatePostStatus(removeTarget.id, false, removeReason.trim() || "Policy violation");
    if (res.success) { toast.success("Post removed"); setRemoveTarget(null); setRemoveReason(""); load(); }
    else toast.error(res.message || "Failed");
    setRemoving(false);
  };

  const handleRestore = async (id: string) => {
    const ok = await confirm({ title: "Restore Post?", description: "Restore this post? It will be visible in the feed again.", confirmLabel: "Restore" });
    if (!ok) return;
    const res = await adminApi.updatePostStatus(id, true);
    if (res.success) { toast.success("Post restored"); load(); }
    else toast.error(res.message || "Failed");
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog />
      <Dialog open={!!removeTarget} onOpenChange={v => { if (!v) setRemoveTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Post</DialogTitle>
            <DialogDescription>Provide a reason — this will be sent to the user as a notification.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason for removal..." value={removeReason} onChange={e => setRemoveReason(e.target.value)} rows={3} autoComplete="off" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removing}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemoveConfirm} disabled={removing}>
              {removing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Posts / Feed</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Monitor and moderate user-generated content</p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input className="pl-8 w-56" placeholder="Search posts..." value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <PostSkeleton key={i} />)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Newspaper className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No posts found</p></div>
      ) : (
        <div className="space-y-3">
          {items.map((post) => (
            <div key={post.id} className={cn("bg-card border border-border rounded-xl p-4", !post.is_active && "opacity-60 border-destructive/30")}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {post.user?.avatar ? <img src={post.user.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-sm font-bold text-muted-foreground">{post.user?.name?.[0]}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground">{post.user?.name || "Unknown"}</span>
                    <span className="text-xs text-muted-foreground">@{post.user?.username}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {post.created_at ? getTimeAgo(post.created_at) : "—"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{post.content || <em>No text</em>}</p>
                  {post.images?.length > 0 && (
                    <div className="flex gap-1.5 mt-2 overflow-x-auto">
                      {post.images.slice(0, 4).map((img: any, idx: number) => (
                        <img key={idx} src={img.url || img} alt="post" className="w-14 h-10 object-cover rounded flex-shrink-0" />
                      ))}
                      {post.images.length > 4 && (
                        <div className="w-14 h-10 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground flex-shrink-0">
                          +{post.images.length - 4}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5" /> {post.glow_count ?? 0} glows
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5" /> {post.echo_count ?? post.comment_count ?? 0} echoes
                    </span>
                    {post.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {post.location}
                      </span>
                    )}
                    {!post.is_active && <span className="text-destructive font-medium">• Removed</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/posts/${post.id}`)} title="View details">
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  {post.is_active ? (
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10"
                      onClick={() => { setRemoveTarget(post); setRemoveReason(""); }}>
                      Remove
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10"
                      onClick={() => handleRestore(post.id)}>
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restore
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pagination && pagination.total_pages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm text-muted-foreground">Page {page} of {pagination.total_pages}</span>
          <Button variant="outline" size="icon" onClick={() => setPage(p => p + 1)} disabled={page >= pagination.total_pages}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
}
