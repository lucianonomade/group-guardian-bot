import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, AlertTriangle, Ban, Shield, Activity, TrendingUp, MessageSquare, FileDown, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";

interface Stats {
  groups: number;
  monitoredGroups: number;
  warnings: number;
  bans: number;
  blockedWords: number;
  whitelistCount: number;
}

interface ActionLog {
  id: string;
  action_type: string;
  participant_name: string | null;
  participant_jid: string | null;
  details: string | null;
  created_at: string;
}

interface DailyData {
  day: string;
  date: string;
  msgs: number;
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const logItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0 },
};

const PIE_COLORS = ["#ef4444", "hsl(174, 72%, 46%)", "#f59e0b"];

const ACTION_TYPE_MAP: Record<string, { label: string; color: string; bg: string }> = {
  warning: { label: "Avisos", color: "text-amber-400", bg: "bg-amber-400" },
  ban: { label: "Bans", color: "text-red-400", bg: "bg-red-400" },
  unban: { label: "Desbanimento", color: "text-emerald-400", bg: "bg-emerald-400" },
  link_deleted: { label: "Links Removidos", color: "text-primary", bg: "bg-primary" },
  word_deleted: { label: "Palavra Proibida", color: "text-purple-400", bg: "bg-purple-400" },
};

const getActionLabel = (type: string) =>
  ACTION_TYPE_MAP[type] || { label: type, color: "text-muted-foreground", bg: "bg-muted-foreground" };

