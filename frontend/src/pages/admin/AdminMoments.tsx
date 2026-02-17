import { useEffect, useState, useCallback, useRef } from "react";
import { Sparkles, Search, Video, Image, ChevronLeft, ChevronRight, Eye, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminTableSkeleton } from "@/components/ui/AdminTableSkeleton";
import { adminApi } from "@/lib/api/admin";
import { adminCaches } from "@/lib/api/adminCache";
import { usePolling } from "@/hooks/usePolling";
import { useAdminMeta } from "@/hooks/useAdminMeta";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useNavigate } from "react-router-dom";


export default function AdminMoments() {
  useAdminMeta("Moments");
  const navigate = useNavigate();
  const cache = adminCaches.moments;
  const [items, setItems] = useState<any[]>(cache.data);
  const [loading, setLoading] = useState(!cache.loaded);
  const initialLoad = useRef(!cache.loaded);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(adminCaches.pagination["moments"] ?? null);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const load = useCallback(async () => {
    if (initialLoad.current) setLoading(true);
    const res = await adminApi.getMoments({ q: q || undefined, page, limit: 20 });
    if (res.success) {
      const data = Array.isArray(res.data) ? res.data : [];
      cache.set(data);
      adminCaches.pagination["moments"] = (res as any).pagination ?? null;
      setItems(data);
      setPagination((res as any).pagination ?? null);
    } else if (initialLoad.current) toast.error("Failed to load moments");
    setLoading(false);
    initialLoad.current = false;
  }, [q, page]);

  useEffect(() => {
    if (q || page > 1) { initialLoad.current = true; load(); return; }
    if (!cache.loaded) { initialLoad.current = true; load(); }
    else load();
  }, [load, q, page]);
  usePolling(load);

  const handleRemove = async (id: string) => {
    const reason = window.prompt("Reason for removing this moment? (This will be sent to the user)");
    if (reason === null) return;
    const res = await adminApi.updateMomentStatus(id, false, reason || "Policy violation");
    if (res.success) { toast.success("Moment removed"); load(); }
    else toast.error(res.message || "Failed");
  };

  const handleRestore = async (id: string) => {
    const ok = await confirm({ title: "Restore Moment?", description: "Restore this moment? It will be visible to users again.", confirmLabel: "Restore" });
    if (!ok) return;
    const res = await adminApi.updateMomentStatus(id, true);
    if (res.success) { toast.success("Moment restored"); load(); }
    else toast.error(res.message || "Failed");
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Moments</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Monitor and moderate user stories/moments</p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input className="pl-8 w-56" placeholder="Search captions..." value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
        </div>
      </div>

      {loading ? (
        <AdminTableSkeleton columns={7} rows={8} />
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No moments found</p></div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Caption</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Media</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Views</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Privacy</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Posted</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((m) => (
                <tr key={m.id} className={cn("hover:bg-muted/30 transition-colors", !m.is_active && "opacity-40")}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold overflow-hidden">
                        {m.user?.avatar ? <img src={m.user.avatar} className="w-full h-full object-cover" alt="" /> : m.user?.name?.[0]}
                      </div>
                      <div>
                        <div className="font-medium text-foreground text-xs">{m.user?.name || "—"}</div>
                        <div className="text-xs text-muted-foreground">@{m.user?.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{m.caption || <em>No caption</em>}</td>
                  <td className="px-4 py-3">
                    {m.media_url ? (
                      <div className="w-12 h-9 rounded overflow-hidden bg-muted">
                        {m.content_type === "video" ? (
                          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground"><Video className="w-4 h-4" /></div>
                        ) : (
                          <img src={m.media_url} alt="moment" className="w-full h-full object-cover" />
                        )}
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {m.content_type === "video" ? <Video className="w-3.5 h-3.5" /> : <Image className="w-3.5 h-3.5" />}
                        {m.content_type}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{m.view_count}</td>
                  <td className="px-4 py-3"><span className="text-xs capitalize px-2 py-0.5 rounded-full bg-muted">{m.privacy}</span></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/moments/${m.id}`)} title="View details">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      {m.is_active ? (
                        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 text-xs" onClick={() => handleRemove(m.id)}>
                          Remove
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10" onClick={() => handleRestore(m.id)}>
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
