import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, AlertTriangle, Ban, Shield, Activity, TrendingUp, MessageSquare, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart } from "recharts";

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
  avisos: number;
  bans: number;
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

const PIE_COLORS = ["hsl(174, 72%, 46%)", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7"];

const ACTION_TYPE_MAP: Record<string, { label: string; color: string; bg: string }> = {
  warning: { label: "Aviso", color: "text-amber-400", bg: "bg-amber-400" },
  ban: { label: "Banimento", color: "text-red-400", bg: "bg-red-400" },
  unban: { label: "Desbanimento", color: "text-emerald-400", bg: "bg-emerald-400" },
  link_deleted: { label: "Link Removido", color: "text-blue-400", bg: "bg-blue-400" },
  word_deleted: { label: "Palavra Proibida", color: "text-purple-400", bg: "bg-purple-400" },
};

const getActionLabel = (type: string) =>
  ACTION_TYPE_MAP[type] || { label: type, color: "text-muted-foreground", bg: "bg-muted-foreground" };

export default function Index() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ groups: 0, monitoredGroups: 0, warnings: 0, bans: 0, blockedWords: 0, whitelistCount: 0 });
  const [recentLogs, setRecentLogs] = useState<ActionLog[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [actionBreakdown, setActionBreakdown] = useState<{ name: string; value: number }[]>([]);
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
          avisos: dayLogs.filter(l => l.action_type === "warning").length,
          bans: dayLogs.filter(l => l.action_type === "ban").length,
        });
      }
      setDailyData(days);

      const typeCounts: Record<string, number> = {};
      allWeekLogs.forEach(l => {
        const label = getActionLabel(l.action_type).label;
        typeCounts[label] = (typeCounts[label] || 0) + 1;
      });
      setActionBreakdown(Object.entries(typeCounts).map(([name, value]) => ({ name, value })));

      setLoading(false);
    };

    fetchData();
  }, [user]);

  const statCards = [
    { label: "Grupos", sublabel: "Monitorados", value: stats.monitoredGroups, total: stats.groups, icon: Users, gradient: "from-primary/20 to-teal-500/5", iconBg: "bg-primary/10", iconColor: "text-primary" },
    { label: "Avisos", sublabel: "Total", value: stats.warnings, icon: AlertTriangle, gradient: "from-amber-500/20 to-orange-500/5", iconBg: "bg-amber-500/10", iconColor: "text-amber-400" },
    { label: "Banimentos", sublabel: "Ativos", value: stats.bans, icon: Ban, gradient: "from-red-500/20 to-rose-500/5", iconBg: "bg-red-500/10", iconColor: "text-red-400" },
    { label: "Palavras", sublabel: "Bloqueadas", value: stats.blockedWords, icon: Shield, gradient: "from-blue-500/20 to-cyan-500/5", iconBg: "bg-blue-500/10", iconColor: "text-blue-400" },
    { label: "Whitelist", sublabel: "Participantes", value: stats.whitelistCount, icon: MessageSquare, gradient: "from-purple-500/20 to-violet-500/5", iconBg: "bg-purple-500/10", iconColor: "text-purple-400" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-primary to-primary/20" />
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>
              <p className="mt-0.5 text-sm text-muted-foreground/60">Visão geral da moderação dos seus grupos</p>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" variants={containerVariants} initial="hidden" animate="visible">
          {statCards.map(card => (
            <motion.div key={card.label} variants={cardVariants} whileHover={{ y: -4, transition: { duration: 0.3 } }} className="stat-card group cursor-default">
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-50 transition-opacity duration-500 group-hover:opacity-80`} />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg} backdrop-blur-sm`}>
                    <card.icon className={`h-[18px] w-[18px] ${card.iconColor}`} />
                  </div>
                </div>
                <p className="text-3xl font-extrabold tracking-tight">
                  {loading ? (
                    <span className="inline-block h-8 w-16 rounded-lg bg-muted/30 animate-pulse" />
                  ) : card.total ? (
                    <><span>{card.value}</span><span className="text-base font-semibold text-muted-foreground/40">/{card.total}</span></>
                  ) : card.value}
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">{card.label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Charts Row */}
        <motion.div className="grid gap-5 lg:grid-cols-3" variants={containerVariants} initial="hidden" animate="visible">
          {/* Bar Chart */}
          <motion.div variants={cardVariants} className="lg:col-span-2">
            <Card className="glass-card overflow-hidden">
              <CardHeader className="border-b border-border/20 pb-4">
                <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  </div>
                  Atividade dos Últimos 7 Dias
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {loading ? (
                  <div className="h-52 flex items-center justify-center">
                    <div className="h-5 w-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  </div>
                ) : dailyData.every(d => d.avisos === 0 && d.bans === 0) ? (
                  <div className="h-52 flex flex-col items-center justify-center text-muted-foreground/40 gap-3">
                    <TrendingUp className="h-10 w-10 opacity-20" />
                    <p className="text-sm font-medium">Sem atividade recente</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={210}>
                    <AreaChart data={dailyData}>
                      <defs>
                        <linearGradient id="avisosGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="bansGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(210 10% 45%)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(210 10% 45%)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "hsl(220 18% 7%)", border: "1px solid hsl(220 14% 12%)", borderRadius: "12px", fontSize: "12px", boxShadow: "0 8px 32px -8px rgba(0,0,0,0.5)" }} />
                      <Area type="monotone" dataKey="avisos" name="Avisos" stroke="#f59e0b" fill="url(#avisosGrad)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="bans" name="Bans" stroke="#ef4444" fill="url(#bansGrad)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Pie Chart */}
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
                    <ResponsiveContainer width="100%" height={170}>
                      <PieChart>
                        <Pie data={actionBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} strokeWidth={0}>
                          {actionBreakdown.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "hsl(220 18% 7%)", border: "1px solid hsl(220 14% 12%)", borderRadius: "12px", fontSize: "12px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-3 justify-center">
                      {actionBreakdown.map((item, i) => (
                        <div key={item.name} className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-[10px] text-muted-foreground/60 font-medium">{item.name} ({item.value})</span>
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
