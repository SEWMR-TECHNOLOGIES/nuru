import { useEffect, useState, useCallback, useMemo } from "react";
import { useAdminMeta } from "@/hooks/useAdminMeta";
import { get } from "@/lib/api/helpers";
import {
  BarChart3, Eye, Users, Globe, Monitor, Smartphone, Tablet,
  TrendingUp, Clock, Search, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AnalyticsData {
  totalViews: number;
  uniqueVisitors: number;
  totalSessions: number;
  topPages: { path: string; views: number }[];
  deviceBreakdown: { device_type: string; count: number }[];
  browserBreakdown: { browser: string; count: number }[];
  dailyViews: { date: string; views: number }[];
  recentViews: { path: string; device_type: string; browser: string; created_at: string }[];
}

const RANGES = [
  { label: "Today", value: "today" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "All time", value: "all" },
];

const PAGE_SIZE = 10;

export default function AdminAnalytics() {
  useAdminMeta("Analytics");
  const [range, setRange] = useState("7d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [topPage, setTopPage] = useState(1);
  const [recentPage, setRecentPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<any>(`/admin/analytics?range=${range}`);
      if (res.success && res.data) setData(res.data);
      else setData(null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  // Reset pages when search or range changes
  useEffect(() => { setTopPage(1); setRecentPage(1); }, [search, range]);

  const filteredTopPages = useMemo(() => {
    if (!data?.topPages) return [];
    if (!search.trim()) return data.topPages;
    const q = search.toLowerCase();
    return data.topPages.filter(p => p.path.toLowerCase().includes(q));
  }, [data?.topPages, search]);

  const filteredRecent = useMemo(() => {
    if (!data?.recentViews) return [];
    if (!search.trim()) return data.recentViews;
    const q = search.toLowerCase();
    return data.recentViews.filter(v => v.path.toLowerCase().includes(q));
  }, [data?.recentViews, search]);

  const topTotalPages = Math.max(1, Math.ceil(filteredTopPages.length / PAGE_SIZE));
  const recentTotalPages = Math.max(1, Math.ceil(filteredRecent.length / PAGE_SIZE));

  const paginatedTop = filteredTopPages.slice((topPage - 1) * PAGE_SIZE, topPage * PAGE_SIZE);
  const paginatedRecent = filteredRecent.slice((recentPage - 1) * PAGE_SIZE, recentPage * PAGE_SIZE);

  const deviceIcon = (type: string) => {
    if (type === "mobile") return <Smartphone className="w-4 h-4" />;
    if (type === "tablet") return <Tablet className="w-4 h-4" />;
    return <Monitor className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-3">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Website Analytics</h2>
          <p className="text-sm text-muted-foreground mt-1">Monitor website traffic and visitor behavior.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Filter by URL path…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Total Views", value: data?.totalViews || 0, icon: Eye, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Unique Visitors", value: data?.uniqueVisitors || 0, icon: Users, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Sessions", value: data?.totalSessions || 0, icon: Globe, color: "text-purple-500", bg: "bg-purple-500/10" },
          { label: "Avg Pages/Session", value: data && data.totalSessions > 0 ? (data.totalViews / data.totalSessions).toFixed(1) : "0", icon: TrendingUp, color: "text-amber-500", bg: "bg-amber-500/10" },
        ].map(card => (
          <div key={card.label} className="bg-card border border-border rounded-xl p-4 sm:p-5">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg ${card.bg} flex items-center justify-center mb-2 sm:mb-3`}>
              <card.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${card.color}`} />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-foreground">{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</div>
            <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Pages */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Top Pages
            {search && <span className="text-xs text-muted-foreground font-normal">({filteredTopPages.length} results)</span>}
          </h3>
          <div className="space-y-1">
            {paginatedTop.map((page, i) => (
              <div key={page.path} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-muted-foreground w-5 flex-shrink-0">{(topPage - 1) * PAGE_SIZE + i + 1}.</span>
                  <span className="text-sm text-foreground truncate">{page.path}</span>
                </div>
                <span className="text-sm font-semibold text-foreground flex-shrink-0 ml-3">{page.views}</span>
              </div>
            ))}
            {filteredTopPages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {search ? "No pages match your search" : "No page view data yet"}
              </p>
            )}
          </div>
          {topTotalPages > 1 && (
            <PaginationBar current={topPage} total={topTotalPages} onChange={setTopPage} />
          )}
        </div>

        {/* Device & Browser */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-primary" /> Devices
            </h3>
            <div className="space-y-3">
              {(data?.deviceBreakdown || []).map(d => {
                const pct = data ? ((d.count / data.totalViews) * 100).toFixed(0) : "0";
                return (
                  <div key={d.device_type} className="flex items-center gap-3">
                    {deviceIcon(d.device_type)}
                    <span className="text-sm capitalize text-foreground flex-1">{d.device_type}</span>
                    <span className="text-sm font-semibold text-foreground">{d.count}</span>
                    <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" /> Browsers
            </h3>
            <div className="space-y-3">
              {(data?.browserBreakdown || []).slice(0, 5).map(b => {
                const pct = data ? ((b.count / data.totalViews) * 100).toFixed(0) : "0";
                return (
                  <div key={b.browser} className="flex items-center gap-3">
                    <span className="text-sm text-foreground flex-1">{b.browser}</span>
                    <span className="text-sm font-semibold text-foreground">{b.count}</span>
                    <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" /> Recent Page Views
          {search && <span className="text-xs text-muted-foreground font-normal">({filteredRecent.length} results)</span>}
        </h3>
        <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 font-medium text-muted-foreground">Page</th>
                <th className="text-left py-2 font-medium text-muted-foreground">Device</th>
                <th className="text-left py-2 font-medium text-muted-foreground">Browser</th>
                <th className="text-left py-2 font-medium text-muted-foreground">Time</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRecent.map((v, i) => (
                <tr key={i} className="border-b border-border/30 last:border-0">
                  <td className="py-2 text-foreground max-w-[200px] truncate">{v.path}</td>
                  <td className="py-2 capitalize text-muted-foreground">{v.device_type}</td>
                  <td className="py-2 text-muted-foreground">{v.browser}</td>
                  <td className="py-2 text-muted-foreground whitespace-nowrap">
                    {new Date(v.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRecent.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {search ? "No views match your search" : "No recent views"}
            </p>
          )}
        </div>
        {recentTotalPages > 1 && (
          <PaginationBar current={recentPage} total={recentTotalPages} onChange={setRecentPage} />
        )}
      </div>

      {/* Daily Trend */}
      {data?.dailyViews && data.dailyViews.length > 1 && (
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Daily Trend
          </h3>
          <div className="flex items-end gap-1 h-32 overflow-x-auto">
            {data.dailyViews.map(d => {
              const max = Math.max(...data.dailyViews.map(v => v.views));
              const height = max > 0 ? (d.views / max) * 100 : 0;
              return (
                <div key={d.date} className="flex-1 min-w-[24px] flex flex-col items-center gap-1">
                  <span className="text-[9px] text-muted-foreground">{d.views}</span>
                  <div
                    className="w-full bg-primary/80 rounded-t-sm min-h-[2px] transition-all"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[8px] text-muted-foreground truncate max-w-full">
                    {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Compact Modern Pagination ── */
function PaginationBar({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) {
  const pages = useMemo(() => {
    const items: (number | "...")[] = [];
    if (total <= 5) {
      for (let i = 1; i <= total; i++) items.push(i);
    } else {
      items.push(1);
      if (current > 3) items.push("...");
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) items.push(i);
      if (current < total - 2) items.push("...");
      items.push(total);
    }
    return items;
  }, [current, total]);

  return (
    <div className="flex items-center justify-center gap-1 mt-4 pt-3 border-t border-border/40">
      <button
        disabled={current === 1}
        onClick={() => onChange(current - 1)}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`e${i}`} className="w-8 text-center text-xs text-muted-foreground">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p as number)}
            className={`w-8 h-8 rounded-md text-xs font-medium transition-colors ${
              p === current
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        disabled={current === total}
        onClick={() => onChange(current + 1)}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
