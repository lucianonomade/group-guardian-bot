import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, AlertTriangle, Ban, Shield, Activity } from "lucide-react";

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
    { label: "Grupos Monitorados", value: stats.groups, icon: Users, color: "text-primary" },
    { label: "Avisos Dados", value: stats.warnings, icon: AlertTriangle, color: "text-[hsl(var(--warning))]" },
    { label: "Banimentos Ativos", value: stats.bans, icon: Ban, color: "text-destructive" },
    { label: "Palavras Bloqueadas", value: stats.blockedWords, icon: Shield, color: "text-accent-foreground" },
  ];

  const actionTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      warning: "⚠️ Aviso",
      ban: "🚫 Banimento",
      unban: "✅ Desbanimento",
      link_deleted: "🔗 Link Removido",
      word_deleted: "🚫 Palavra Proibida",
    };
    return map[type] || type;
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral da moderação dos seus grupos</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map(card => (
            <Card key={card.label} className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{loading ? "—" : card.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : recentLogs.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma atividade registrada ainda.</p>
            ) : (
              <div className="space-y-3">
                {recentLogs.map(log => (
                  <div key={log.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <div>
                      <span className="text-sm font-medium">{actionTypeLabel(log.action_type)}</span>
                      {log.participant_name && (
                        <span className="ml-2 text-sm text-muted-foreground">— {log.participant_name}</span>
                      )}
                      {log.details && (
                        <p className="mt-1 text-xs text-muted-foreground">{log.details}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
