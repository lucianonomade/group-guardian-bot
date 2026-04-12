import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, AlertTriangle, Ban, Shield, Activity, TrendingUp, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

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
  visible: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: "spring" as const, stiffness: 260, damping: 20 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const logItemVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0 },
};

const PIE_COLORS = ["hsl(var(--primary))", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7"];

const ACTION_TYPE_MAP: Record<string, { label: string; color: string }> = {
  warning: { label: "Aviso", color: "text-amber-400" },
  ban: { label: "Banimento", color: "text-red-400" },
  unban: { label: "Desbanimento", color: "text-emerald-400" },
  link_deleted: { label: "Link Removido", color: "text-blue-400" },
  word_deleted: { label: "Palavra Proibida", color: "text-purple-400" },
};

const getActionLabel = (type: string) =>
  ACTION_TYPE_MAP[type] || { label: type, color: "text-muted-foreground" };

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
      // Get date 7 days ago for chart query
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

      // Build daily chart data (last 7 days)
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

      // Action type breakdown from week logs
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
    { label: "Grupos Monitorados", value: `${stats.monitoredGroups}/${stats.groups}`, icon: Users, gradient: "from-primary/15 to-emerald-500/5", iconColor: "text-primary" },
    { label: "Avisos Dados", value: stats.warnings, icon: AlertTriangle, gradient: "from-amber-500/15 to-orange-500/5", iconColor: "text-amber-400" },
    { label: "Banimentos Ativos", value: stats.bans, icon: Ban, gradient: "from-red-500/15 to-rose-500/5", iconColor: "text-red-400" },
    { label: "Palavras Bloqueadas", value: stats.blockedWords, icon: Shield, gradient: "from-blue-500/15 to-cyan-500/5", iconColor: "text-blue-400" },
    { label: "Na Whitelist", value: stats.whitelistCount, icon: MessageSquare, gradient: "from-purple-500/15 to-violet-500/5", iconColor: "text-purple-400" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Visão geral da moderação dos seus grupos</p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" variants={containerVariants} initial="hidden" animate="visible">
          {statCards.map(card => (
            <motion.div key={card.label} variants={cardVariants} whileHover={{ scale: 1.03, transition: { duration: 0.2 } }} className="stat-card group cursor-default">
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-40 transition-opacity group-hover:opacity-60`} />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{card.label}</p>
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient}`}>
                    <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                  </div>
                </div>
                <p className="mt-3 text-3xl font-bold tracking-tight">{loading ? "—" : card.value}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Charts Row */}
        <motion.div className="grid gap-4 lg:grid-cols-3" variants={containerVariants} initial="hidden" animate="visible">
          {/* Bar Chart */}
          <motion.div variants={cardVariants} className="lg:col-span-2">
            <Card className="glass-card overflow-hidden">
              <CardHeader className="border-b border-border/30 pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Atividade dos Últimos 7 Dias
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {loading ? (
                  <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Carregando...</div>
                ) : dailyData.every(d => d.avisos === 0 && d.bans === 0) ? (
                  <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <TrendingUp className="h-8 w-8 opacity-20" />
                    <p className="text-sm">Sem atividade recente</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dailyData} barGap={4}>
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                      <Bar dataKey="avisos" name="Avisos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="bans" name="Bans" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Pie Chart */}
          <motion.div variants={cardVariants}>
            <Card className="glass-card overflow-hidden h-full">
              <CardHeader className="border-b border-border/30 pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-primary" />
                  Tipos de Ação
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {loading ? (
                  <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Carregando...</div>
                ) : actionBreakdown.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <Activity className="h-8 w-8 opacity-20" />
                    <p className="text-sm">Sem dados</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={actionBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3}>
                          {actionBreakdown.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-3 justify-center">
                      {actionBreakdown.map((item, i) => (
                        <div key={item.name} className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-[10px] text-muted-foreground">{item.name} ({item.value})</span>
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
            <CardHeader className="border-b border-border/30 pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" />
                Atividade Recente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
              ) : recentLogs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-10 text-muted-foreground">
                  <TrendingUp className="h-8 w-8 opacity-30" />
                  <p className="text-sm">Nenhuma atividade registrada ainda.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/20">
                  {recentLogs.map((log, i) => {
                    const { label, color } = getActionLabel(log.action_type);
                    return (
                      <motion.div
                        key={log.id}
                        variants={logItemVariants}
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: 0.4 + i * 0.05, duration: 0.3 }}
                        className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-2 w-2 rounded-full ${color.replace("text-", "bg-")} shadow-sm ${color.replace("text-", "shadow-")}/30`} />
                          <div>
                            <span className={`text-xs font-bold ${color}`}>{label}</span>
                            {log.participant_name && (
                              <span className="ml-2 text-xs text-foreground/80">— {log.participant_name}</span>
                            )}
                            {log.details && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground/70">{log.details}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-[11px] text-muted-foreground/50 whitespace-nowrap font-mono">
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