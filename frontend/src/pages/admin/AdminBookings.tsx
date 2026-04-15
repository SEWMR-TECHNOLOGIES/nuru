import { useEffect, useState, useCallback, useRef } from "react";
import { useAdminMeta } from "@/hooks/useAdminMeta";
import { BookOpen, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminTableSkeleton } from "@/components/ui/AdminTableSkeleton";
import { adminApi } from "@/lib/api/admin";
import { adminCaches } from "@/lib/api/adminCache";
import { usePolling } from "@/hooks/usePolling";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusTabs = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Accepted", value: "accepted" },
  { label: "Rejected", value: "rejected" },
  { label: "Completed", value: "completed" },
];

const statusBadge = (s: string) => {
  if (s === "pending") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  if (s === "accepted") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (s === "rejected") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  if (s === "completed") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  return "bg-muted text-muted-foreground";
};

export default function AdminBookings() {
  useAdminMeta("Bookings");
  const cache = adminCaches.bookings;
  const [items, setItems] = useState<any[]>(cache.data);
  const [loading, setLoading] = useState(!cache.loaded);
  const initialLoad = useRef(!cache.loaded);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);

  const load = useCallback(async () => {
    if (initialLoad.current) setLoading(true);
    const res = await adminApi.getBookings({ status: status || undefined, page, limit: 20 });
    if (res.success) {
      const data = Array.isArray(res.data) ? res.data : [];
      cache.set(data);
      setItems(data);
      setPagination((res as any).pagination ?? null);
    } else if (initialLoad.current) toast.error("Failed to load bookings");
    setLoading(false);
    initialLoad.current = false;
  }, [status, page]);

  useEffect(() => {
    initialLoad.current = true;
    load();
  }, [load]);
  usePolling(load);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Bookings</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Monitor all service booking requests</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit flex-wrap">
        {statusTabs.map((tab) => (
          <button key={tab.value} onClick={() => { setStatus(tab.value); setPage(1); }}
            className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors", status === tab.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <AdminTableSkeleton columns={6} rows={8} />
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No bookings found</p></div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Requester</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Service</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Proposed</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Quoted</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((b) => (
                <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{b.requester?.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{b.requester?.email}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{b.service?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", statusBadge(b.status))}>{b.status}</span>
                  </td>
                   <td className="px-4 py-3 text-muted-foreground">{b.proposed_price ? `TZS ${b.proposed_price.toLocaleString()}` : "—"}</td>
                   <td className="px-4 py-3 text-muted-foreground">{b.quoted_price ? `TZS ${b.quoted_price.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{b.created_at ? new Date(b.created_at).toLocaleDateString() : "—"}</td>
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
