import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Heart, MessageCircle, MapPin, Trash2, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/api/admin";
import { useAdminMeta } from "@/hooks/useAdminMeta";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getTimeAgo } from "@/utils/getTimeAgo";

export default function AdminPostDetail() {
  useAdminMeta("Post Detail");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deletingEcho, setDeletingEcho] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await adminApi.getPostDetail(id);
    if (res.success) setPost(res.data);
    else toast.error("Failed to load post");
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleRemove = async () => {
    if (!post) return;
    const reason = window.prompt("Reason for removing this post? (Sent to the user)");
    if (reason === null) return;
    const res = await adminApi.updatePostStatus(post.id, false, reason || "Policy violation");
    if (res.success) { toast.success("Post removed"); load(); }
    else toast.error(res.message || "Failed");
  };

  const handleRestore = async () => {
    if (!post) return;
    const ok = await confirm({ title: "Restore Post?", description: "Restore this post to the feed?", confirmLabel: "Restore" });
    if (!ok) return;
    const res = await adminApi.updatePostStatus(post.id, true);
    if (res.success) { toast.success("Post restored"); load(); }
    else toast.error(res.message || "Failed");
  };

  const handleDeleteEcho = async (echoId: string, echoContent: string) => {
    const ok = await confirm({ title: "Delete Echo?", description: `Delete comment: "${echoContent?.slice(0, 50)}..."?`, confirmLabel: "Delete", destructive: true });
    if (!ok) return;
    setDeletingEcho(echoId);
    const res = await adminApi.deletePostEcho(id!, echoId);
    if (res.success) { toast.success("Echo deleted"); load(); }
    else toast.error(res.message || "Failed");
    setDeletingEcho(null);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Post not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/posts")}>Back to Posts</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog />

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/posts")}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Posts
        </Button>
        <div className="flex-1" />
        {post.is_active ? (
          <Button variant="destructive" size="sm" onClick={handleRemove}>Remove Post</Button>
        ) : (
          <Button variant="outline" size="sm" onClick={handleRestore}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Restore Post
          </Button>
        )}
      </div>

      {/* Post Card */}
      <div className={cn("bg-card border border-border rounded-xl p-5", !post.is_active && "border-destructive/40")}>
        {!post.is_active && (
          <div className="bg-destructive/10 text-destructive text-xs px-3 py-2 rounded-lg mb-4 font-medium">
            ⚠ This post has been removed from the feed.
          </div>
        )}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {post.user?.avatar ? (
              <img src={post.user.avatar} className="w-full h-full object-cover" alt="" />
            ) : (
              <span className="text-sm font-bold text-muted-foreground">{post.user?.name?.[0]}</span>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{post.user?.name || "Unknown"}</span>
              <span className="text-sm text-muted-foreground">@{post.user?.username}</span>
              <span className="text-xs text-muted-foreground ml-auto">{post.created_at ? getTimeAgo(post.created_at) : "—"}</span>
            </div>
            <p className="mt-2 text-foreground leading-relaxed">{post.content}</p>
          </div>
        </div>

        {/* Images */}
        {post.images?.length > 0 && (
          <div className={cn("mt-4 grid gap-2", post.images.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
            {post.images.map((img: any, i: number) => (
              <img key={i} src={img.url || img} alt="post" className="w-full rounded-lg object-cover max-h-64" />
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-5 mt-4 pt-3 border-t border-border text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><Heart className="w-4 h-4" /> {post.glow_count ?? 0} glows</span>
          <span className="flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /> {post.echo_count ?? post.comment_count ?? 0} echoes</span>
          {post.location && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {post.location}</span>}
        </div>
      </div>

      {/* Echoes / Comments */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-3">Echoes ({(post.echoes || post.comments || []).length})</h3>
        {(post.echoes || post.comments || []).length === 0 ? (
          <p className="text-muted-foreground text-sm py-6 text-center">No echoes on this post</p>
        ) : (
          <div className="space-y-2">
            {(post.echoes || post.comments || []).map((echo: any) => (
              <div key={echo.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {echo.user?.avatar ? (
                    <img src={echo.user.avatar} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <span className="text-xs font-bold text-muted-foreground">{echo.user?.name?.[0]}</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">{echo.user?.name || "Unknown"}</span>
                    <span className="text-xs text-muted-foreground">{echo.created_at ? getTimeAgo(echo.created_at) : ""}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{echo.content}</p>
                </div>
                <Button
                  variant="ghost" size="sm"
                  className="text-destructive hover:bg-destructive/10 shrink-0"
                  disabled={deletingEcho === echo.id}
                  onClick={() => handleDeleteEcho(echo.id, echo.content)}
                >
                  {deletingEcho === echo.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
