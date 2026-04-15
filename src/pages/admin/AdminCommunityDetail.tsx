import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Users, RefreshCw, Crown, Heart, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/api/admin";
import { useAdminMeta } from "@/hooks/useAdminMeta";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getTimeAgo } from "@/utils/getTimeAgo";

function MemberAvatar({ member }: { member: any }) {
  const name = member.user?.name || "?";
  const avatar = member.user?.avatar;
  const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <div className="w-11 h-11 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center shrink-0 border-2 border-border relative">
        {avatar ? (
          <img src={avatar} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm font-semibold text-primary">{initials}</span>
        )}
        {member.role === "admin" && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
            <Crown className="w-2.5 h-2.5 text-white" />
          </span>
        )}
      </div>
      <span className="text-xs text-muted-foreground truncate w-full text-center max-w-[64px]">{name.split(" ")[0]}</span>
    </div>
  );
}

export default function AdminCommunityDetail() {
  useAdminMeta("Community Detail");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await adminApi.getCommunityDetail(id);
    if (res.success) {
      setDetail(res.data);
    } else {
      toast.error("Failed to load community detail");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>Community not found</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/admin/communities")}>
          Back to Communities
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/communities")}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground">{detail.name}</h2>
          <p className="text-sm text-muted-foreground">{detail.description || "No description"}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Cover + Stats */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {detail.cover_image_url ? (
          <div className="w-full h-40 overflow-hidden">
            <img src={detail.cover_image_url} alt={detail.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-full h-24 bg-gradient-to-r from-primary/20 to-primary/5 flex items-center justify-center">
            <Users className="w-10 h-10 text-primary/30" />
          </div>
        )}
        <div className="p-4 flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className={cn("text-xs px-2 py-0.5 rounded-full font-medium", detail.is_public ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
              {detail.is_public ? "Public" : "Private"}
            </div>
          </div>
          <div className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{detail.member_count}</span> members</div>
          <div className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{detail.post_count ?? detail.posts?.length ?? 0}</span> posts</div>
          {detail.creator && (
            <div className="text-sm text-muted-foreground">Created by <span className="font-semibold text-foreground">{detail.creator.name}</span></div>
          )}
          {detail.created_at && (
            <div className="text-sm text-muted-foreground">{new Date(detail.created_at).toLocaleDateString()}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Members */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4" /> Members ({detail.members?.length ?? 0})
            </h3>
          </div>
          {(!detail.members || detail.members.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-8">No members yet</p>
          ) : (
            <div className="flex flex-wrap gap-3 max-h-72 overflow-y-auto pr-1">
              {detail.members.map((m: any) => (
                <MemberAvatar key={m.id} member={m} />
              ))}
            </div>
          )}
        </div>

        {/* Recent Posts / Chat Feed */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
            <ImageIcon className="w-4 h-4" /> Community Posts ({detail.posts?.length ?? 0})
          </h3>
          {(!detail.posts || detail.posts.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-8">No posts yet</p>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {detail.posts.map((post: any) => (
                <div key={post.id} className="bg-muted/40 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center shrink-0">
                      {post.author?.avatar ? (
                        <img src={post.author.avatar} alt={post.author.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-semibold text-primary">
                          {post.author?.name?.[0]?.toUpperCase() || "?"}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-medium text-foreground">{post.author?.name || "Unknown"}</span>
                      <span className="text-xs text-muted-foreground ml-2">{post.created_at ? getTimeAgo(post.created_at) : ""}</span>
                    </div>
                    {post.glow_count > 0 && (
                      <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="text-xs">❤️</span>{post.glow_count}
                      </div>
                    )}
                  </div>
                  {post.content && <p className="text-sm text-foreground">{post.content}</p>}
                  {post.images && post.images.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {post.images.map((img: any) => (
                        <img key={img.id} src={img.image_url} alt="" className="w-16 h-16 rounded object-cover" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
