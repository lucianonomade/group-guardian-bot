import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WelcomeMessageDialog } from "@/components/WelcomeMessageDialog";
import { AntifloodDialog } from "@/components/AntifloodDialog";
import { GroupRulesDialog } from "@/components/GroupRulesDialog";
import { toast } from "sonner";
import { Users, Search, RefreshCw, MessageSquare, ShieldAlert, Eye, BookOpen, Archive } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { pageHeader, fadeUpItem, tableRowItem } from "@/lib/animations";

interface Group {
  id: string;
  group_jid: string;
  name: string;
  is_monitored: boolean;
  participant_count: number;
  instance_id: string;
  welcome_message: string | null;
  rules_text: string | null;
}

interface Instance {
  id: string;
  name: string;
  api_url: string;
  api_key: string;
}

export default function Groups() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncBanner, setSyncBanner] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [antifloodGroupId, setAntifloodGroupId] = useState<string | null>(null);
  const [antifloodGroupName, setAntifloodGroupName] = useState("");
  const [rulesGroupId, setRulesGroupId] = useState<string | null>(null);
  const [rulesGroupName, setRulesGroupName] = useState("");
  const [rulesGroupText, setRulesGroupText] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchGroups = async () => {
    const { data } = await supabase.from("groups").select("*").order("name");
    setGroups((data as Group[]) ?? []);
    setLoading(false);
  };

  const fetchInstances = async (): Promise<Instance[]> => {
    const { data } = await supabase.from("instances").select("*");
    const insts = (data as Instance[]) ?? [];
    setInstances(insts);
    return insts;
  };

  // Auto-sync in background when page opens
  const autoSync = async (insts: Instance[]) => {
    if (insts.length === 0) return;
    setSyncing(true);
    setSyncBanner(true);
    let totalSynced = 0;
    for (const inst of insts) {
      try {
        const queryStr = new URLSearchParams({ action: "sync-groups", instanceName: inst.name }).toString();
        const { data, error } = await supabase.functions.invoke(`evolution-manager?${queryStr}`, { method: "GET" as any });
        if (data?.error) {
          const detail = data.detail || data.error;
          if (detail?.includes?.("Connection Closed")) {
            toast.error(`Instância "${inst.name}" desconectada. Reconecte nas configurações.`);
          }
        } else if (!error && data?.synced) {
          totalSynced += data.synced;
        }
      } catch {}
    }
    await fetchGroups();
    setSyncing(false);
    if (totalSynced > 0) {
      toast.success(`${totalSynced} grupos sincronizados automaticamente!`, {
        icon: <RefreshCw className="h-4 w-4 text-primary" />,
      });
    }
    setTimeout(() => setSyncBanner(false), 2000);
  };

  useEffect(() => {
    if (!user) return;

    const init = async () => {
      await fetchGroups();
      const insts = await fetchInstances();
      autoSync(insts);
    };
    init();

    // Listen for realtime changes
    const channel = supabase
      .channel('groups-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'groups' },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            fetchGroups();
          }, 2000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [user]);

  const syncGroups = async (instance: Instance) => {
    setSyncing(true);
    try {
      const queryStr = new URLSearchParams({ action: "sync-groups", instanceName: instance.name }).toString();
      const { data, error } = await supabase.functions.invoke(`evolution-manager?${queryStr}`, { method: "GET" as any });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${data.synced} grupos sincronizados!`);
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

  const handleWelcomeSaved = (groupId: string, message: string | null) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, welcome_message: message } : g));
  };

  const handleRulesSaved = (groupId: string, rules: string | null) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, rules_text: rules } : g));
  };

  const filtered = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <AnimatePresence>
          {syncBanner && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3"
            >
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-primary font-medium">Sincronização automática em andamento...</span>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div {...pageHeader} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Grupos</h1>
            <p className="mt-1 text-sm text-muted-foreground">Gerencie os grupos monitorados</p>
          </div>
        </motion.div>

        <motion.div variants={fadeUpItem} initial="hidden" animate="visible" className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <Input placeholder="Buscar grupo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-muted/30 border-border/50" />
        </motion.div>

        <motion.div variants={fadeUpItem} initial="hidden" animate="visible" transition={{ delay: 0.15 }}>
          <Card className="glass-card overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                   <TableRow className="border-border/30 hover:bg-transparent">
                     <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Nome</TableHead>
                     <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Membros</TableHead>
                     <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Boas-vindas</TableHead>
                     <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Regras</TableHead>
                     <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Anti-flood</TableHead>
                     <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Status</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Backup</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Monitorar</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {loading ? (
                       <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">Carregando...</TableCell></TableRow>
                     ) : filtered.length === 0 ? (
                       <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">
                        {instances.length === 0 ? "Configure uma instância primeiro" : "Nenhum grupo encontrado"}
                     </TableCell></TableRow>
                   ) : (
                     filtered.map((group, i) => (
                       <motion.tr
                         key={group.id}
                         variants={tableRowItem}
                         initial="hidden"
                         animate="visible"
                         transition={{ delay: 0.2 + i * 0.04, duration: 0.3 }}
                         className="border-b border-border/20 hover:bg-muted/10 transition-colors"
                       >
                          <TableCell>
                            <button
                              className="font-medium text-sm hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer"
                              onClick={() => navigate(`/groups/${group.id}/members`)}
                            >
                              {group.name}
                              <Eye className="h-3 w-3 text-muted-foreground/40" />
                            </button>
                          </TableCell>
                         <TableCell>
                           <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                             <Users className="h-3 w-3" />
                             {group.participant_count}
                           </div>
                         </TableCell>
                         <TableCell>
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => setEditingGroup(group)}
                             className={`text-xs gap-1.5 ${group.welcome_message ? "text-primary" : "text-muted-foreground/50"}`}
                           >
                             <MessageSquare className="h-3 w-3" />
                             {group.welcome_message ? "Configurada" : "Configurar"}
                           </Button>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setRulesGroupId(group.id); setRulesGroupName(group.name); setRulesGroupText(group.rules_text); }}
                              className={`text-xs gap-1.5 ${group.rules_text ? "text-primary" : "text-muted-foreground/50"}`}
                            >
                              <BookOpen className="h-3 w-3" />
                              {group.rules_text ? "Configuradas" : "Configurar"}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setAntifloodGroupId(group.id); setAntifloodGroupName(group.name); }}
                              className="text-xs gap-1.5 text-muted-foreground/50 hover:text-primary"
                            >
                              <ShieldAlert className="h-3 w-3" />
                              Configurar
                            </Button>
                           </TableCell>
                           <TableCell>
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={async () => {
                                 try {
                                   const [blockedRes, whitelistRes, antifloodRes] = await Promise.all([
                                     supabase.from("blocked_words").select("word, category, is_active").eq("user_id", user!.id),
                                     supabase.from("whitelist").select("participant_jid, participant_name").eq("group_id", group.id),
                                     supabase.from("antiflood_settings").select("is_enabled, max_messages, time_window_seconds").eq("group_id", group.id).maybeSingle(),
                                   ]);
                                   const { error } = await supabase.from("group_backups").insert({
                                     user_id: user!.id,
                                     name: `Backup - ${group.name}`,
                                     source_group_name: group.name,
                                     rules_text: group.rules_text,
                                     welcome_message: group.welcome_message,
                                     blocked_words: blockedRes.data ?? [],
                                     whitelist_entries: whitelistRes.data ?? [],
                                     antiflood_settings: antifloodRes.data ?? null,
                                   });
                                   if (error) throw error;
                                   toast.success("Backup criado com sucesso!");
                                 } catch (err: any) {
                                   toast.error(err.message || "Erro ao criar backup");
                                 }
                               }}
                               className="text-xs gap-1.5 text-muted-foreground/50 hover:text-primary"
                             >
                               <Archive className="h-3 w-3" />
                               Exportar
                             </Button>
                           </TableCell>
                          <TableCell>
                            <Badge variant={group.is_monitored ? "default" : "secondary"} className={group.is_monitored ? "bg-primary/15 text-primary border-primary/20 hover:bg-primary/20" : ""}>
                              {group.is_monitored ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                         <TableCell>
                           <Switch checked={group.is_monitored} onCheckedChange={() => toggleMonitor(group)} />
                         </TableCell>
                       </motion.tr>
                     ))
                   )}
                 </TableBody>
               </Table>
             </CardContent>
           </Card>
         </motion.div>

        <WelcomeMessageDialog
          group={editingGroup}
          onClose={() => setEditingGroup(null)}
          onSaved={handleWelcomeSaved}
        />
         <GroupRulesDialog
           groupId={rulesGroupId}
           groupName={rulesGroupName}
           currentRules={rulesGroupText}
           onClose={() => setRulesGroupId(null)}
           onSaved={handleRulesSaved}
         />
       </div>
     </DashboardLayout>
   );
}
