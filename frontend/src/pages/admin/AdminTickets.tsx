import { useEffect, useState, useCallback, useRef } from "react";
import { useAdminMeta } from "@/hooks/useAdminMeta";
import { useLocation } from "react-router-dom";
import { HeadphonesIcon, Eye, RefreshCw, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AdminTableSkeleton } from "@/components/ui/AdminTableSkeleton";
import { adminApi } from "@/lib/api/admin";
import { adminCaches } from "@/lib/api/adminCache";
import { usePolling } from "@/hooks/usePolling";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusTabs = [
  { label: "All", value: "" },
  { label: "Open", value: "open" },
  { label: "Closed", value: "closed" },
];

const priorityBadge = (p: string) => {
  if (p === "high") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  if (p === "medium") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
};

export default function AdminTickets() {
  useAdminMeta("Support Tickets");
  const location = useLocation();
  const sp = new URLSearchParams(location.search);
  const cache = adminCaches.tickets;
  const [status, setStatus] = useState(sp.get("status") || "open");
  const [tickets, setTickets] = useState<any[]>(cache.data);
  const [loading, setLoading] = useState(!cache.loaded);
  const initialLoad = useRef(!cache.loaded);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Record<string, any> | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  const load = useCallback(async () => {
    if (initialLoad.current) setLoading(true);
    const res = await adminApi.getTickets({ status: status || undefined, page, limit: 20 });
    if (res.success) {
      const data = Array.isArray(res.data) ? res.data : [];
      cache.set(data);
      setTickets(data);
      setPagination((res as any).pagination ?? null);
    } else if (initialLoad.current) toast.error("Failed to load tickets");
    setLoading(false);
    initialLoad.current = false;
  }, [status, page]);

  useEffect(() => {
    initialLoad.current = true;
    load();
  }, [load]);
  usePolling(load);

  const openTicket = async (id: string) => {
    const res = await adminApi.getTicketDetail(id);
    if (res.success) setSelected(res.data);
    else toast.error("Failed to load ticket");
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selected) return;
    setReplying(true);
    const res = await adminApi.replyToTicket(selected.id, replyText);
    if (res.success) { toast.success("Reply sent"); setReplyText(""); openTicket(selected.id); }
    else toast.error(res.message || "Failed to send reply");
    setReplying(false);
  };

  const closeTicket = async (id: string) => {
    const res = await adminApi.closeTicket(id);
    if (res.success) { toast.success("Ticket closed"); setSelected(null); load(); }
    else toast.error("Failed to close ticket");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Support Tickets</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage and respond to user support requests</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
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
        <AdminTableSkeleton columns={6} rows={8} />
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><HeadphonesIcon className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No tickets found</p></div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Subject</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Updated</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground max-w-xs truncate">{t.subject}</td>
                  <td className="px-4 py-3"><div>{t.user?.name || "—"}</div><div className="text-xs text-muted-foreground">{t.user?.email}</div></td>
                  <td className="px-4 py-3"><span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", priorityBadge(t.priority))}>{t.priority}</span></td>
                  <td className="px-4 py-3"><span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", t.status === "open" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{t.status}</span></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{t.updated_at ? new Date(t.updated_at).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" onClick={() => openTicket(t.id)}>
                      <Eye className="w-3.5 h-3.5 mr-1" /> View
                    </Button>
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

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => { setSelected(null); setReplyText(""); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="truncate">{selected?.subject}</DialogTitle>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground">From: {selected?.user?.name} ({selected?.user?.email})</span>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize ml-auto", selected?.status === "open" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{selected?.status}</span>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 py-2 min-h-0">
            {(selected?.messages || []).map((m: any) => (
              <div key={m.id} className={cn("flex", m.is_agent ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] px-4 py-2.5 rounded-xl text-sm", m.is_agent ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                  <p className="text-xs font-semibold mb-1 opacity-70">{m.sender_name}</p>
                  <p className="break-words">{m.content}</p>
                  <p className="text-xs mt-1 opacity-60">{m.created_at ? new Date(m.created_at).toLocaleString() : ""}</p>
                </div>
              </div>
            ))}
          </div>
          {selected?.status === "open" && (
            <div className="shrink-0 pt-3 border-t border-border space-y-2">
              <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} placeholder="Type your reply as support agent..." />
              <div className="flex gap-2">
                <Button onClick={sendReply} disabled={replying || !replyText.trim()} className="flex-1">
                  {replying ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <MessageSquare className="w-4 h-4 mr-1.5" />}
                  Send Reply
                </Button>
                <Button variant="outline" onClick={() => closeTicket(selected.id)}>Close Ticket</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
