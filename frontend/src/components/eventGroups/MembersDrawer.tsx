/**
 * Members drawer — list members, copy invite link, sync members.
 */
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, RefreshCw, Link2, UserPlus } from "lucide-react";
import { eventGroupsApi } from "@/lib/api/eventGroups";
import { toast } from "sonner";

const initials = (n: string) => (n || "?").trim().split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase();

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string;
  isAdmin?: boolean;
}

const MembersDrawer = ({ open, onOpenChange, groupId, isAdmin }: Props) => {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await eventGroupsApi.members(groupId);
    if (res.success && res.data) setMembers(res.data.members || []);
    setLoading(false);
  };

  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open, groupId]);

  const sync = async () => {
    setSyncing(true);
    const res = await eventGroupsApi.syncMembers(groupId);
    setSyncing(false);
    if (res.success) { toast.success("Members synced"); load(); }
    else toast.error(res.message || "Sync failed");
  };

  const copyInvite = async (m: any) => {
    const res = await eventGroupsApi.createInvite(groupId, {
      contributor_id: m.contributor_id || undefined,
      phone: m.guest_phone || undefined,
      name: m.display_name,
    });
    if (res.success && res.data) {
      const url = `${window.location.origin}/g/${res.data.token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied");
    } else toast.error(res.message || "Could not create invite");
  };

  const filtered = members.filter(m => !search || (m.display_name || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center justify-between">
            <span>Members ({members.length})</span>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={sync} disabled={syncing}>
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} /> Sync
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>
        <div className="p-3 border-b border-border">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members…" className="h-9" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-3 space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((m) => (
                <div key={m.id} className="p-3 flex items-center gap-3">
                  <Avatar className="w-9 h-9">
                    {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials(m.display_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{m.display_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[9px] capitalize">{m.role}</Badge>
                      {m.is_admin && <Badge className="text-[9px] bg-primary/15 text-primary border-0">admin</Badge>}
                      {!m.user_id && <Badge variant="outline" className="text-[9px]">guest</Badge>}
                    </div>
                  </div>
                  {isAdmin && (
                    <Button size="icon" variant="ghost" className="shrink-0" onClick={() => copyInvite(m)} title="Copy invite link">
                      <Link2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="p-10 text-center text-muted-foreground text-sm">
                  <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No members match.
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MembersDrawer;
