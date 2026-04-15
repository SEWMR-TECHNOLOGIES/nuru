import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft, Loader2, Send, Clock, CheckCircle, XCircle, AlertCircle,
  User, MessageSquare, Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/api/admin";
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

export default function AdminIssueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useAdminMeta("Issue Detail");

  const [issue, setIssue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const res = await adminApi.getIssueDetail(id);
    if (res.success && res.data) {
      setIssue(res.data);
    } else {
      toast.error("Issue not found");
      navigate("/admin/issues");
    }
    setLoading(false);
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleReply = async () => {
    if (!id || !replyText.trim()) return;
    setReplying(true);
    const res = await adminApi.replyToIssue(id, replyText.trim());
    if (res.success) {
      toast.success("Reply sent & user notified");
      setReplyText("");
      load();
    } else {
      toast.error(res.message || "Failed");
    }
    setReplying(false);
  };

  const handleStatusChange = async (status: string) => {
    if (!id) return;
    setUpdatingStatus(true);
    const res = await adminApi.updateIssueStatus(id, status);
    if (res.success) {
      toast.success(`Status updated to ${status}`);
      load();
    } else {
      toast.error(res.message || "Failed");
    }
    setUpdatingStatus(false);
  };

  const handlePriorityChange = async (priority: string) => {
    if (!id) return;
    setUpdatingPriority(true);
    const res = await adminApi.updateIssuePriority(id, priority);
    if (res.success) {
      toast.success(`Priority updated to ${priority}`);
      load();
    } else {
      toast.error(res.message || "Failed");
    }
    setUpdatingPriority(false);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const formatTime = (d: string) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!issue) return null;

  const st = statusConfig[issue.status] || statusConfig.open;
  const pr = priorityConfig[issue.priority] || priorityConfig.medium;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/issues")}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Issues
        </Button>
      </div>

      {/* Issue Header */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground">{issue.subject}</h2>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                <User className="w-3.5 h-3.5" />
                <span>{issue.user?.name}</span>
                {issue.user?.username && <span className="text-muted-foreground/60">@{issue.user.username}</span>}
                {issue.user?.email && <span className="text-muted-foreground/60">• {issue.user.email}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="outline" className={cn("text-xs", st.color)}>
                  <st.icon className="w-3 h-3 mr-1" />{st.label}
                </Badge>
                <Badge variant="outline" className={cn("text-xs", pr.color)}>{pr.label}</Badge>
                {issue.category && <Badge variant="outline" className="text-xs">{issue.category.name}</Badge>}
              </div>
            </div>
            <div className="text-right shrink-0 text-xs text-muted-foreground">
              <p>{formatDate(issue.created_at)}</p>
              <p>{formatTime(issue.created_at)}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Status</p>
              <Select value={issue.status} onValueChange={handleStatusChange} disabled={updatingStatus}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Priority</p>
              <Select value={issue.priority} onValueChange={handlePriorityChange} disabled={updatingPriority}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="bg-muted/40 rounded-lg p-4">
            <p className="text-sm whitespace-pre-wrap">{issue.description}</p>
          </div>

          {/* Screenshots */}
          {(issue.screenshot_urls || []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {issue.screenshot_urls.map((url: string, i: number) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt={`Screenshot ${i + 1}`} className="w-28 h-28 object-cover rounded-lg border border-border hover:opacity-80 transition" />
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Responses */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Responses ({(issue.responses || []).length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(issue.responses || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No responses yet</p>
          ) : (
            (issue.responses || []).map((r: any) => (
              <div key={r.id} className={cn("rounded-lg p-3 text-sm", r.is_admin ? "bg-primary/5 border border-primary/10" : "bg-muted/40")}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-medium text-xs">{r.is_admin ? (r.admin_name || "Admin") : "User"}</span>
                  {r.is_admin && <Badge variant="outline" className="text-[10px] h-4 bg-primary/10 text-primary border-primary/20">Staff</Badge>}
                  <span className="text-xs text-muted-foreground ml-auto">{formatDate(r.created_at)} {formatTime(r.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap">{r.message}</p>
              </div>
            ))
          )}

          {/* Admin Reply */}
          <div className="flex gap-2 pt-2 border-t border-border">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your response to the user..."
              rows={3}
              className="flex-1 resize-none text-sm"
              maxLength={5000}
            />
            <Button size="sm" onClick={handleReply} disabled={replying || !replyText.trim()} className="self-end">
              {replying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
