import { useEffect, useState, useCallback } from "react";
import { useAdminMeta } from "@/hooks/useAdminMeta";
import { get } from "@/lib/api/helpers";
import {
  BarChart3, Eye, Users, Globe, Monitor, Smartphone, Tablet,
  TrendingUp, Clock,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function AdminAnalytics() {
  useAdminMeta("Analytics");
  const [range, setRange] = useState("7d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<any>(`/admin/analytics?range=${range}`);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Website Analytics</h2>
          <p className="text-sm text-muted-foreground mt-1">Monitor website traffic and visitor behavior.</p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Views", value: data?.totalViews || 0, icon: Eye, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Unique Visitors", value: data?.uniqueVisitors || 0, icon: Users, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Sessions", value: data?.totalSessions || 0, icon: Globe, color: "text-purple-500", bg: "bg-purple-500/10" },
          { label: "Avg Pages/Session", value: data && data.totalSessions > 0 ? (data.totalViews / data.totalSessions).toFixed(1) : "0", icon: TrendingUp, color: "text-amber-500", bg: "bg-amber-500/10" },
        ].map(card => (
          <div key={card.label} className="bg-card border border-border rounded-xl p-5">
            <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div className="text-2xl font-bold text-foreground">{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Pages */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Top Pages
          </h3>
          <div className="space-y-2">
            {(data?.topPages || []).map((page, i) => (
              <div key={page.path} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-muted-foreground w-5 flex-shrink-0">{i + 1}.</span>
                  <span className="text-sm text-foreground truncate">{page.path}</span>
                </div>
                <span className="text-sm font-semibold text-foreground flex-shrink-0 ml-3">{page.views}</span>
              </div>
            ))}
            {(!data?.topPages || data.topPages.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No page view data yet</p>
            )}
          </div>
        </div>

        {/* Device & Browser */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
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

          <div className="bg-card border border-border rounded-xl p-5">
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
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" /> Recent Page Views
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 font-medium text-muted-foreground">Page</th>
                <th className="text-left py-2 font-medium text-muted-foreground">Device</th>
                <th className="text-left py-2 font-medium text-muted-foreground">Browser</th>
                <th className="text-left py-2 font-medium text-muted-foreground">Time</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentViews || []).map((v, i) => (
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
          {(!data?.recentViews || data.recentViews.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-8">No recent views</p>
          )}
        </div>
      </div>

      {/* Daily Trend */}
      {data?.dailyViews && data.dailyViews.length > 1 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Daily Trend
          </h3>
          <div className="flex items-end gap-1 h-32">
            {data.dailyViews.map(d => {
              const max = Math.max(...data.dailyViews.map(v => v.views));
              const height = max > 0 ? (d.views / max) * 100 : 0;
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
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
