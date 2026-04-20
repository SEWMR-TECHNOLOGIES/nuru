/**
 * Event Group CTA — shown on the Event Management Overview tab.
 * If a group exists, "Open Group Chat". Otherwise, "Create Group Chat".
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Users, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { eventGroupsApi } from "@/lib/api/eventGroups";

interface Props {
  eventId: string;
  onOpen: () => void;
  opening: boolean;
}

const EventGroupCta = ({ eventId, onOpen, opening }: Props) => {
  const navigate = useNavigate();
  const [group, setGroup] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    setLoading(true);
    eventGroupsApi.getForEvent(eventId).then((res) => {
      if (cancelled) return;
      if (res.success && res.data?.id) setGroup(res.data);
      else setGroup(null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [eventId, opening]);

  if (loading) return null;

  if (group) {
    return (
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <MessageSquare className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Group Chat</p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              {group.member_count || 0} members
              {typeof group.unread_count === "number" && group.unread_count > 0 && (
                <span className="text-primary font-semibold">· {group.unread_count} unread</span>
              )}
            </p>
          </div>
          <Button onClick={() => navigate(`/event-group/${group.id}`)} className="shrink-0">
            Open Group <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
      <CardContent className="p-5 flex items-start gap-4 flex-col sm:flex-row sm:items-center">
        <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <MessageSquare className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Create the Group Chat</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Private chat for your organizer team, committee and contributors — with a live contribution scoreboard.
          </p>
        </div>
        <Button onClick={onOpen} disabled={opening} className="shrink-0">
          {opening ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <MessageSquare className="w-4 h-4 mr-1" />}
          {opening ? "Creating…" : "Create Group Chat"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default EventGroupCta;
