import { useEffect, useState, useCallback, useRef } from "react";
import { ShieldCheck, CheckCircle2, XCircle, Search, ChevronLeft, ChevronRight, RefreshCw, FileText, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdminTableSkeleton } from "@/components/ui/AdminTableSkeleton";
import { adminApi } from "@/lib/api/admin";
import { adminCaches } from "@/lib/api/adminCache";
import { usePolling } from "@/hooks/usePolling";
import { useAdminMeta } from "@/hooks/useAdminMeta";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

export default function AdminUserVerifications() {
  useAdminMeta("User Verification");
  const cache = adminCaches.userVerifications;
  const [items, setItems] = useState<any[]>(cache.data);
  const [loading, setLoading] = useState(!cache.loaded);
  const initialLoad = useRef(!cache.loaded);
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [actionDialog, setActionDialog] = useState<{ type: "approve" | "reject"; id: string; userName: string; docType: string } | null>(null);
  const [notes, setNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    if (initialLoad.current) setLoading(true);
    const res = await adminApi.getUserVerifications({ status: status || undefined, page, limit: 20 });
    if (res.success) {
      const data = Array.isArray(res.data) ? res.data : [];
      cache.set(data);
      setItems(data);
      setPagination((res as any).pagination ?? null);
    } else if (initialLoad.current) toast.error("Failed to load identity verifications");
    setLoading(false);
    initialLoad.current = false;
  }, [status, page]);

  useEffect(() => {
    if (!cache.loaded || status || page > 1) { initialLoad.current = true; }
    load();
  }, [load, status, page]);
  usePolling(load);

  const handleAction = async () => {
    if (!actionDialog) return;
    if (actionDialog.type === "reject" && !notes.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    setActionLoading(true);
    const res = actionDialog.type === "approve"
      ? await adminApi.approveUserVerification(actionDialog.id, notes)
      : await adminApi.rejectUserVerification(actionDialog.id, notes);
    if (res.success) {
      toast.success(actionDialog.type === "approve" ? "Identity verified!" : "Verification rejected");
      setActionDialog(null); setNotes(""); load();
    } else toast.error(res.message || "Action failed");
    setActionLoading(false);
  };

  const filtered = q ? items.filter(i =>
    i.user?.name?.toLowerCase().includes(q.toLowerCase()) ||
    i.document_type?.toLowerCase().includes(q.toLowerCase())
  ) : items;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">User Identity Verification</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Review and approve user-submitted identity documents</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { initialLoad.current = true; load(); }} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name or document..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
          {statusTabs.map(tab => (
            <button key={tab.value} onClick={() => { setStatus(tab.value); setPage(1); }}
              className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors", status === tab.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <AdminTableSkeleton columns={6} rows={8} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No identity verifications found</p></div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Document Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Doc Number</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Submitted</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {item.user?.avatar ? (
                        <img src={item.user.avatar} className="w-7 h-7 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {item.user?.name?.[0] || "?"}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-foreground text-xs">{item.user?.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{item.user?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.document_type || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{item.document_number || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", statusBadge(item.verification_status))}>
                      {item.verification_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {item.document_file_url && (
                        <a href={item.document_file_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" title="View document">
                            <FileText className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                      {item.verification_status === "pending" && (
                        <>
                          <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10"
                            onClick={() => setActionDialog({ type: "approve", id: item.id, userName: item.user?.name || "User", docType: item.document_type || "document" })}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10"
                            onClick={() => setActionDialog({ type: "reject", id: item.id, userName: item.user?.name || "User", docType: item.document_type || "document" })}>
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        </>
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

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => { setActionDialog(null); setNotes(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.type === "approve" ? "✅ Approve" : "❌ Reject"} Identity — {actionDialog?.userName}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{actionDialog?.docType}</p>
          </DialogHeader>
          <div className="space-y-3">
            <Label>{actionDialog?.type === "approve" ? "Notes (optional)" : "Rejection reason (required)"}</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder={actionDialog?.type === "approve" ? "Optional notes..." : "State why the document was rejected..."} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setNotes(""); }}>Cancel</Button>
            <Button onClick={handleAction} disabled={actionLoading} variant={actionDialog?.type === "reject" ? "destructive" : "default"}>
              Confirm {actionDialog?.type === "approve" ? "Approval" : "Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
