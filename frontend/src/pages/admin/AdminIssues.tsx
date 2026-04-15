import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, Plus, Pencil, Trash2, Loader2, Tag,
  ChevronRight, Clock, CheckCircle, XCircle, Search,
  MessageSquare, Send, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/api/admin";
import { adminCaches } from "@/lib/api/adminCache";
import { usePolling } from "@/hooks/usePolling";
import { useAdminMeta } from "@/hooks/useAdminMeta";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: "Open", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: AlertCircle },
  in_progress: { label: "In Progress", color: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: Clock },
  resolved: { label: "Resolved", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCircle },
  closed: { label: "Closed", color: "bg-muted text-muted-foreground border-border", icon: XCircle },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-muted text-muted-foreground" },
  medium: { label: "Medium", color: "bg-blue-500/10 text-blue-600" },
  high: { label: "High", color: "bg-orange-500/10 text-orange-600" },
  critical: { label: "Critical", color: "bg-red-500/10 text-red-600" },
};

export default function AdminIssues() {
  useAdminMeta("Issues");
  const navigate = useNavigate();
  const cache = adminCaches.issues;
  const [issues, setIssues] = useState<any[]>(cache.data);
  const [summary, setSummary] = useState<any>({ total: 0, open: 0, in_progress: 0, resolved: 0 });
  const [loading, setLoading] = useState(!cache.loaded);
  const initialLoad = useRef(!cache.loaded);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (initialLoad.current) setLoading(true);
    const params: any = { limit: 100 };
    if (filterStatus) params.status = filterStatus;
    if (search) params.q = search;
    const res = await adminApi.getIssues(params);
    if (res.success && res.data) {
      const data = res.data;
      const issuesList = data.issues || [];
      cache.set(issuesList);
      setIssues(issuesList);
      setSummary(data.summary || { total: 0, open: 0, in_progress: 0, resolved: 0 });
    } else if (initialLoad.current) {
      toast.error("Failed to load issues");
    }
    setLoading(false);
    initialLoad.current = false;
  }, [filterStatus, search]);

  useEffect(() => {
    if (!cache.loaded) initialLoad.current = true;
    load();
  }, [load]);
  usePolling(load);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Issues</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Review and manage user-submitted issues</p>
        </div>
        <Button size="sm" onClick={() => navigate("/admin/issue-categories")}>
          <Tag className="w-4 h-4 mr-1.5" /> Categories
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: summary.total, color: "text-foreground", filter: "" },
          { label: "Open", value: summary.open, color: "text-blue-600", filter: "open" },
          { label: "In Progress", value: summary.in_progress, color: "text-amber-600", filter: "in_progress" },
          { label: "Resolved", value: summary.resolved, color: "text-green-600", filter: "resolved" },
        ].map((s) => (
          <Card
            key={s.label}
            className={cn("cursor-pointer hover:shadow-sm transition", filterStatus === s.filter && "ring-2 ring-primary")}
            onClick={() => setFilterStatus(s.filter)}
          >
            <CardContent className="p-3 text-center">
              <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues..."
            className="pl-9"
          />
        </div>
        <Select value={filterStatus || "all"} onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : issues.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No issues found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map((issue) => {
            const st = statusConfig[issue.status] || statusConfig.open;
            const pr = priorityConfig[issue.priority] || priorityConfig.medium;
            return (
              <div
                key={issue.id}
                className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:shadow-sm transition"
                onClick={() => navigate(`/admin/issues/${issue.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground line-clamp-1">{issue.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{issue.description}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <Badge variant="outline" className={cn("text-[10px] h-5", st.color)}>
                        <st.icon className="w-3 h-3 mr-0.5" />{st.label}
                      </Badge>
                      <Badge variant="outline" className={cn("text-[10px] h-5", pr.color)}>{pr.label}</Badge>
                      {issue.category && (
                        <span className="text-[10px] text-muted-foreground">• {issue.category.name}</span>
                      )}
                      {issue.user && (
                        <span className="text-[10px] text-muted-foreground">• by {issue.user.name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {issue.response_count > 0 && (
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{issue.response_count}</span>
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground">{new Date(issue.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
