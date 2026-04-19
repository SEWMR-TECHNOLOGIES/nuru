/**
 * MyContributionsTab — premium card list of every event the logged-in user
 * is listed as a contributor on, with a Pay button per card that opens
 * SelfContributeDialog.
 */
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import SearchHeader from "@/components/ui/search-header";
import {
  HandCoins,
  CalendarDays,
  MapPin,
  HourglassIcon,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMyContributions } from "@/data/useMyContributions";
import SelfContributeDialog from "@/components/contributions/SelfContributeDialog";
import { formatPrice } from "@/utils/formatPrice";
import type { MyContributionEvent } from "@/lib/api/contributors";

const formatDate = (iso?: string | null) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
};

const MyContributionsTab = () => {
  const [search, setSearch] = useState("");
  const { events, loading, error, refetch } = useMyContributions(search);
  const navigate = useNavigate();
  const [payTarget, setPayTarget] = useState<MyContributionEvent | null>(null);

  const summary = useMemo(() => {
    const totalPledged = events.reduce((s, e) => s + (e.pledge_amount || 0), 0);
    const totalPaid = events.reduce((s, e) => s + (e.total_paid || 0), 0);
    const totalPending = events.reduce((s, e) => s + (e.pending_amount || 0), 0);
    const totalBalance = events.reduce((s, e) => s + (e.balance || 0), 0);
    return { totalPledged, totalPaid, totalPending, totalBalance, count: events.length };
  }, [events]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-44 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 text-center space-y-3 border-destructive/20">
        <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Try again
        </Button>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <SearchHeader
            value={search}
            onChange={setSearch}
            placeholder="Search events, organisers, locations…"
          />
        </div>
        <Card className="p-12 text-center space-y-4 border-dashed">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <HandCoins className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">
              {search ? "No matches" : "No contributions yet"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {search
                ? `Nothing matched "${search}". Try a different name or location.`
                : "When an organiser adds you as a contributor to their event, it will appear here so you can pay your pledge in one tap."}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <SearchHeader
          value={search}
          onChange={setSearch}
          placeholder="Search events, organisers, locations…"
        />
      </div>
      {/* ── Summary tiles ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryTile
          label="Events"
          value={String(summary.count)}
          icon={<CalendarDays className="w-4 h-4" />}
          tone="primary"
        />
        <SummaryTile
          label="Total Pledged"
          value={formatPrice(summary.totalPledged)}
          icon={<HandCoins className="w-4 h-4" />}
          tone="muted"
        />
        <SummaryTile
          label="Paid"
          value={formatPrice(summary.totalPaid)}
          icon={<CheckCircle2 className="w-4 h-4" />}
          tone="success"
        />
        <SummaryTile
          label="Outstanding"
          value={formatPrice(summary.totalBalance)}
          icon={<HourglassIcon className="w-4 h-4" />}
          tone="warning"
        />
      </div>

      {/* ── Cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {events.map((ev) => (
          <ContributionCard
            key={ev.event_id + ev.event_contributor_id}
            ev={ev}
            onPay={() => setPayTarget(ev)}
            onOpenEvent={() => navigate(`/event/${ev.event_id}`)}
          />
        ))}
      </div>

      {payTarget && (
        <SelfContributeDialog
          open={!!payTarget}
          onOpenChange={(v) => !v && setPayTarget(null)}
          eventId={payTarget.event_id}
          eventName={payTarget.event_name}
          currency={payTarget.currency}
          balance={payTarget.balance}
          onSubmitted={refetch}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const SummaryTile = ({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "primary" | "success" | "warning" | "muted";
}) => {
  const tones: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    success: "text-green-600 bg-green-100 dark:bg-green-900/30",
    warning: "text-amber-600 bg-amber-100 dark:bg-amber-900/30",
    muted: "text-foreground bg-muted",
  };
  return (
    <Card className="p-3 border-border/60">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          {icon}
        </div>
      </div>
      <p className="text-lg font-bold mt-1 truncate">{value}</p>
    </Card>
  );
};

const ContributionCard = ({
  ev,
  onPay,
  onOpenEvent,
}: {
  ev: MyContributionEvent;
  onPay: () => void;
  onOpenEvent: () => void;
}) => {
  const pledge = ev.pledge_amount || 0;
  const paid = ev.total_paid || 0;
  const pending = ev.pending_amount || 0;
  const balance = ev.balance || 0;
  const pct = pledge > 0 ? Math.min(100, Math.round((paid / pledge) * 100)) : 0;
  const isComplete = pledge > 0 && balance === 0 && pending === 0;
  const date = formatDate(ev.event_start_date);

  return (
    <Card className="overflow-hidden border-border/60 shadow-sm hover:shadow-md transition-shadow group">
      {/* Cover */}
      <div
        className="relative h-28 bg-gradient-to-br from-primary/30 via-primary/10 to-accent/20 cursor-pointer overflow-hidden"
        onClick={onOpenEvent}
      >
        {ev.event_cover_image_url && (
          <img
            src={ev.event_cover_image_url}
            alt={ev.event_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute bottom-2 left-3 right-3">
          <h3 className="text-white font-semibold text-base leading-tight line-clamp-1 drop-shadow">
            {ev.event_name}
          </h3>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-white/85">
            {date && (
              <span className="flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                {date}
              </span>
            )}
            {ev.event_location && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3" />
                <span className="truncate max-w-[140px]">{ev.event_location}</span>
              </span>
            )}
          </div>
        </div>
        {isComplete && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-green-600 text-white border-0 gap-1">
              <CheckCircle2 className="w-3 h-3" /> Complete
            </Badge>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Numbers */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Pledged" value={`${ev.currency} ${formatPrice(pledge)}`} />
          <Stat label="Paid" value={`${ev.currency} ${formatPrice(paid)}`} tone="success" />
          <Stat label="Balance" value={`${ev.currency} ${formatPrice(balance)}`} tone={balance > 0 ? "warning" : "muted"} />
        </div>

        {/* Progress */}
        {pledge > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{pct}% complete</span>
              {pending > 0 && (
                <span className="text-amber-600 font-medium">
                  {ev.currency} {formatPrice(pending)} pending
                </span>
              )}
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
        )}

        {ev.organizer_name && (
          <p className="text-[11px] text-muted-foreground">
            Organised by <span className="font-medium text-foreground">{ev.organizer_name}</span>
          </p>
        )}

        {/* CTA */}
        <Button
          className="w-full gap-2 h-9"
          onClick={onPay}
          disabled={isComplete}
          variant={isComplete ? "outline" : "default"}
        >
          <HandCoins className="w-4 h-4" />
          {isComplete ? "Fully paid" : balance > 0 ? `Pay ${ev.currency} ${formatPrice(balance)}` : "Make a contribution"}
        </Button>
      </div>
    </Card>
  );
};

const Stat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "muted";
}) => {
  const tones: Record<string, string> = {
    success: "text-green-600",
    warning: "text-amber-600",
    muted: "text-muted-foreground",
  };
  return (
    <div className="rounded-lg bg-muted/40 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-xs font-semibold mt-0.5 truncate ${tone ? tones[tone] : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
};

export default MyContributionsTab;
