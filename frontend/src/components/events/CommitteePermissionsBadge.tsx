/**
 * Shows committee member permissions in a nice hover card instead of "3 permissions"
 */
import { Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

interface CommitteePermissionsBadgeProps {
  permissions: string[] | Record<string, boolean>;
}

const PERMISSION_LABELS: Record<string, string> = {
  manage_guests: "Manage Guests",
  send_invitations: "Send Invitations",
  checkin_guests: "Check-in Guests",
  view_contributions: "View Contributions",
  manage_contributions: "Manage Contributions",
  manage_budget: "Manage Budget",
  manage_schedule: "Manage Schedule",
  manage_vendors: "Manage Vendors",
  edit_event: "Edit Event Details",
  // Backend-style boolean keys
  can_view_guests: "View Guests",
  can_manage_guests: "Manage Guests",
  can_send_invitations: "Send Invitations",
  can_check_in_guests: "Check-in Guests",
  can_view_budget: "View Budget",
  can_manage_budget: "Manage Budget",
  can_view_contributions: "View Contributions",
  can_manage_contributions: "Manage Contributions",
  can_view_vendors: "View Vendors",
  can_manage_vendors: "Manage Vendors",
  can_approve_bookings: "Approve Bookings",
  can_edit_event: "Edit Event",
  can_manage_committee: "Manage Committee",
};

const CommitteePermissionsBadge = ({ permissions }: CommitteePermissionsBadgeProps) => {
  // Normalize: could be string[] or Record<string, boolean>
  let activePermissions: string[] = [];

  if (Array.isArray(permissions)) {
    activePermissions = permissions;
  } else if (typeof permissions === "object" && permissions !== null) {
    activePermissions = Object.entries(permissions)
      .filter(([, value]) => value === true)
      .map(([key]) => key);
  }

  const count = activePermissions.length;

  if (count === 0) {
    return (
      <div className="flex items-center gap-1 text-muted-foreground">
        <Shield className="w-3 h-3" />
        <span className="text-xs">No permissions</span>
      </div>
    );
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          <Shield className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{count} permission{count !== 1 ? "s" : ""}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-64 p-3" align="end">
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Permissions</p>
        <div className="flex flex-wrap gap-1.5">
          {activePermissions.map((perm) => (
            <Badge
              key={perm}
              variant="secondary"
              className="text-[11px] px-2 py-0.5 font-normal"
            >
              {PERMISSION_LABELS[perm] || perm.replace(/_/g, " ").replace(/^can /, "")}
            </Badge>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default CommitteePermissionsBadge;
