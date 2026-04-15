import { useEffect, useState, useCallback, useRef } from "react";
import { Flag, CheckCircle, Trash2, Loader2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminTableSkeleton } from "@/components/ui/AdminTableSkeleton";
import { adminApi } from "@/lib/api/admin";
import { useAdminMeta } from "@/hooks/useAdminMeta";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = ["all", "unresolved", "resolved"] as const;

export default function AdminNameFlags() {
  useAdminMeta("Name Flags");
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoad = useRef(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("unresolved");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (initialLoad.current) setLoading(true);
    const res = await adminApi.getNameFlags({ page, limit: 20, status: statusFilter });
    if (res.success) {
      setFlags(Array.isArray(res.data) ? res.data : res.data?.items || []);
      setPagination((res as any).pagination || res.data?.pagination || null);
    }
    setLoading(false);
    initialLoad.current = false;
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleResolve = async (id: string) => {
    setActionLoading(id);
    const res = await adminApi.resolveNameFlag(id);
    if (res.success) { toast.success("Flag resolved"); load(); }
    else toast.error(res.message || "Failed");
    setActionLoading(null);
  };

  const handleDelete = async (id: string) => {
    setActionLoading(`del-${id}`);
    const res = await adminApi.deleteNameFlag(id);
    if (res.success) { toast.success("Flag deleted"); load(); }
    else toast.error(res.message || "Failed");
    setActionLoading(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Name Validation Flags</h1>
        </div>
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize",
                statusFilter === s
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <AdminTableSkeleton rows={6} />
      ) : flags.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Flag className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No {statusFilter !== "all" ? statusFilter : ""} name flags found</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground text-left">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Flagged Name</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {flags.map((f: any) => (
                  <tr key={f.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground text-xs">{f.user_name}</p>
                        <p className="text-[11px] text-muted-foreground">{f.user_email || f.user_phone || "—"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs">
                        {f.flagged_first_name && <span className="text-destructive font-medium">{f.flagged_first_name}</span>}
                        {f.flagged_first_name && f.flagged_last_name && " "}
                        {f.flagged_last_name && <span className="text-destructive font-medium">{f.flagged_last_name}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-muted-foreground max-w-[200px] truncate">{f.flag_reason}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        f.is_resolved
                        ? "bg-primary/10 text-primary"
                        : "bg-destructive/10 text-destructive"
                      )}>
                        {f.is_resolved ? "Resolved" : "Unresolved"}
                      </span>
                      {f.resolved_by && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">by {f.resolved_by}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {f.created_at ? new Date(f.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!f.is_resolved && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-primary hover:bg-primary/10"
                            disabled={actionLoading === f.id}
                            onClick={() => handleResolve(f.id)}
                          >
                            {actionLoading === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-destructive hover:bg-destructive/10"
                          disabled={actionLoading === `del-${f.id}`}
                          onClick={() => handleDelete(f.id)}
                        >
                          {actionLoading === `del-${f.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
              <p className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="outline" className="h-7" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
