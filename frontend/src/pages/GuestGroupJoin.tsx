/**
 * Guest invite landing page — `/g/:token`.
 * Lets non-Nuru contributors claim an invite to an event group:
 *   1. Fetch invite preview (group + prefilled name/phone).
 *   2. POST claim → store guest JWT in localStorage.
 *   3. Redirect into the workspace.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageSquare, ShieldCheck, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { eventGroupsApi } from "@/lib/api/eventGroups";
import { toast } from "sonner";

const initials = (n: string) => (n || "?").trim().split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase();

const GuestGroupJoin = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<any>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    eventGroupsApi.previewInvite(token).then((res) => {
      if (res.success && res.data) {
        setData(res.data);
        setName(res.data.prefill?.name || "");
        setPhone(res.data.prefill?.phone || "");
      } else {
        setError(res.message || "Invalid or expired invite link.");
      }
      setLoading(false);
    });
  }, [token]);

  const join = async () => {
    if (!token || !name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    setSubmitting(true);
    const res = await eventGroupsApi.claimInvite(token, { name: name.trim(), phone: phone.trim() || undefined });
    setSubmitting(false);
    if (res.success && res.data) {
      if (res.data.guest_token) {
        localStorage.setItem("eg_guest_token", res.data.guest_token);
      }
      toast.success("Welcome! 🎉");
      navigate(`/event-group/${res.data.group_id}`, { replace: true });
    } else {
      toast.error(res.message || "Could not join");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-8 text-center">
            <p className="text-destructive font-semibold mb-2">Invite unavailable</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => navigate("/")}>Go home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-muted/30 p-4">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card className="overflow-hidden border-primary/10 shadow-xl">
          <div className="h-24 bg-gradient-to-br from-primary to-primary/60 relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,white,transparent_60%)] opacity-20" />
          </div>
          <div className="px-6 -mt-10">
            <Avatar className="w-20 h-20 ring-4 ring-background shadow-lg">
              {data.group?.image_url && <AvatarImage src={data.group.image_url} />}
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                {initials(data.group?.name || "")}
              </AvatarFallback>
            </Avatar>
          </div>
          <CardContent className="px-6 pt-3 pb-6 space-y-5">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">You're invited to</p>
              <h1 className="text-xl font-bold mt-1">{data.group?.name}</h1>
              {data.group?.event_name && (
                <p className="text-sm text-muted-foreground">for {data.group.event_name}</p>
              )}
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>Join the group chat & live scoreboard. No account needed — your link gives you secure access to this group only.</span>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="name">Your name *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="e.g. John Doe" />
              </div>
              <div>
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" placeholder="+255…" />
              </div>
            </div>

            <Button onClick={join} disabled={submitting || !name.trim()} className="w-full" size="lg">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageSquare className="w-4 h-4 mr-2" />}
              Join group
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default GuestGroupJoin;
