import { useEffect, useState, useCallback, useRef } from "react";
import { Users2, Trash2, Search, ChevronLeft, ChevronRight, RefreshCw, Eye } from "lucide-react";
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



export default function AdminCommunities() {
  useAdminMeta("Communities");
  const navigate = useNavigate();
  const cache = adminCaches.communities;
  const [items, setItems] = useState<any[]>(cache.data);
  const [loading, setLoading] = useState(!cache.loaded);
  const initialLoad = useRef(!cache.loaded);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(adminCaches.pagination["communities"] ?? null);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const load = useCallback(async () => {
    if (initialLoad.current) setLoading(true);
    const res = await adminApi.getCommunities({ q: q || undefined, page, limit: 20 });
    if (res.success) {
      const data = Array.isArray(res.data) ? res.data : [];
      cache.set(data);
      adminCaches.pagination["communities"] = (res as any).pagination ?? null;
      setItems(data);
      setPagination((res as any).pagination ?? null);
    } else if (initialLoad.current) toast.error("Failed to load communities");
    setLoading(false);
    initialLoad.current = false;
  }, [q, page]);

  useEffect(() => {
    if (q || page > 1) { initialLoad.current = true; load(); return; }
    if (!cache.loaded) { initialLoad.current = true; load(); }
    else load(); // silent background refresh
  }, [load, q, page]);
  usePolling(load);

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({ title: "Delete Community?", description: `Delete "${name}"? This is permanent and removes all members and posts.`, confirmLabel: "Delete", destructive: true });
    if (!ok) return;
    const res = await adminApi.deleteCommunity(id);
    if (res.success) { toast.success("Community deleted"); load(); }
    else toast.error(res.message || "Failed");
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Communities</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Monitor and moderate user communities</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input className="pl-8 w-56" placeholder="Search communities..." value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
          </div>
          <Button variant="outline" size="sm" onClick={() => { initialLoad.current = true; load(); }} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} /> Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <AdminTableSkeleton columns={6} rows={8} />
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Users2 className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No communities found</p></div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Community</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Creator</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Members</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Visibility</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted shrink-0 overflow-hidden">
                        {c.cover_image_url ? (
                          <img src={c.cover_image_url} alt={c.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                            {c.name?.charAt(0)?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{c.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{c.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.creator?.name || "—"}</td>
                  <td className="px-4 py-3 text-foreground font-medium">{c.member_count}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", c.is_public ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                      {c.is_public ? "Public" : "Private"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/communities/${c.id}`)}>
                        <Eye className="w-3.5 h-3.5 mr-1" /> View
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(c.id, c.name)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
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
