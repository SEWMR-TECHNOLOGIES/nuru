import { useState, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Ticket, CheckCircle2, XCircle, Trash2, Ban, Search, Loader2 } from "lucide-react";
import { AdminTableSkeleton } from "@/components/ui/AdminTableSkeleton";
import { adminApi } from "@/lib/api/admin";
import { adminCaches } from "@/lib/api/adminCache";
import { usePolling } from "@/hooks/usePolling";
import { useAdminMeta } from "@/hooks/useAdminMeta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  removed: "bg-muted text-muted-foreground",
};

export default function AdminTicketedEvents() {
  useAdminMeta("Ticketed Events");
  const location = useLocation();
  const sp = new URLSearchParams(location.search);
  const cache = adminCaches.ticketedEvents;
  const [items, setItems] = useState<any[]>(cache.data);
  const [loading, setLoading] = useState(!cache.loaded);
  const initialLoad = useRef(!cache.loaded);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(adminCaches.pagination["ticketedEvents"] ?? null);
  const [status, setStatus] = useState(sp.get("status") || "");
  const [q, setQ] = useState("");
  const { confirm, ConfirmDialog } = useConfirmDialog();

  // Reject/Remove dialog
  const [reasonDialog, setReasonDialog] = useState<{ type: "reject" | "remove"; id: string } | null>(null);
  const [reason, setReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (initialLoad.current) setLoading(true);
    const res = await adminApi.getTicketedEvents({ status: status || undefined, page, limit: 20, q: q || undefined });
    if (res.success) {
      const data = Array.isArray(res.data) ? res.data : [];
      cache.set(data);
      adminCaches.pagination["ticketedEvents"] = (res as any).pagination ?? null;
      setItems(data);
      setPagination((res as any).pagination ?? null);
    } else if (initialLoad.current) toast.error("Failed to load ticketed events");
    setLoading(false);
    initialLoad.current = false;
  }, [status, page, q]);

  usePolling(load, 30000);

  const handleApprove = async (id: string) => {
    const ok = await confirm({ title: "Approve Event", description: "Approve this ticketed event? It will become visible on the public tickets page." });
    if (!ok) return;
    setApprovingId(id);
    const res = await adminApi.approveTicketedEvent(id);
    setApprovingId(null);
    if (res.success) { toast.success("Event approved"); load(); }
    else toast.error(res.message || "Failed");
  };

  const handleReasonSubmit = async () => {
    if (!reasonDialog || !reason.trim()) return;
    setActionLoading(true);
    const res = reasonDialog.type === "reject"
      ? await adminApi.rejectTicketedEvent(reasonDialog.id, reason.trim())
      : await adminApi.removeTicketedEvent(reasonDialog.id, reason.trim());
    setActionLoading(false);
    if (res.success) {
      toast.success(reasonDialog.type === "reject" ? "Event rejected" : "Event removed");
      setReasonDialog(null);
      setReason("");
      load();
    } else toast.error(res.message || "Failed");
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: "Delete Ticketing Data", description: "Permanently delete all ticketing data for this event? This cannot be undone.", destructive: true });
    if (!ok) return;
    const res = await adminApi.deleteTicketedEvent(id);
    if (res.success) { toast.success("Ticketing data deleted"); load(); }
    else toast.error(res.message || "Failed");
  };

  const statuses = ["", "pending", "approved", "rejected", "removed"];

  return (
    <div className="space-y-5">
      <ConfirmDialog />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Ticketed Events</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Review and approve events selling tickets</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {statuses.map((s) => (
            <Button
              key={s}
              variant={status === s ? "default" : "outline"}
              size="sm"
              onClick={() => { setStatus(s); setPage(1); }}
              className="capitalize text-xs"
            >
              {s || "All"}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <AdminTableSkeleton columns={7} rows={8} />
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Ticket className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No ticketed events found</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs">
                  <th className="px-4 py-3 text-left font-semibold">Event</th>
                  <th className="px-4 py-3 text-left font-semibold">Organizer</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-center font-semibold">Classes</th>
                  <th className="px-4 py-3 text-center font-semibold">Sold</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {e.cover_image ? (
                          <img src={e.cover_image} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <Ticket className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-foreground truncate max-w-[200px]">{e.name}</p>
                          <p className="text-xs text-muted-foreground">{e.location || "No location"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{e.organizer_name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {e.start_date ? new Date(e.start_date).toLocaleDateString() : "TBD"}
                    </td>
                    <td className="px-4 py-3 text-center">{e.ticket_class_count}</td>
                    <td className="px-4 py-3 text-center">{e.total_sold}/{e.total_tickets}</td>
                    <td className="px-4 py-3">
                      <Badge className={`${STATUS_STYLES[e.ticket_approval_status] || STATUS_STYLES.pending} border-0 text-[11px]`}>
                        {e.ticket_approval_status}
                      </Badge>
                      {e.ticket_rejection_reason && e.ticket_approval_status === "rejected" && (
                        <p className="text-[10px] text-red-500 mt-0.5 max-w-[150px] truncate" title={e.ticket_rejection_reason}>
                          {e.ticket_rejection_reason}
                        </p>
                      )}
                      {e.ticket_removed_reason && e.ticket_approval_status === "removed" && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[150px] truncate" title={e.ticket_removed_reason}>
                          {e.ticket_removed_reason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {e.ticket_approval_status !== "approved" && (
                          <Button size="sm" variant="ghost" onClick={() => handleApprove(e.id)} disabled={approvingId === e.id} className="text-green-600 hover:text-green-700 h-8 px-2">
                            {approvingId === e.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          </Button>
                        )}
                        {e.ticket_approval_status !== "rejected" && (
                          <Button size="sm" variant="ghost" onClick={() => { setReasonDialog({ type: "reject", id: e.id }); setReason(""); }} className="text-red-500 hover:text-red-600 h-8 px-2">
                            <XCircle className="w-4 h-4" />
                          </Button>
                        )}
                        {e.ticket_approval_status === "approved" && (
                          <Button size="sm" variant="ghost" onClick={() => { setReasonDialog({ type: "remove", id: e.id }); setReason(""); }} className="text-amber-600 hover:text-amber-700 h-8 px-2">
                            <Ban className="w-4 h-4" />
                          </Button>
                        )}
                        {e.ticket_approval_status !== "pending" && (
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(e.id)} className="text-destructive hover:text-destructive h-8 px-2">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
          <span className="text-xs text-muted-foreground">Page {page} of {pagination.pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}

      {/* Reject/Remove Dialog */}
      <Dialog open={!!reasonDialog} onOpenChange={() => setReasonDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reasonDialog?.type === "reject" ? "Reject Ticketed Event" : "Remove Ticketed Event"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {reasonDialog?.type === "reject"
              ? "Provide a reason for rejecting this ticketed event. The organizer will be notified."
              : "Provide a reason for removing this ticketed event. The event will be labeled as removed and tickets will be disabled."}
          </p>
          <Textarea
            placeholder="Reason..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonDialog(null)}>Cancel</Button>
            <Button
              variant={reasonDialog?.type === "reject" ? "destructive" : "default"}
              onClick={handleReasonSubmit}
              disabled={!reason.trim() || actionLoading}
            >
              {actionLoading ? "..." : reasonDialog?.type === "reject" ? "Reject" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
