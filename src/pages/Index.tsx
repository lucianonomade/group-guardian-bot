import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, AlertTriangle, Ban, Shield, Activity, TrendingUp } from "lucide-react";

interface Stats {
  groups: number;
  warnings: number;
  bans: number;
  blockedWords: number;
}

interface ActionLog {
  id: string;
  action_type: string;
  participant_name: string | null;
  participant_jid: string | null;
  details: string | null;
  created_at: string;
}

export default function Index() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ groups: 0, warnings: 0, bans: 0, blockedWords: 0 });
  const [recentLogs, setRecentLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [groups, warnings, bans, words, logs] = await Promise.all([
        supabase.from("groups").select("id", { count: "exact", head: true }),
        supabase.from("warnings").select("id", { count: "exact", head: true }),
        supabase.from("bans").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("blocked_words").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("action_logs").select("*").order("created_at", { ascending: false }).limit(10),
      ]);

      setStats({
        groups: groups.count ?? 0,
        warnings: warnings.count ?? 0,
        bans: bans.count ?? 0,
        blockedWords: words.count ?? 0,
      });
      setRecentLogs((logs.data as ActionLog[]) ?? []);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const statCards = [
    { label: "Grupos Monitorados", value: stats.groups, icon: Users, gradient: "from-primary/15 to-emerald-500/5", iconColor: "text-primary", borderColor: "border-primary/10" },
    { label: "Avisos Dados", value: stats.warnings, icon: AlertTriangle, gradient: "from-amber-500/15 to-orange-500/5", iconColor: "text-amber-400", borderColor: "border-amber-500/10" },
    { label: "Banimentos Ativos", value: stats.bans, icon: Ban, gradient: "from-red-500/15 to-rose-500/5", iconColor: "text-red-400", borderColor: "border-red-500/10" },
    { label: "Palavras Bloqueadas", value: stats.blockedWords, icon: Shield, gradient: "from-blue-500/15 to-cyan-500/5", iconColor: "text-blue-400", borderColor: "border-blue-500/10" },
  ];

  const actionTypeLabel = (type: string) => {
    const map: Record<string, { label: string; color: string }> = {
      warning: { label: "Aviso", color: "text-amber-400" },
      ban: { label: "Banimento", color: "text-red-400" },
      unban: { label: "Desbanimento", color: "text-emerald-400" },
      link_deleted: { label: "Link Removido", color: "text-blue-400" },
      word_deleted: { label: "Palavra Proibida", color: "text-purple-400" },
    };
    return map[type] || { label: type, color: "text-muted-foreground" };
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Visão geral da moderação dos seus grupos</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map(card => (
            <div key={card.label} className={`glass-card rounded-xl p-4 ${card.borderColor}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${card.gradient}`}>
                  <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                </div>
              </div>
              <p className="mt-3 text-3xl font-bold tracking-tight">{loading ? "—" : card.value}</p>
            </div>
          ))}
        </div>

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
              <div className="divide-y divide-border/30">
                {recentLogs.map(log => {
                  const { label, color } = actionTypeLabel(log.action_type);
                  return (
                    <div key={log.id} className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-muted/20">
                      <div className="flex items-center gap-3">
                        <div className={`h-1.5 w-1.5 rounded-full ${color.replace("text-", "bg-")}`} />
                        <div>
                          <span className={`text-xs font-semibold ${color}`}>{label}</span>
                          {log.participant_name && (
                            <span className="ml-2 text-xs text-foreground/70">— {log.participant_name}</span>
                          )}
                          {log.details && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{log.details}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground/60 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
