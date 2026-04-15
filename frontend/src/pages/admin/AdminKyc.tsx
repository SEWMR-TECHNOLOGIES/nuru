import { useEffect, useState, useCallback, useRef } from "react";
import { ShieldCheck, Eye, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminTableSkeleton } from "@/components/ui/AdminTableSkeleton";
import { adminApi } from "@/lib/api/admin";
import { adminCaches } from "@/lib/api/adminCache";
import { usePolling } from "@/hooks/usePolling";
import { useAdminMeta } from "@/hooks/useAdminMeta";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const statusTabs = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Verified", value: "verified" },
  { label: "Rejected", value: "rejected" },
];

const statusBadge = (s: string) => {
  if (s === "pending") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  if (s === "verified") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (s === "rejected") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  return "bg-muted text-muted-foreground";
};

export default function AdminKyc() {
  useAdminMeta("KYC Verification");
  const navigate = useNavigate();
  const cache = adminCaches.kyc;
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState<any[]>(cache.data);
  const [loading, setLoading] = useState(!cache.loaded);
  const initialLoad = useRef(!cache.loaded);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Record<string, any> | null>(adminCaches.pagination["kyc"] ?? null);

  const load = useCallback(async () => {
    if (initialLoad.current) setLoading(true);
    const res = await adminApi.getKycSubmissions({ status: status || undefined, page, limit: 20 });
    if (res.success) {
      const data = Array.isArray(res.data) ? res.data : [];
      cache.set(data);
      adminCaches.pagination["kyc"] = (res as any).pagination ?? null;
      setItems(data);
      setPagination((res as any).pagination ?? null);
    } else if (initialLoad.current) toast.error("Failed to load KYC submissions");
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
          <h2 className="text-xl font-bold text-foreground">KYC Verification</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Review and approve service provider verifications per KYC item</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { initialLoad.current = true; load(); }} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {statusTabs.map((tab) => (
          <button key={tab.value} onClick={() => { setStatus(tab.value); setPage(1); }}
            className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors", status === tab.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <AdminTableSkeleton columns={5} rows={8} />
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No submissions found</p></div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Service</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Owner</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">KYC Items</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Overall</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => {
                const pendingItems = (item.kyc_items || []).filter((k: any) => k.status === "pending").length;
                const totalItems = (item.kyc_items || []).length;
                return (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{item.service_name || "—"}</div>
                      {item.service_id && (
                        <button
                          onClick={() => navigate(`/admin/services/${item.service_id}`)}
                          className="text-xs text-primary hover:underline mt-0.5"
                        >
                          View Service →
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-foreground">{item.user?.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{item.user?.email}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {totalItems > 0 ? `${totalItems - pendingItems}/${totalItems} approved` : "No items"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", statusBadge(item.status))}>{item.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/kyc/${item.id}`)}>
                        <Eye className="w-3.5 h-3.5 mr-1" /> Review
                      </Button>
                    </td>
                  </tr>
                );
              })}
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
