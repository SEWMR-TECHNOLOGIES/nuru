import { useEffect, useState, useCallback, useRef } from "react";
import { useAdminMeta } from "@/hooks/useAdminMeta";
import { Link } from "react-router-dom";
import {
  Users, ShieldCheck, MessageSquare, HeadphonesIcon,
  CalendarDays, Briefcase, ChevronRight,
  Newspaper, Sparkles, Users2, BookOpen, CreditCard, Tag,
} from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import { adminCaches } from "@/lib/api/adminCache";
import { usePolling } from "@/hooks/usePolling";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

// Module-level cache for dashboard stats
let _dashStats: Stats | null = null;
let _dashExtended: ExtendedStats | null = null;
let _dashLoaded = false;

interface Stats {
  total_users: number;
  total_events: number;
  total_services: number;
  pending_kyc: number;
  open_tickets: number;
  active_chats: number;
  waiting_chats: number;
}

interface ExtendedStats {
  total_posts: number;
  total_moments: number;
  total_communities: number;
  total_bookings: number;
  pending_bookings: number;
  pending_card_orders: number;
}

const statCards = (s: Stats, e: ExtendedStats | null) => [
  { label: "Total Users", value: s.total_users, icon: Users, to: "/admin/users", colorClass: "text-blue-500", bgClass: "bg-blue-500/10" },
  { label: "Pending KYC", value: s.pending_kyc, icon: ShieldCheck, to: "/admin/kyc?status=pending", colorClass: "text-amber-500", bgClass: "bg-amber-500/10" },
  { label: "Active Chats", value: s.active_chats + s.waiting_chats, icon: MessageSquare, to: "/admin/chats", colorClass: "text-green-500", bgClass: "bg-green-500/10" },
  { label: "Open Tickets", value: s.open_tickets, icon: HeadphonesIcon, to: "/admin/tickets?status=open", colorClass: "text-red-500", bgClass: "bg-red-500/10" },
  { label: "Total Events", value: s.total_events, icon: CalendarDays, to: "/admin/events", colorClass: "text-purple-500", bgClass: "bg-purple-500/10" },
  { label: "Total Services", value: s.total_services, icon: Briefcase, to: "/admin/services", colorClass: "text-cyan-500", bgClass: "bg-cyan-500/10" },
  ...(e ? [
    { label: "Total Posts", value: e.total_posts, icon: Newspaper, to: "/admin/posts", colorClass: "text-indigo-500", bgClass: "bg-indigo-500/10" },
    { label: "Moments", value: e.total_moments, icon: Sparkles, to: "/admin/moments", colorClass: "text-pink-500", bgClass: "bg-pink-500/10" },
    { label: "Communities", value: e.total_communities, icon: Users2, to: "/admin/communities", colorClass: "text-teal-500", bgClass: "bg-teal-500/10" },
    { label: "Total Bookings", value: e.total_bookings, icon: BookOpen, to: "/admin/bookings", colorClass: "text-orange-500", bgClass: "bg-orange-500/10" },
    { label: "Card Orders", value: e.pending_card_orders, icon: CreditCard, to: "/admin/nuru-cards", colorClass: "text-violet-500", bgClass: "bg-violet-500/10" },
    { label: "Service Categories", value: 0, icon: Tag, to: "/admin/service-categories", colorClass: "text-emerald-500", bgClass: "bg-emerald-500/10" },
  ] : []),
];

export default function AdminDashboard() {
  useAdminMeta("Dashboard");
  const [stats, setStats] = useState<Stats | null>(_dashStats);
  const [extended, setExtended] = useState<ExtendedStats | null>(_dashExtended);
  const [loading, setLoading] = useState(!_dashLoaded);
  const initialLoad = useRef(!_dashLoaded);

  const load = useCallback(async () => {
    if (initialLoad.current) setLoading(true);
    const [r1, r2] = await Promise.all([adminApi.getStats(), adminApi.getExtendedStats()]);
    if (r1.success) { _dashStats = r1.data; setStats(r1.data); }
    else if (initialLoad.current) toast.error("Failed to load stats");
    if (r2.success) { _dashExtended = r2.data; setExtended(r2.data); }
    _dashLoaded = true;
    setLoading(false);
    initialLoad.current = false;
  }, []);

  useEffect(() => {
    if (!_dashLoaded) { initialLoad.current = true; load(); }
    else load(); // silent background refresh
  }, [load]);
  usePolling(load);

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-start justify-between">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <Skeleton className="w-4 h-4" />
              </div>
              <div>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">Welcome back — here's what's happening on Nuru.</p>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards(stats, extended).map((card) => (
            <Link
              key={card.label}
              to={card.to}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-lg ${card.bgClass} flex items-center justify-center`}>
                  <card.icon className={`w-5 h-5 ${card.colorClass}`} />
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="mt-4">
                <div className="text-2xl font-bold text-foreground">{card.value.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{card.label}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: "Review KYC Submissions", to: "/admin/kyc?status=pending", desc: "Approve or reject pending service verifications" },
            { label: "Reply to Live Chats", to: "/admin/chats?status=waiting", desc: "Respond to users waiting for support" },
            { label: "Manage Event Types", to: "/admin/event-types", desc: "Add or edit event categories" },
            { label: "Open Support Tickets", to: "/admin/tickets?status=open", desc: "Resolve user-reported issues" },
            { label: "Send Broadcast", to: "/admin/notifications", desc: "Notify all Nuru users" },
            { label: "Manage FAQs", to: "/admin/faqs", desc: "Update the help center content" },
            { label: "Moderate Posts", to: "/admin/posts", desc: "Review and remove inappropriate content" },
            { label: "Moderate Moments", to: "/admin/moments", desc: "Review and remove user stories" },
            { label: "NuruCard Orders", to: "/admin/nuru-cards", desc: "Update delivery status for card orders" },
          ].map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all group"
            >
              <div className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">{action.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{action.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

