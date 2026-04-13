import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Archive, Download, Upload, Trash2, Plus, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUpItem, pageHeader } from "@/lib/animations";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Group {
  id: string;
  name: string;
  rules_text: string | null;
  welcome_message: string | null;
}

interface Backup {
  id: string;
  name: string;
  source_group_name: string | null;
  rules_text: string | null;
  welcome_message: string | null;
  blocked_words: any[];
  whitelist_entries: any[];
  antiflood_settings: any;
  created_at: string;
}

export default function BackupPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Create backup form
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [backupName, setBackupName] = useState("");

  // Restore dialog
  const [restoreBackup, setRestoreBackup] = useState<Backup | null>(null);
  const [restoreTargetGroupId, setRestoreTargetGroupId] = useState("");

  useEffect(() => {
    if (!user) return;
    fetchAll();
  }, [user]);

  const fetchAll = async () => {
    const [groupsRes, backupsRes] = await Promise.all([
      supabase.from("groups").select("id, name, rules_text, welcome_message").order("name"),
      supabase.from("group_backups").select("*").order("created_at", { ascending: false }),
    ]);
    setGroups((groupsRes.data as Group[]) ?? []);
    setBackups((backupsRes.data as Backup[]) ?? []);
    setLoading(false);
  };

  const createBackup = async () => {
    if (!selectedGroupId || !backupName.trim()) {
      toast.error("Selecione um grupo e dê um nome ao backup");
      return;
    }
    setCreating(true);
    try {
      const group = groups.find(g => g.id === selectedGroupId);
      if (!group) throw new Error("Grupo não encontrado");

      // Fetch related data in parallel
      const [blockedRes, whitelistRes, antifloodRes] = await Promise.all([
        supabase.from("blocked_words").select("word, category, is_active").eq("user_id", user!.id),
        supabase.from("whitelist").select("participant_jid, participant_name").eq("group_id", selectedGroupId),
        supabase.from("antiflood_settings").select("is_enabled, max_messages, time_window_seconds").eq("group_id", selectedGroupId).maybeSingle(),
      ]);

      const { error } = await supabase.from("group_backups").insert({
        user_id: user!.id,
        name: backupName.trim(),
        source_group_name: group.name,
        rules_text: group.rules_text,
        welcome_message: group.welcome_message,
        blocked_words: blockedRes.data ?? [],
        whitelist_entries: whitelistRes.data ?? [],
        antiflood_settings: antifloodRes.data ?? null,
      });

      if (error) throw error;
      toast.success("Backup criado com sucesso!");
      setBackupName("");
      setSelectedGroupId("");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar backup");
    }
    setCreating(false);
  };

  const restoreToGroup = async () => {
    if (!restoreBackup || !restoreTargetGroupId) return;
    setRestoring(true);
    try {
      const backup = restoreBackup;

      // 1. Update group rules & welcome
      await supabase.from("groups").update({
        rules_text: backup.rules_text,
        welcome_message: backup.welcome_message,
      }).eq("id", restoreTargetGroupId);

      // 2. Insert blocked words (skip duplicates)
      if (Array.isArray(backup.blocked_words) && backup.blocked_words.length > 0) {
        const { data: existing } = await supabase.from("blocked_words").select("word").eq("user_id", user!.id);
        const existingWords = new Set((existing ?? []).map((e: any) => e.word.toLowerCase()));
        const newWords = backup.blocked_words.filter((w: any) => !existingWords.has(w.word.toLowerCase()));
        if (newWords.length > 0) {
          await supabase.from("blocked_words").insert(
            newWords.map((w: any) => ({ user_id: user!.id, word: w.word, category: w.category || "geral", is_active: w.is_active ?? true }))
          );
        }
      }

      // 3. Insert whitelist entries (skip duplicates)
      if (Array.isArray(backup.whitelist_entries) && backup.whitelist_entries.length > 0) {
        const { data: existing } = await supabase.from("whitelist").select("participant_jid").eq("group_id", restoreTargetGroupId);
        const existingJids = new Set((existing ?? []).map((e: any) => e.participant_jid));
        const newEntries = backup.whitelist_entries.filter((w: any) => !existingJids.has(w.participant_jid));
        if (newEntries.length > 0) {
          await supabase.from("whitelist").insert(
            newEntries.map((w: any) => ({ user_id: user!.id, group_id: restoreTargetGroupId, participant_jid: w.participant_jid, participant_name: w.participant_name }))
          );
        }
      }

      // 4. Upsert antiflood settings
      if (backup.antiflood_settings) {
        const af = backup.antiflood_settings;
        const { data: existingAf } = await supabase.from("antiflood_settings").select("id").eq("group_id", restoreTargetGroupId).maybeSingle();
        if (existingAf) {
          await supabase.from("antiflood_settings").update({
            is_enabled: af.is_enabled ?? true,
            max_messages: af.max_messages ?? 5,
            time_window_seconds: af.time_window_seconds ?? 10,
          }).eq("id", existingAf.id);
        } else {
          await supabase.from("antiflood_settings").insert({
            user_id: user!.id,
            group_id: restoreTargetGroupId,
            is_enabled: af.is_enabled ?? true,
            max_messages: af.max_messages ?? 5,
            time_window_seconds: af.time_window_seconds ?? 10,
          });
        }
      }

      toast.success("Backup restaurado com sucesso!");
      setRestoreBackup(null);
      setRestoreTargetGroupId("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao restaurar backup");
    }
    setRestoring(false);
  };

  const deleteBackup = async (id: string) => {
    await supabase.from("group_backups").delete().eq("id", id);
    toast.success("Backup excluído");
    fetchAll();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <motion.div {...pageHeader}>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Archive className="h-6 w-6 text-primary" />
            Backup & Restauração
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Exporte e replique configurações entre grupos</p>
        </motion.div>

        {/* Create Backup */}
        <motion.div variants={fadeUpItem} initial="hidden" animate="visible">
          <Card className="glass-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Criar Backup
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                  <SelectTrigger className="sm:w-[240px] bg-muted/30 border-border/50">
                    <SelectValue placeholder="Selecione um grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Nome do backup..."
                  value={backupName}
                  onChange={e => setBackupName(e.target.value)}
                  className="sm:w-[240px] bg-muted/30 border-border/50"
                />
                <Button onClick={createBackup} disabled={creating} className="gap-2">
                  <Download className="h-4 w-4" />
                  {creating ? "Criando..." : "Criar Backup"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Backups List */}
        <motion.div variants={fadeUpItem} initial="hidden" animate="visible" transition={{ delay: 0.1 }}>
          <Card className="glass-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Templates Salvos</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
              ) : backups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum backup criado ainda</p>
              ) : (
                <div className="space-y-3">
                  {backups.map(backup => (
                    <div key={backup.id} className="flex items-center justify-between gap-4 rounded-xl border border-border/30 bg-muted/10 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{backup.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {backup.source_group_name && (
                            <Badge variant="secondary" className="text-[10px]">
                              Fonte: {backup.source_group_name}
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(backup.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {backup.rules_text && <Badge variant="outline" className="text-[10px]">Regras</Badge>}
                          {backup.welcome_message && <Badge variant="outline" className="text-[10px]">Boas-vindas</Badge>}
                          {Array.isArray(backup.blocked_words) && backup.blocked_words.length > 0 && (
                            <Badge variant="outline" className="text-[10px]">{backup.blocked_words.length} palavras</Badge>
                          )}
                          {Array.isArray(backup.whitelist_entries) && backup.whitelist_entries.length > 0 && (
                            <Badge variant="outline" className="text-[10px]">{backup.whitelist_entries.length} whitelist</Badge>
                          )}
                          {backup.antiflood_settings && <Badge variant="outline" className="text-[10px]">Anti-flood</Badge>}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setRestoreBackup(backup)}>
                          <Upload className="h-3 w-3" />
                          Restaurar
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive/60 hover:text-destructive" onClick={() => deleteBackup(backup.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Restore Dialog */}
        <Dialog open={!!restoreBackup} onOpenChange={open => !open && setRestoreBackup(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Restaurar Backup: {restoreBackup?.name}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Selecione o grupo de destino para aplicar este template.</p>
            <Select value={restoreTargetGroupId} onValueChange={setRestoreTargetGroupId}>
              <SelectTrigger className="bg-muted/30 border-border/50">
                <SelectValue placeholder="Selecione o grupo destino" />
              </SelectTrigger>
              <SelectContent>
                {groups.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRestoreBackup(null)}>Cancelar</Button>
              <Button onClick={restoreToGroup} disabled={!restoreTargetGroupId || restoring} className="gap-2">
                <Upload className="h-4 w-4" />
                {restoring ? "Restaurando..." : "Aplicar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
