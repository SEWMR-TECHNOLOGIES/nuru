import { useEffect, useState, useCallback, useRef } from "react";
import { Briefcase, Search, ChevronLeft, ChevronRight, Eye, ShieldCheck, RefreshCw, Ban, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdminTableSkeleton } from "@/components/ui/AdminTableSkeleton";
import { adminApi } from "@/lib/api/admin";
import { adminCaches } from "@/lib/api/adminCache";
import { usePolling } from "@/hooks/usePolling";
import { useAdminMeta } from "@/hooks/useAdminMeta";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
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
  if (s === "verified") return "bg-primary/10 text-primary";
  if (s === "rejected") return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
};

const VERIFICATION_STATUSES = ["pending", "verified", "rejected", "suspended"];

export default function AdminServices() {
  useAdminMeta("Services");
  const navigate = useNavigate();
  const cache = adminCaches.services;
  const [services, setServices] = useState<any[]>(cache.data);
  const [loading, setLoading] = useState(!cache.loaded);
  const initialLoad = useRef(!cache.loaded);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Record<string, any> | null>(adminCaches.pagination["services"] ?? null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [statusDialog, setStatusDialog] = useState<{ id: string; title: string; current: string; is_active: boolean } | null>(null);
  const [newVerificationStatus, setNewVerificationStatus] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const load = useCallback(async () => {
    if (initialLoad.current) setLoading(true);
    const res = await adminApi.getServices({ page, limit: 20, q: q || undefined, status: status || undefined });
    if (res.success) {
      const data = Array.isArray(res.data) ? res.data : [];
      cache.set(data);
      adminCaches.pagination["services"] = (res as any).pagination ?? null;
      setServices(data);
      setPagination((res as any).pagination ?? null);
    } else if (initialLoad.current) toast.error("Failed to load services");
    setLoading(false);
    initialLoad.current = false;
  }, [page, q, status]);

  useEffect(() => {
    if (q || page > 1 || status) { initialLoad.current = true; }
    if (!cache.loaded) { initialLoad.current = true; load(); }
    else load();
  }, [load, q, page, status]);
  usePolling(load);

  const openStatusDialog = (s: any) => {
    setNewVerificationStatus(s.verification_status || "pending");
    setStatusDialog({ id: s.id, title: s.name, current: s.verification_status, is_active: s.is_active });
  };

  const handleToggleActive = async (id: string, isActive: boolean, name: string) => {
    const ok = await confirm({
      title: isActive ? "Suspend Service?" : "Activate Service?",
      description: `${isActive ? "Suspend" : "Activate"} service "${name}"?`,
      confirmLabel: isActive ? "Suspend" : "Activate",
      destructive: isActive,
    });
    if (!ok) return;
    const res = await adminApi.toggleServiceActive(id, !isActive);
    if (res.success) { toast.success(isActive ? "Service suspended" : "Service activated"); load(); }
    else toast.error(res.message || "Failed");
  };

  const handleStatusUpdate = async () => {
    if (!statusDialog || !newVerificationStatus) return;
    setUpdatingStatus(true);
    const res = await adminApi.updateServiceVerificationStatus(statusDialog.id, newVerificationStatus);
    if (res.success) { toast.success("Service status updated"); setStatusDialog(null); load(); }
    else toast.error(res.message || "Failed");
    setUpdatingStatus(false);
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog />
      <div>
        <h2 className="text-xl font-bold text-foreground">Services</h2>
        <p className="text-sm text-muted-foreground mt-0.5">View and manage all service provider listings</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search services..." className="pl-9" />
        </div>
        <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
          {statusTabs.map((tab) => (
            <button key={tab.value} onClick={() => { setStatus(tab.value); setPage(1); }}
              className={cn("px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors", status === tab.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <AdminTableSkeleton columns={7} rows={8} />
      ) : services.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No services found</p></div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Service</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Provider</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Active</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {services.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground max-w-xs truncate">{s.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {s.user?.avatar ? (
                        <img src={s.user.avatar} alt={s.user.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                          {s.user?.name?.[0] || "?"}
                        </div>
                      )}
                      <span className="text-muted-foreground truncate max-w-[100px]">{s.user?.name || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.category || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", statusBadge(s.verification_status))}>
                      {s.verification_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", s.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                      {s.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/services/${s.id}`)} title="View details">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openStatusDialog(s)} title="Manage status">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className={s.is_active ? "text-destructive hover:bg-destructive/10" : "text-primary hover:bg-primary/10"}
                        onClick={() => handleToggleActive(s.id, s.is_active, s.name)}
                        title={s.is_active ? "Suspend" : "Activate"}
                      >
                        {s.is_active ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
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
          <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm text-muted-foreground">Page {page} of {pagination.total_pages}</span>
          <Button variant="outline" size="icon" onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.total_pages}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}

      {/* Quick Status Dialog */}
      <Dialog open={!!statusDialog} onOpenChange={() => setStatusDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Service Status</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">{statusDialog?.title}</p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">Verification Status</p>
              <Select value={newVerificationStatus} onValueChange={setNewVerificationStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {VERIFICATION_STATUSES.map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialog(null)}>Cancel</Button>
            <Button onClick={handleStatusUpdate} disabled={updatingStatus}>
              {updatingStatus ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