export default function Index() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ groups: 0, monitoredGroups: 0, warnings: 0, bans: 0, blockedWords: 0, whitelistCount: 0 });
  const [recentLogs, setRecentLogs] = useState<ActionLog[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [actionBreakdown, setActionBreakdown] = useState<{ name: string; value: number; color: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [groups, monitoredGroups, warnings, bans, words, whitelist, logs, weekLogs] = await Promise.all([
        supabase.from("groups").select("id", { count: "exact", head: true }),
        supabase.from("groups").select("id", { count: "exact", head: true }).eq("is_monitored", true),
        supabase.from("warnings").select("id", { count: "exact", head: true }),
        supabase.from("bans").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("blocked_words").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("whitelist").select("id", { count: "exact", head: true }),
        supabase.from("action_logs").select("*").order("created_at", { ascending: false }).limit(15),
        supabase.from("action_logs").select("action_type, created_at").gte("created_at", sevenDaysAgo.toISOString()),
      ]);

      setStats({
        groups: groups.count ?? 0,
        monitoredGroups: monitoredGroups.count ?? 0,
        warnings: warnings.count ?? 0,
        bans: bans.count ?? 0,
        blockedWords: words.count ?? 0,
        whitelistCount: whitelist.count ?? 0,
      });

      setRecentLogs((logs.data as ActionLog[]) ?? []);

      const allWeekLogs = (weekLogs.data as { action_type: string; created_at: string }[]) ?? [];
      const now = new Date();
      const days: DailyData[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dayStr = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
        const dateStr = d.toISOString().slice(0, 10);
        const dayLogs = allWeekLogs.filter(l => l.created_at.startsWith(dateStr));
        days.push({
          day: dayStr.charAt(0).toUpperCase() + dayStr.slice(1),
          date: dateStr,
          msgs: dayLogs.length,
        });
      }
      setDailyData(days);

      const typeCounts: Record<string, number> = {};
      allWeekLogs.forEach(l => {
        const label = getActionLabel(l.action_type).label;
        typeCounts[label] = (typeCounts[label] || 0) + 1;
      });
      
      const colorMap: Record<string, string> = {
        "Bans": "#ef4444",
        "Links Removidos": "hsl(174, 72%, 46%)",
        "Avisos": "#f59e0b",
        "Desbanimento": "#10b981",
        "Palavra Proibida": "#a855f7",
      };
      
      setActionBreakdown(
        Object.entries(typeCounts).map(([name, value]) => ({
          name,
          value,
          color: colorMap[name] || "hsl(174, 72%, 46%)",
        }))
      );

      setLoading(false);
    };

    fetchData();
  }, [user]);

  const totalActions = actionBreakdown.reduce((sum, item) => sum + item.value, 0);

  const statCards = [
    { label: "GROUPS", value: stats.monitoredGroups, total: stats.groups, icon: Users, iconBg: "bg-primary/15", iconColor: "text-primary" },
    { label: "WARNINGS", value: stats.warnings, icon: AlertTriangle, iconBg: "bg-amber-500/15", iconColor: "text-amber-400" },
    { label: "BANS", value: stats.bans, icon: Ban, iconBg: "bg-red-500/15", iconColor: "text-red-400" },
    { label: "BLOCKED WORDS", value: stats.blockedWords, icon: Shield, iconBg: "bg-blue-500/15", iconColor: "text-blue-400" },
    { label: "WHITELIST", value: stats.whitelistCount, icon: CheckCircle, iconBg: "bg-purple-500/15", iconColor: "text-purple-400" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-1 rounded-full bg-gradient-to-b from-primary to-primary/20" />
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>
                <p className="mt-0.5 text-sm text-muted-foreground/60">Visão geral da moderação dos seus grupos</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 text-xs font-bold tracking-wider uppercase gap-2">
                <FileDown className="h-3.5 w-3.5" />
                Export Report
              </Button>
              <Badge className="bg-primary/10 text-primary border border-primary/30 px-4 py-2 text-xs font-bold tracking-wider uppercase">
                <span className="relative flex h-2 w-2 mr-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                System Health: Optimal
              </Badge>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" variants={containerVariants} initial="hidden" animate="visible">
          {statCards.map(card => (
            <motion.div key={card.label} variants={cardVariants} whileHover={{ y: -4, transition: { duration: 0.3 } }} className="stat-card group cursor-default">
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg} backdrop-blur-sm`}>
                    <card.icon className={`h-[18px] w-[18px] ${card.iconColor}`} />
                  </div>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50 mb-1.5">{card.label}</p>
                <p className="text-3xl font-extrabold tracking-tight">
                  {loading ? (
                    <span className="inline-block h-8 w-16 rounded-lg bg-muted/30 animate-pulse" />
                  ) : card.total ? (
                    <><span>{card.value}</span><span className="text-base font-semibold text-muted-foreground/40">/{card.total}</span></>
                  ) : card.value}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Charts Row */}
        <motion.div className="grid gap-5 lg:grid-cols-3" variants={containerVariants} initial="hidden" animate="visible">
          {/* Area Chart */}
          <motion.div variants={cardVariants} className="lg:col-span-2">
            <Card className="glass-card overflow-hidden">
              <CardHeader className="border-b border-border/20 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                      <TrendingUp className="h-3.5 w-3.5 text-primary" />
                    </div>
                    Atividade dos Últimos 7 Dias
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="text-[10px] text-muted-foreground/60 font-medium">Msgs Filtradas</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {loading ? (
                  <div className="h-52 flex items-center justify-center">
                    <div className="h-5 w-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  </div>
                ) : dailyData.every(d => d.msgs === 0) ? (
                  <div className="h-52 flex flex-col items-center justify-center text-muted-foreground/40 gap-3">
                    <TrendingUp className="h-10 w-10 opacity-20" />
                    <p className="text-sm font-medium">Sem atividade recente</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={dailyData}>
                      <defs>
                        <linearGradient id="msgsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(174 72% 46%)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="hsl(174 72% 46%)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(210 10% 45%)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(210 10% 45%)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "hsl(220 18% 7%)", border: "1px solid hsl(220 14% 12%)", borderRadius: "12px", fontSize: "12px", boxShadow: "0 8px 32px -8px rgba(0,0,0,0.5)" }} />
                      <Area type="monotone" dataKey="msgs" name="Msgs Filtradas" stroke="hsl(174 72% 46%)" fill="url(#msgsGrad)" strokeWidth={2.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Donut Chart */}
          <motion.div variants={cardVariants}>
            <Card className="glass-card overflow-hidden h-full">
              <CardHeader className="border-b border-border/20 pb-4">
                <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                    <Activity className="h-3.5 w-3.5 text-primary" />
                  </div>
                  Tipos de Ação
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {loading ? (
                  <div className="h-52 flex items-center justify-center">
                    <div className="h-5 w-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  </div>
                ) : actionBreakdown.length === 0 ? (
                  <div className="h-52 flex flex-col items-center justify-center text-muted-foreground/40 gap-3">
                    <Activity className="h-10 w-10 opacity-20" />
                    <p className="text-sm font-medium">Sem dados</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <ResponsiveContainer width={200} height={200}>
                        <PieChart>
                          <Pie
                            data={actionBreakdown}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={3}
                            strokeWidth={0}
                          >
                            {actionBreakdown.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Center label */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-extrabold tracking-tight">{totalActions}</span>
                        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Total</span>
                      </div>
                    </div>
                    <div className="w-full space-y-2 px-2">
                      {actionBreakdown.map((item) => (
                        <div key={item.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                            <span className="text-xs text-muted-foreground/70 font-medium">{item.name}</span>
                          </div>
                          <span className="text-xs font-bold">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <Card className="glass-card overflow-hidden">
            <CardHeader className="border-b border-border/20 pb-4">
              <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <Activity className="h-3.5 w-3.5 text-primary" />
                </div>
                Atividade Recente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-5 w-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                </div>
              ) : recentLogs.length === 0 ? (
                <div className="flex flex-col items-center gap-3 p-12 text-muted-foreground/40">
                  <TrendingUp className="h-10 w-10 opacity-20" />
                  <p className="text-sm font-medium">Nenhuma atividade registrada ainda.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/10">
                  {recentLogs.map((log, i) => {
                    const { label, color, bg } = getActionLabel(log.action_type);
                    return (
                      <motion.div
                        key={log.id}
                        variants={logItemVariants}
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: 0.3 + i * 0.04, duration: 0.3 }}
                        className="flex items-center justify-between px-6 py-4 transition-colors duration-300 hover:bg-muted/20"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className={`h-2 w-2 rounded-full ${bg} shadow-sm`} style={{ boxShadow: `0 0 8px 1px currentColor` }} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${color}`}>{label}</span>
                              {log.participant_name && (
                                <span className="text-xs text-foreground/70 font-medium">— {log.participant_name}</span>
                              )}
                            </div>
                            {log.details && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground/50">{log.details}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground/35 whitespace-nowrap font-mono tracking-tight">
                          {new Date(log.created_at).toLocaleString("pt-BR")}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
