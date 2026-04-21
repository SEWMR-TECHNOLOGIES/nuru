/**
 * Analytics Panel — premium contributor analytics.
 *
 * Reuses the /scoreboard endpoint (no extra request) so it's instant when the
 * user toggles tabs. Surfaces high-signal KPIs:
 *   - Status mix (completed / in progress / pending / no pledge) as a donut
 *   - Cash flow (pledged vs collected vs outstanding) as stacked bars
 *   - Distribution of completion %% buckets (0, 1-25, 26-50, 51-75, 76-99, 100)
 *   - Top contributors by amount paid
 *   - Average pledge, average paid, completion velocity
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, Wallet, Users, CheckCircle2, Clock, AlertCircle,
  Target, Award, Zap, BarChart3, PieChart as PieIcon,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { eventGroupsApi } from "@/lib/api/eventGroups";
import { useCurrency } from "@/hooks/useCurrency";
import { usePolling } from "@/hooks/usePolling";

interface Row {
  member_id: string;
  display_name: string;
  avatar_url?: string | null;
  pledged: number;
  paid: number;
  balance: number;
}
interface Summary {
  total_pledged: number;
  total_paid: number;
  outstanding: number;
  collection_rate: number;
  contributors: number;
  budget?: number | null;
}

const initials = (n: string) => (n || "?").trim().split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase();

// Per-group cache shared with ScoreboardPanel-style behaviour: avoid skeleton
// flash when toggling tabs.
const cache: Record<string, { rows: Row[]; summary: Summary | null }> = {};

const STATUS_COLORS = {
  completed: "hsl(var(--primary))",
  in_progress: "hsl(45 93% 47%)",        // amber
  pending: "hsl(var(--muted-foreground))",
  no_pledge: "hsl(var(--border))",
};

const classify = (r: Row): keyof typeof STATUS_COLORS => {
  if (r.pledged <= 0) return "no_pledge";
  if (r.paid >= r.pledged) return "completed";
  if (r.paid > 0) return "in_progress";
  return "pending";
};

const AnalyticsPanel = ({ groupId }: { groupId: string }) => {
  const { format } = useCurrency();
  const cached = cache[groupId];
  const [rows, setRows] = useState<Row[]>(cached?.rows || []);
  const [summary, setSummary] = useState<Summary | null>(cached?.summary || null);
  const [loading, setLoading] = useState(!cached);

  const fetchData = async () => {
    const res = await eventGroupsApi.scoreboard(groupId);
    if (res.success && res.data) {
      const r: Row[] = res.data.rows || [];
      setRows(r);
      setSummary(res.data.summary || null);
      cache[groupId] = { rows: r, summary: res.data.summary || null };
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [groupId]);
  usePolling(fetchData, 12000, !loading);

  // ──────────────────────────────────────────────
  // Derived analytics
  // ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = rows.length;
    const buckets = { completed: 0, in_progress: 0, pending: 0, no_pledge: 0 };
    let pledgeSum = 0, paidSum = 0;
    let topPaid: Row | null = null;
    for (const r of rows) {
      buckets[classify(r)]++;
      pledgeSum += r.pledged || 0;
      paidSum += r.paid || 0;
      if (!topPaid || (r.paid || 0) > (topPaid.paid || 0)) topPaid = r;
    }
    const avgPledge = total ? pledgeSum / total : 0;
    const avgPaid = total ? paidSum / total : 0;
    const participation = total ? ((buckets.completed + buckets.in_progress) / total) * 100 : 0;
    const completionRate = total ? (buckets.completed / total) * 100 : 0;
    return { total, buckets, pledgeSum, paidSum, avgPledge, avgPaid, participation, completionRate, topPaid };
  }, [rows]);

  const statusData = useMemo(() => ([
    { name: "Completed", value: stats.buckets.completed, color: STATUS_COLORS.completed, icon: "✅" },
    { name: "In progress", value: stats.buckets.in_progress, color: STATUS_COLORS.in_progress, icon: "⏳" },
    { name: "Not started", value: stats.buckets.pending, color: STATUS_COLORS.pending, icon: "⌛" },
    { name: "No pledge", value: stats.buckets.no_pledge, color: STATUS_COLORS.no_pledge, icon: "—" },
  ].filter(d => d.value > 0)), [stats]);

  const cashFlowData = useMemo(() => ([
    { name: "Pledged", value: summary?.total_pledged || 0, fill: "hsl(var(--primary) / 0.35)" },
    { name: "Collected", value: summary?.total_paid || 0, fill: "hsl(var(--primary))" },
    { name: "Outstanding", value: summary?.outstanding || 0, fill: "hsl(45 93% 47%)" },
  ]), [summary]);

  const distribution = useMemo(() => {
    const buckets = [
      { range: "0%", min: 0, max: 0, count: 0 },
      { range: "1–25%", min: 0.01, max: 0.25, count: 0 },
      { range: "26–50%", min: 0.26, max: 0.50, count: 0 },
      { range: "51–75%", min: 0.51, max: 0.75, count: 0 },
      { range: "76–99%", min: 0.76, max: 0.99, count: 0 },
      { range: "100%", min: 1, max: 999, count: 0 },
    ];
    for (const r of rows) {
      if (r.pledged <= 0) continue;
      const p = r.paid / r.pledged;
      if (p <= 0) buckets[0].count++;
      else if (p >= 1) buckets[5].count++;
      else if (p <= 0.25) buckets[1].count++;
      else if (p <= 0.5) buckets[2].count++;
      else if (p <= 0.75) buckets[3].count++;
      else buckets[4].count++;
    }
    return buckets;
  }, [rows]);

  const topFive = useMemo(
    () => [...rows].filter(r => r.paid > 0).sort((a, b) => b.paid - a.paid).slice(0, 5),
    [rows],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No analytics yet — add contributors to see insights.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<CheckCircle2 className="w-4 h-4" />}
          label="Completed"
          value={`${stats.buckets.completed}`}
          sub={`${Math.round(stats.completionRate)}% of contributors`}
          tone="primary"
        />
        <KpiCard
          icon={<Zap className="w-4 h-4" />}
          label="In Progress"
          value={`${stats.buckets.in_progress}`}
          sub={`${stats.total ? Math.round((stats.buckets.in_progress / stats.total) * 100) : 0}% partially paid`}
          tone="amber"
        />
        <KpiCard
          icon={<AlertCircle className="w-4 h-4" />}
          label="Not Started"
          value={`${stats.buckets.pending + stats.buckets.no_pledge}`}
          sub="Need a nudge"
          tone="muted"
        />
        <KpiCard
          icon={<Target className="w-4 h-4" />}
          label="Participation"
          value={`${Math.round(stats.participation)}%`}
          sub={`${stats.buckets.completed + stats.buckets.in_progress}/${stats.total} engaged`}
          tone="emerald"
        />
      </div>

      {/* ── Status donut + cash flow bars ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-primary" />
                <p className="font-semibold text-sm">Contribution Status</p>
              </div>
              <Badge variant="outline" className="text-[10px]">{stats.total} total</Badge>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 space-y-1.5">
              {statusData.map(d => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                    <span className="text-muted-foreground">{d.name}</span>
                  </div>
                  <span className="font-semibold">
                    {d.value} <span className="text-muted-foreground font-normal">
                      ({stats.total ? Math.round((d.value / stats.total) * 100) : 0}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                <p className="font-semibold text-sm">Cash Flow</p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {Math.round(summary?.collection_rate || 0)}% collected
              </Badge>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlowData} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => format(v).replace(/\s/g, "")} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={80} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: any) => format(Number(v))}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
              <div>
                <p className="text-muted-foreground">Avg pledge</p>
                <p className="font-bold text-primary">{format(stats.avgPledge)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Avg collected</p>
                <p className="font-bold text-emerald-600">{format(stats.avgPaid)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Outstanding</p>
                <p className="font-bold text-amber-600">{format(summary?.outstanding || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Distribution histogram ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <p className="font-semibold text-sm">Completion Distribution</p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              by % of pledge paid
            </Badge>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="range" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: any) => [`${v} contributors`, "Count"]}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── Top 5 by paid ── */}
      {topFive.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" />
                <p className="font-semibold text-sm">Top Contributors by Amount</p>
              </div>
              <Badge variant="outline" className="text-[10px]">{topFive.length}</Badge>
            </div>
            <div className="space-y-2">
              {topFive.map((r, i) => {
                const max = topFive[0].paid || 1;
                const w = Math.max(4, Math.round((r.paid / max) * 100));
                return (
                  <motion.div
                    key={r.member_id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3"
                  >
                    <span className="w-5 text-center text-xs font-bold text-muted-foreground">#{i + 1}</span>
                    <Avatar className="w-8 h-8">
                      {r.avatar_url && <AvatarImage src={r.avatar_url} />}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials(r.display_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-semibold truncate">{r.display_name}</p>
                        <p className="text-xs font-bold text-primary">{format(r.paid)}</p>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${w}%` }}
                          transition={{ duration: 0.6, delay: i * 0.05 }}
                          className="h-full bg-gradient-to-r from-primary to-primary/70"
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const KpiCard = ({
  icon, label, value, sub, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "primary" | "amber" | "emerald" | "muted";
}) => {
  const cls = {
    primary: "from-primary/15 to-primary/5 border-primary/20 text-primary",
    amber: "from-amber-500/15 to-amber-500/5 border-amber-500/20 text-amber-600",
    emerald: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/20 text-emerald-600",
    muted: "from-muted/40 to-muted/10 border-border text-muted-foreground",
  }[tone];
  return (
    <Card className={`bg-gradient-to-br ${cls}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{label}</p>
          <span className={tone === "muted" ? "text-muted-foreground" : ""}>{icon}</span>
        </div>
        <p className="text-2xl font-bold mt-1">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
};

export default AnalyticsPanel;
