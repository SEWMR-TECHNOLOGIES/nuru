import { useEffect, useState, useCallback, useRef } from "react";
import { CalendarDays, Search, ChevronLeft, ChevronRight, Edit2, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminTableSkeleton } from "@/components/ui/AdminTableSkeleton";
import { adminApi } from "@/lib/api/admin";
import { adminCaches } from "@/lib/api/adminCache";
import { usePolling } from "@/hooks/usePolling";
import { useAdminMeta } from "@/hooks/useAdminMeta";
import { toast } from "sonner";
import { cn } from "@/lib/utils";


const statusTabs = [
  { label: "All", value: "" },
  { label: "Draft", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

const EVENT_STATUSES = ["draft", "published", "confirmed", "completed", "cancelled"];

const statusBadge = (s: string) => {
  if (s === "published") return "bg-primary/10 text-primary";
  if (s === "confirmed") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  if (s === "completed") return "bg-muted text-muted-foreground";
  if (s === "cancelled") return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
};

export default function AdminEvents() {
  useAdminMeta("Events");
  const navigate = useNavigate();
  const cache = adminCaches.events;
  const [events, setEvents] = useState<any[]>(cache.data);
  const [loading, setLoading] = useState(!cache.loaded);
  const initialLoad = useRef(!cache.loaded);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Record<string, any> | null>(adminCaches.pagination["events"] ?? null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [statusDialog, setStatusDialog] = useState<{ id: string; name: string; current: string } | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const load = useCallback(async () => {
    if (initialLoad.current) setLoading(true);
    const res = await adminApi.getEvents({ page, limit: 20, q: q || undefined, status: status || undefined });
    if (res.success) {
      const data = Array.isArray(res.data) ? res.data : [];
      cache.set(data);
      adminCaches.pagination["events"] = (res as any).pagination ?? null;
      setEvents(data);
      setPagination((res as any).pagination ?? null);
    } else if (initialLoad.current) toast.error("Failed to load events");
    setLoading(false);
    initialLoad.current = false;
  }, [page, q, status]);

  useEffect(() => {
    initialLoad.current = true;
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load]);
  usePolling(load);


  const handleStatusUpdate = async () => {
    if (!statusDialog || !newStatus) return;
    setUpdatingStatus(true);
    const res = await adminApi.updateEventStatus(statusDialog.id, newStatus);
    if (res.success) {
      toast.success("Event status updated");
      setStatusDialog(null);
      setNewStatus("");
      load();
    } else toast.error(res.message || "Failed to update status");
    setUpdatingStatus(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Events</h2>
        <p className="text-sm text-muted-foreground mt-0.5">View and manage all events created on Nuru</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search events..." className="pl-9" />
        </div>
        <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit flex-wrap">
          {statusTabs.map((tab) => (
            <button key={tab.value} onClick={() => { setStatus(tab.value); setPage(1); }}
              className={cn("px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors", status === tab.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <AdminTableSkeleton columns={6} rows={8} />
      ) : events.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No events found</p></div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Event Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Organizer</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Location</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted shrink-0 overflow-hidden">
                        {e.image ? (
                          <img src={e.image} alt={e.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                            {e.name?.charAt(0)?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className="font-medium text-foreground max-w-[160px] truncate">{e.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{e.organizer?.name || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{e.date ? new Date(e.date).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[150px] truncate">{e.location || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", statusBadge(e.status))}>{e.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/events/${e.id}`)} title="View details">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm"
                        onClick={() => { setStatusDialog({ id: e.id, name: e.name, current: e.status }); setNewStatus(e.status); }}>
                        <Edit2 className="w-3.5 h-3.5 mr-1" /> Status
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

      {/* Status Update Dialog */}
      <Dialog open={!!statusDialog} onOpenChange={() => { setStatusDialog(null); setNewStatus(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Event Status</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">{statusDialog?.name}</p>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                {EVENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="capitalize">{s}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setStatusDialog(null); setNewStatus(""); }}>Cancel</Button>
            <Button onClick={handleStatusUpdate} disabled={updatingStatus || !newStatus || newStatus === statusDialog?.current}>
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
