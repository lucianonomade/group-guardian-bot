import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart3, TrendingUp, Users, Calendar, Trophy, AlertTriangle, Ban, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart } from "recharts";

interface GroupOption {
  id: string;
  name: string;
}

interface MemberRanking {
  jid: string;
  name: string;
  warnings: number;
  bans: number;
  total: number;
}

interface DailySummary {
  id: string;
  group_id: string;
  summary_text: string;
  date: string;
  members_active: any;
  created_at: string;
}

interface GrowthPoint {
  date: string;
  count: number;
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export default function Analytics() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [ranking, setRanking] = useState<MemberRanking[]>([]);
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [growthData, setGrowthData] = useState<GrowthPoint[]>([]);
  const [weeklyModeration, setWeeklyModeration] = useState<{ week: string; avisos: number; bans: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchGroups();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchAnalytics();
  }, [user, selectedGroup]);

  const fetchGroups = async () => {
    const { data } = await supabase.from("groups").select("id, name").order("name");
    setGroups((data as GroupOption[]) ?? []);
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Build query filters
    let logsQuery = supabase
      .from("action_logs")
      .select("action_type, participant_jid, participant_name, created_at")
      .gte("created_at", thirtyDaysAgo.toISOString());

    let summariesQuery = supabase
      .from("daily_summaries")
      .select("*")
      .order("date", { ascending: false })
      .limit(14);

    let snapshotsQuery = supabase
      .from("group_snapshots")
      .select("participant_count, snapshot_date")
      .order("snapshot_date", { ascending: true });

    if (selectedGroup !== "all") {
      logsQuery = logsQuery.eq("group_id", selectedGroup);
      summariesQuery = summariesQuery.eq("group_id", selectedGroup);
      snapshotsQuery = snapshotsQuery.eq("group_id", selectedGroup);
    }

    const [logsRes, summariesRes, snapshotsRes] = await Promise.all([
      logsQuery,
      summariesQuery,
      snapshotsQuery,
    ]);

    // Member ranking
    const logs = logsRes.data ?? [];
    const memberMap: Record<string, MemberRanking> = {};
    for (const log of logs) {
      if (!log.participant_jid) continue;
      const key = log.participant_jid;
      if (!memberMap[key]) {
        memberMap[key] = { jid: key, name: log.participant_name || key.split("@")[0], warnings: 0, bans: 0, total: 0 };
      }
      memberMap[key].total++;
      if (log.action_type === "warning") memberMap[key].warnings++;
      if (log.action_type === "ban") memberMap[key].bans++;
    }
    const ranked = Object.values(memberMap).sort((a, b) => b.total - a.total).slice(0, 15);
    setRanking(ranked);

    // Summaries
    setSummaries((summariesRes.data as DailySummary[]) ?? []);

    // Growth data
    const snapshots = snapshotsRes.data ?? [];
    setGrowthData(snapshots.map((s: any) => ({ date: s.snapshot_date, count: s.participant_count })));

    // Weekly moderation
    const weeks: Record<string, { avisos: number; bans: number }> = {};
    for (const log of logs) {
      const d = new Date(log.created_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().slice(5, 10);
      if (!weeks[key]) weeks[key] = { avisos: 0, bans: 0 };
      if (log.action_type === "warning") weeks[key].avisos++;
      if (log.action_type === "ban") weeks[key].bans++;
    }
    setWeeklyModeration(
      Object.entries(weeks)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, data]) => ({ week, ...data }))
    );

    setLoading(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-primary to-primary/20" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
              <p className="mt-0.5 text-sm text-muted-foreground/60">Relatórios e estatísticas detalhadas</p>
            </div>
          </div>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-[220px] bg-muted/30 border-border/50">
              <SelectValue placeholder="Filtrar por grupo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os grupos</SelectItem>
              {groups.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
        ) : (
          <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="visible">
            {/* Charts Row */}
            <div className="grid gap-5 lg:grid-cols-2">
              {/* Weekly Moderation */}
              <motion.div variants={cardVariants}>
                <Card className="glass-card overflow-hidden">
                  <CardHeader className="border-b border-border/20 pb-4">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                        <BarChart3 className="h-3.5 w-3.5 text-primary" />
                      </div>
                      Moderação Semanal
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {weeklyModeration.length === 0 ? (
                      <div className="h-48 flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
                        <BarChart3 className="h-8 w-8 opacity-20" />
                        <p className="text-xs">Sem dados ainda</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={weeklyModeration}>
                          <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(210 10% 45%)" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "hsl(210 10% 45%)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip contentStyle={{ background: "hsl(220 18% 7%)", border: "1px solid hsl(220 14% 12%)", borderRadius: "12px", fontSize: "11px" }} />
                          <Bar dataKey="avisos" name="Avisos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="bans" name="Bans" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Growth Chart */}
              <motion.div variants={cardVariants}>
                <Card className="glass-card overflow-hidden">
                  <CardHeader className="border-b border-border/20 pb-4">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                        <TrendingUp className="h-3.5 w-3.5 text-primary" />
                      </div>
                      Crescimento de Membros
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {growthData.length === 0 ? (
                      <div className="h-48 flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
                        <TrendingUp className="h-8 w-8 opacity-20" />
                        <p className="text-xs">Dados disponíveis após o primeiro resumo diário</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={growthData}>
                          <defs>
                            <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(174 72% 46%)" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="hsl(174 72% 46%)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(210 10% 45%)" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "hsl(210 10% 45%)" }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: "hsl(220 18% 7%)", border: "1px solid hsl(220 14% 12%)", borderRadius: "12px", fontSize: "11px" }} />
                          <Area type="monotone" dataKey="count" name="Membros" stroke="hsl(174 72% 46%)" fill="url(#growthGrad)" strokeWidth={2} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Bottom Row */}
            <div className="grid gap-5 lg:grid-cols-2">
              {/* Member Ranking */}
              <motion.div variants={cardVariants}>
                <Card className="glass-card overflow-hidden">
                  <CardHeader className="border-b border-border/20 pb-4">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
                        <Trophy className="h-3.5 w-3.5 text-amber-400" />
                      </div>
                      Ranking de Moderação (30 dias)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[340px]">
                      {ranking.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40 gap-2">
                          <Users className="h-8 w-8 opacity-20" />
                          <p className="text-xs">Sem dados de moderação</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border/10">
                          {ranking.map((member, i) => (
                            <div key={member.jid} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/10 transition-colors">
                              <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                                i === 0 ? "bg-amber-500/15 text-amber-400" :
                                i === 1 ? "bg-gray-400/15 text-gray-400" :
                                i === 2 ? "bg-orange-600/15 text-orange-500" :
                                "bg-muted/30 text-muted-foreground/50"
                              }`}>
                                {i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{member.name}</p>
                                <div className="flex gap-2 mt-0.5">
                                  {member.warnings > 0 && (
                                    <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                                      <AlertTriangle className="h-2.5 w-2.5" /> {member.warnings}
                                    </span>
                                  )}
                                  {member.bans > 0 && (
                                    <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                                      <Ban className="h-2.5 w-2.5" /> {member.bans}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-[10px]">{member.total} ações</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Daily Summaries */}
              <motion.div variants={cardVariants}>
                <Card className="glass-card overflow-hidden">
                  <CardHeader className="border-b border-border/20 pb-4">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                      </div>
                      Resumos Diários
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[340px]">
                      {summaries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40 gap-2">
                          <Calendar className="h-8 w-8 opacity-20" />
                          <p className="text-xs">Nenhum resumo gerado ainda</p>
                          <p className="text-[10px]">Os resumos são gerados automaticamente às 22h</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border/10">
                          {summaries.map(s => (
                            <div key={s.id} className="px-5 py-4 hover:bg-muted/10 transition-colors">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="text-[10px] border-primary/20 text-primary">{s.date}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground/70 leading-relaxed">{s.summary_text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
