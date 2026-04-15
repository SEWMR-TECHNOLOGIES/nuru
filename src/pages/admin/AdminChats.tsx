import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { MessageSquare, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/api/admin";
import { adminCaches } from "@/lib/api/adminCache";
import { usePolling } from "@/hooks/usePolling";
import { useAdminMeta } from "@/hooks/useAdminMeta";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getTimeAgo } from "@/utils/getTimeAgo";

const statusTabs = [
  { label: "All", value: "" },
  { label: "Waiting", value: "waiting" },
  { label: "Active", value: "active" },
  { label: "Ended", value: "ended" },
];

const statusBadge = (status: string) => {
  if (status === "waiting") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  if (status === "active") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (status === "ended") return "bg-muted text-muted-foreground";
  return "bg-muted text-muted-foreground";
};

function ChatSkeleton() {
  return (
    <div className="flex items-center gap-4 bg-card border border-border rounded-xl p-4">
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-64" />
      </div>
      <Skeleton className="h-3 w-12" />
    </div>
  );
}

export default function AdminChats() {
  useAdminMeta("Live Chats");
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const cache = adminCaches.chats;
  const [chats, setChats] = useState<any[]>(cache.data);
  const [loading, setLoading] = useState(!cache.loaded);
  const initialLoad = useRef(!cache.loaded);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Record<string, any> | null>(adminCaches.pagination["chats"] ?? null);

  const load = useCallback(async () => {
    if (initialLoad.current) setLoading(true);
    const res = await adminApi.getChats({ status: status || undefined, page, limit: 20 });
    if (res.success) {
      const data = Array.isArray(res.data) ? res.data : [];
      cache.set(data);
      adminCaches.pagination["chats"] = (res as any).pagination ?? null;
      setChats(data);
      setPagination((res as any).pagination ?? null);
    } else if (initialLoad.current) toast.error("Failed to load chats");
    setLoading(false);
    initialLoad.current = false;
  }, [status, page]);

  useEffect(() => {
    initialLoad.current = true;
    load();
  }, [load]);
  usePolling(load, 10000);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Live Chats</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Monitor and respond to user chat sessions</p>
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
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <ChatSkeleton key={i} />)}</div>
      ) : chats.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No chats found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => (
            <Link key={chat.id} to={`/admin/chats/${chat.id}`}
              className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all group">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                {chat.user?.avatar ? (
                  <img src={chat.user.avatar} alt={chat.user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-semibold text-primary">
                    {chat.user?.name?.charAt(0)?.toUpperCase() || "?"}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground truncate">{chat.user?.name || "Unknown User"}</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", statusBadge(chat.status))}>{chat.status}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{chat.last_message || "No messages yet"}</p>
              </div>
              <div className="text-xs text-muted-foreground shrink-0">
                {chat.last_message_at
                  ? getTimeAgo(chat.last_message_at)
                  : chat.created_at
                    ? getTimeAgo(chat.created_at)
                    : ""}
              </div>
            </Link>
          ))}
        </div>
      )}

      {pagination && pagination.total_pages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm text-muted-foreground">Page {page} of {pagination.total_pages}</span>
          <Button variant="outline" size="icon" onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.total_pages}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
}
