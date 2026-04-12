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
import { toast } from "sonner";
import { Users, Search, RefreshCw, MessageSquare, ShieldAlert, Eye } from "lucide-react";
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
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

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

    // Listen for realtime changes (auto-sync from background)
    const channel = supabase
      .channel('groups-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'groups' },
        () => {
          // Debounce to avoid multiple toasts during bulk sync
          if (debounceRef.current) clearTimeout(debounceRef.current);
          setSyncBanner(true);
          debounceRef.current = setTimeout(() => {
            fetchGroups();
            toast.success("Grupos atualizados automaticamente!", {
              description: "Uma sincronização em segundo plano foi concluída.",
              icon: <RefreshCw className="h-4 w-4 text-primary" />,
            });
            setTimeout(() => setSyncBanner(false), 3000);
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
          <div className="flex gap-2">
            {instances.map(inst => (
              <Button key={inst.id} onClick={() => syncGroups(inst)} disabled={syncing} size="sm" className="bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 shadow-lg shadow-primary/20">
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                Sincronizar
              </Button>
            ))}
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
                     <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Anti-flood</TableHead>
                     <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Status</TableHead>
                     <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Monitorar</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {loading ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">Carregando...</TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
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
                              onClick={() => { setAntifloodGroupId(group.id); setAntifloodGroupName(group.name); }}
                              className="text-xs gap-1.5 text-muted-foreground/50 hover:text-primary"
                            >
                              <ShieldAlert className="h-3 w-3" />
                              Configurar
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
        <AntifloodDialog
          groupId={antifloodGroupId}
          groupName={antifloodGroupName}
          onClose={() => setAntifloodGroupId(null)}
        />
       </div>
     </DashboardLayout>
   );
}
