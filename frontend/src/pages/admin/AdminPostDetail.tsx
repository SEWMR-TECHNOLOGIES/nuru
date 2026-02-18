import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Heart, MessageCircle, MapPin, Trash2, RotateCcw, Loader2, CornerDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/api/admin";
import { useAdminMeta } from "@/hooks/useAdminMeta";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getTimeAgo } from "@/utils/getTimeAgo";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

// Recursive echo thread renderer
function EchoThread({
  echo,
  depth = 0,
  postId,
  onDelete,
  deletingId,
}: {
  echo: any;
  depth?: number;
  postId: string;
  onDelete: (id: string, content: string) => void;
  deletingId: string | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const hasReplies = echo.replies && echo.replies.length > 0;

  return (
    <div className={cn("", depth > 0 && "ml-7 mt-1.5")}>
      <div className={cn(
        "flex items-start gap-3 rounded-xl p-3",
        depth === 0 ? "bg-card border border-border" : "bg-muted/30 border border-border/50"
      )}>
        {/* Avatar */}
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
          {echo.user?.avatar
            ? <img src={echo.user.avatar} className="w-full h-full object-cover" alt="" />
            : <span className="text-xs font-bold text-muted-foreground">{echo.user?.name?.[0]}</span>
          }
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground">{echo.user?.name || "Unknown"}</span>
            <span className="text-xs text-muted-foreground">@{echo.user?.username}</span>
            <span className="text-xs text-muted-foreground ml-auto">{echo.created_at ? getTimeAgo(echo.created_at) : ""}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{echo.content}</p>
          {hasReplies && (
            <button
              className="text-xs text-primary mt-1 hover:underline"
              onClick={() => setCollapsed(c => !c)}
            >
              {collapsed ? `Show ${echo.replies.length} repl${echo.replies.length === 1 ? "y" : "ies"}` : `Hide replies`}
            </button>
          )}
        </div>
        {/* Delete */}
        <Button
          variant="ghost" size="sm"
          className="text-destructive hover:bg-destructive/10 shrink-0 h-7 px-2"
          disabled={deletingId === echo.id}
          onClick={() => onDelete(echo.id, echo.content)}
        >
          {deletingId === echo.id
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Trash2 className="w-3.5 h-3.5" />
          }
        </Button>
      </div>

      {/* Replies */}
      {hasReplies && !collapsed && (
        <div className="relative mt-1">
          <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-1.5">
            {echo.replies.map((reply: any) => (
              <div key={reply.id} className="flex items-start gap-1">
                <CornerDownRight className="w-3.5 h-3.5 mt-2.5 text-muted-foreground shrink-0 ml-2" />
                <div className="flex-1">
                  <EchoThread
                    echo={reply}
                    depth={depth + 1}
                    postId={postId}
                    onDelete={onDelete}
                    deletingId={deletingId}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPostDetail() {
  useAdminMeta("Post Detail");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deletingEcho, setDeletingEcho] = useState<string | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeReason, setRemoveReason] = useState("");
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await adminApi.getPostDetail(id);
    if (res.success) setPost(res.data);
    else toast.error("Failed to load post");
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleRemoveConfirm = async () => {
    if (!post) return;
    setRemoving(true);
    const res = await adminApi.updatePostStatus(post.id, false, removeReason.trim() || "Policy violation");
    if (res.success) { toast.success("Post removed"); setRemoveDialogOpen(false); setRemoveReason(""); load(); }
    else toast.error(res.message || "Failed");
    setRemoving(false);
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
    const ok = await confirm({ title: "Delete Echo?", description: `Delete: "${echoContent?.slice(0, 60)}"?`, confirmLabel: "Delete", destructive: true });
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
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
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

  const echoes: any[] = post.echoes || post.comments || [];
  const totalEchoes = post.echo_count ?? post.comment_count ?? echoes.length;

  return (
    <div className="space-y-6">
      <ConfirmDialog />

      {/* Remove reason dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Post</DialogTitle>
            <DialogDescription>Provide a reason — this will be sent to the user as a notification.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason for removal..." value={removeReason} onChange={e => setRemoveReason(e.target.value)} rows={3} autoComplete="off" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialogOpen(false)} disabled={removing}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemoveConfirm} disabled={removing}>
              {removing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/posts")}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Posts
        </Button>
        <div className="flex-1" />
        {post.is_active ? (
          <Button variant="destructive" size="sm" onClick={() => setRemoveDialogOpen(true)}>Remove Post</Button>
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
            ⚠ This post has been removed from the feed.{post.removal_reason ? ` Reason: ${post.removal_reason}` : ""}
          </div>
        )}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {post.user?.avatar
              ? <img src={post.user.avatar} className="w-full h-full object-cover" alt="" />
              : <span className="text-sm font-bold text-muted-foreground">{post.user?.name?.[0]}</span>
            }
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

        {post.images?.length > 0 && (
          <div className={cn("mt-4 grid gap-2", post.images.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
            {post.images.map((img: any, i: number) => (
              <img key={i} src={img.url || img} alt="post" className="w-full rounded-lg object-contain max-h-96 bg-muted" />
            ))}
          </div>
        )}

        {/* Live Stats */}
        <div className="flex items-center gap-5 mt-4 pt-3 border-t border-border text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><Heart className="w-4 h-4" /> {post.glow_count ?? 0} glows</span>
          <span className="flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /> {totalEchoes} echoes</span>
          {post.location && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {post.location}</span>}
        </div>
      </div>

      {/* Threaded Echoes */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-3">
          Echoes ({totalEchoes})
        </h3>
        {echoes.length === 0 ? (
          <p className="text-muted-foreground text-sm py-6 text-center">No echoes on this post</p>
        ) : (
          <div className="space-y-2">
            {echoes.map((echo: any) => (
              <EchoThread
                key={echo.id}
                echo={echo}
                postId={id!}
                onDelete={handleDeleteEcho}
                deletingId={deletingEcho}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
