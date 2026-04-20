/**
 * MigrationGate — Phase 3 escalation guard.
 *
 * Wrap money-OUT actions (withdraw, payout request) and NEW paid-creation
 * actions (publish paid event, accept booking deposit, launch contribution)
 * with this component. When the current user is in the "restrict" phase of
 * the migration flow, the wrapped action is replaced with a non-clickable
 * card pointing them to Settings → Payments.
 *
 * Usage:
 *   <MigrationGate action="withdraw">
 *     <WithdrawButton />
 *   </MigrationGate>
 *
 * Or render-prop style for inline disable:
 *   <MigrationGate action="publish_event">
 *     {({ blocked, onBlocked }) => (
 *       <Button disabled={blocked} onClick={blocked ? onBlocked : handlePublish}>
 *         Publish
 *       </Button>
 *     )}
 *   </MigrationGate>
 */
import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMigrationStatus } from "@/hooks/useMigrationStatus";

export type GatedAction =
  | "withdraw"
  | "publish_event"
  | "launch_contribution"
  | "accept_booking"
  | "ticket_settlement";

const ACTION_COPY: Record<GatedAction, string> = {
  withdraw: "Set up payments before withdrawing earnings.",
  publish_event: "Complete payment setup before publishing a new paid event.",
  launch_contribution: "Set up payments to launch a new contribution campaign.",
  accept_booking: "Complete payment setup to accept new paid bookings.",
  ticket_settlement: "Payment setup is required to continue ticket settlements.",
};

interface RenderProps {
  blocked: boolean;
  onBlocked: () => void;
}

interface Props {
  action: GatedAction;
  children: ReactNode | ((props: RenderProps) => ReactNode);
  /** When true, render a full replacement card instead of just disabling. */
  replace?: boolean;
}

const MigrationGate = ({ action, children, replace = false }: Props) => {
  const navigate = useNavigate();
  const { isRestricted } = useMigrationStatus();

  const onBlocked = () => {
    toast.error("Payment setup required", {
      description: ACTION_COPY[action],
      action: {
        label: "Setup",
        onClick: () => navigate("/settings/payments"),
      },
    });
  };

  if (typeof children === "function") {
    return <>{(children as (p: RenderProps) => ReactNode)({ blocked: isRestricted, onBlocked })}</>;
  }

  if (!isRestricted) return <>{children}</>;

  if (replace) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center">
        <div className="mx-auto h-10 w-10 rounded-full bg-destructive/15 text-destructive flex items-center justify-center mb-3">
          <Lock className="h-5 w-5" />
        </div>
        <p className="text-sm font-semibold text-foreground">Payment setup required</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">{ACTION_COPY[action]}</p>
        <Button size="sm" className="mt-4" onClick={() => navigate("/settings/payments")}>
          Setup now <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </div>
    );
  }

  // Default: render children inside a click-intercepting wrapper so the
  // existing button stays visible but unclickable.
  return (
    <div
      className="relative inline-block opacity-60 cursor-not-allowed"
      onClickCapture={(e) => { e.stopPropagation(); e.preventDefault(); onBlocked(); }}
      title="Payment setup required"
    >
      <div className="pointer-events-none">{children}</div>
    </div>
  );
};

export default MigrationGate;
