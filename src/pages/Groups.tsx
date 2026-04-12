import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Users, Search, RefreshCw } from "lucide-react";

interface Group {
  id: string;
  group_jid: string;
  name: string;
  is_monitored: boolean;
  participant_count: number;
  instance_id: string;
}

interface Instance {
  id: string;
  name: string;
  api_url: string;
  api_key: string;
}

export default function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchGroups = async () => {
    const { data } = await supabase.from("groups").select("*").order("name");
    setGroups((data as Group[]) ?? []);
    setLoading(false);
  };

  const fetchInstances = async () => {
    const { data } = await supabase.from("instances").select("*");
    setInstances((data as Instance[]) ?? []);
  };

  useEffect(() => {
    if (!user) return;
    fetchGroups();
    fetchInstances();
  }, [user]);

  const syncGroups = async (instance: Instance) => {
    setSyncing(true);
    try {
      const res = await fetch(`${instance.api_url}/group/fetchAllGroups/${instance.name}?getParticipants=true`, {
        headers: { apikey: instance.api_key },
      });
      if (!res.ok) throw new Error("Falha ao buscar grupos");
      const data = await res.json();
      const groupsData = Array.isArray(data) ? data : data?.data || [];

      const infoRes = await fetch(`${instance.api_url}/instance/fetchInstances`, {
        headers: { apikey: instance.api_key },
      });
      const instancesData = await infoRes.json();
      const thisInstance = Array.isArray(instancesData) 
        ? instancesData.find((i: any) => i.name === instance.name)
        : null;
      const ownerJid = thisInstance?.ownerJid || "";

      let syncedCount = 0;
      const adminJids = new Set<string>();

      for (const g of groupsData) {
        const jid = g.id || g.jid;
        const name = g.subject || g.name || jid;
        const count = g.size || g.participants?.length || 0;
        const participants = g.participants || [];

        const isAdmin = participants.some((p: any) => 
          (p.phoneNumber === ownerJid || p.id === ownerJid) && 
          (p.admin === "admin" || p.admin === "superadmin")
        );

        if (!isAdmin) continue;

        adminJids.add(jid);
        syncedCount++;

        const { data: existing } = await supabase
          .from("groups")
          .select("id")
          .eq("group_jid", jid)
          .eq("instance_id", instance.id)
          .maybeSingle();

        if (existing) {
          await supabase.from("groups").update({ name, participant_count: count }).eq("id", existing.id);
        } else {
          await supabase.from("groups").insert({
            user_id: user!.id,
            instance_id: instance.id,
            group_jid: jid,
            name,
            participant_count: count,
            is_monitored: true,
          });
        }
      }

      const { data: existingGroups } = await supabase
        .from("groups")
        .select("id, group_jid")
        .eq("instance_id", instance.id);

      if (existingGroups) {
        for (const eg of existingGroups) {
          if (!adminJids.has(eg.group_jid)) {
            await supabase.from("groups").delete().eq("id", eg.id);
          }
        }
      }

      toast.success(`${syncedCount} grupos onde você é admin sincronizados!`);
      fetchGroups();
    } catch (err: any) {
      toast.error(err.message || "Erro ao sincronizar");
    }
    setSyncing(false);
  };

  const toggleMonitor = async (group: Group) => {
    await supabase.from("groups").update({ is_monitored: !group.is_monitored }).eq("id", group.id);
    setGroups(prev => prev.map(g => g.id === group.id ? { ...g, is_monitored: !g.is_monitored } : g));
  };

  const filtered = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Grupos</h1>
            <p className="mt-1 text-sm text-muted-foreground">Gerencie os grupos monitorados</p>
          </div>
          <div className="flex gap-2">
            {instances.map(inst => (
              <Button key={inst.id} onClick={() => syncGroups(inst)} disabled={syncing} size="sm" className="bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 shadow-lg shadow-primary/20">
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                Sincronizar
              </Button>
            ))}
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <Input placeholder="Buscar grupo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-muted/30 border-border/50" />
        </div>

        <Card className="glass-card overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Nome</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">JID</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Membros</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Status</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Monitorar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
                    {instances.length === 0 ? "Configure uma instância primeiro" : "Nenhum grupo encontrado"}
                  </TableCell></TableRow>
                ) : (
                  filtered.map(group => (
                    <TableRow key={group.id} className="border-border/20 hover:bg-muted/10">
                      <TableCell className="font-medium text-sm">{group.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground/60 font-mono">{group.group_jid}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {group.participant_count}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={group.is_monitored ? "default" : "secondary"} className={group.is_monitored ? "bg-primary/15 text-primary border-primary/20 hover:bg-primary/20" : ""}>
                          {group.is_monitored ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch checked={group.is_monitored} onCheckedChange={() => toggleMonitor(group)} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
