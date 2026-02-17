import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminApi } from "@/lib/api/admin";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { toast } from "sonner";

export default function AdminNotifications() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) { toast.error("Title and message are required"); return; }
    const ok = await confirm({
      title: "Send Broadcast Notification?",
      description: `This will send "${title}" to ALL active Nuru users. This cannot be undone.`,
      confirmLabel: "Send to All Users",
      destructive: true,
    });
    if (!ok) return;
    setSending(true);
    const res = await adminApi.broadcastNotification(title.trim(), message.trim());
    if (res.success) {
      toast.success(res.message || "Notification sent!");
      setTitle("");
      setMessage("");
    } else toast.error(res.message || "Failed to send notification");
    setSending(false);
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog />
      <div>
        <h2 className="text-xl font-bold text-foreground">Broadcast Notification</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Send a system notification to all active Nuru users</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <form onSubmit={handleBroadcast} className="space-y-5">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Platform maintenance scheduled" maxLength={100} />
            <p className="text-xs text-muted-foreground">{title.length}/100 characters</p>
          </div>
          <div className="space-y-1.5">
            <Label>Message *</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Write the notification content here..." maxLength={500} />
            <p className="text-xs text-muted-foreground">{message.length}/500 characters</p>
          </div>
          <div className="bg-muted border border-border rounded-lg p-3 text-sm text-muted-foreground">
            ⚠️ This notification will be sent to <strong>all active users</strong>. Use this for important platform announcements only.
          </div>
          <Button type="submit" disabled={sending || !title.trim() || !message.trim()} className="w-full">
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Send to All Users
          </Button>
        </form>
      </div>
    </div>
  );
}
