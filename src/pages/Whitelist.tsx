import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, Plus, Trash2, UserCheck, Download, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function Whitelist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [participantJid, setParticipantJid] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [filterGroupId, setFilterGroupId] = useState("all");
  const [importingGroupId, setImportingGroupId] = useState<string | null>(null);

  const { data: groups } = useQuery({
    queryKey: ["groups-with-instances", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*, instances(*)")
        .eq("user_id", user!.id)
        .eq("is_monitored", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: whitelist, isLoading } = useQuery({
    queryKey: ["whitelist", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whitelist")
        .select("*, groups(name)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const phone = participantJid.replace(/\D/g, "");
      if (!phone || !selectedGroupId) throw new Error("Preencha todos os campos");
      const jid = `${phone}@s.whatsapp.net`;
      const { error } = await supabase.from("whitelist").insert({
        user_id: user!.id,
        group_id: selectedGroupId,
        participant_jid: jid,
        participant_name: participantName || null,
      });
      if (error) {
        if (error.code === "23505") throw new Error("Este participante já está na whitelist deste grupo");
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whitelist"] });
      toast.success("Participante adicionado à whitelist!");
      setDialogOpen(false);
      setParticipantJid("");
      setParticipantName("");
      setSelectedGroupId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("whitelist").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whitelist"] });
      toast.success("Participante removido da whitelist");
    },
    onError: () => toast.error("Erro ao remover"),
  });

  const importAdmins = async (groupId: string) => {
    const group = groups?.find((g: any) => g.id === groupId);
    if (!group || !group.instances) return;
    
    setImportingGroupId(groupId);
    try {
      const instance = group.instances as any;
      const res = await fetch(
        `${instance.api_url}/group/participants/${instance.name}?groupJid=${group.group_jid}`,
        { headers: { apikey: instance.api_key } }
      );
      const data = await res.json();
      
      const participants = data?.participants || data || [];
      const admins = participants.filter(
        (p: any) => p.admin === "admin" || p.admin === "superadmin"
      );

      if (!admins.length) {
        toast.info("Nenhum admin encontrado neste grupo");
        return;
      }

      let added = 0;
      for (const admin of admins) {
        const jid = admin.phoneNumber || admin.id || admin.jid || "";
        const whatsappJid = jid.includes("@s.whatsapp.net") ? jid : "";
        if (!whatsappJid) continue;
        
        const { error } = await supabase.from("whitelist").upsert(
          {
            user_id: user!.id,
            group_id: groupId,
            participant_jid: whatsappJid,
            participant_name: admin.pushName || admin.name || null,
          },
          { onConflict: "user_id,group_id,participant_jid" }
        );
        if (!error) added++;
      }

      queryClient.invalidateQueries({ queryKey: ["whitelist"] });
      toast.success(`${added} admin(s) importado(s) para a whitelist!`);
    } catch (e) {
      console.error("Import admins error:", e);
      toast.error("Erro ao importar admins");
    } finally {
      setImportingGroupId(null);
    }
  };

  const filtered = filterGroupId === "all"
    ? whitelist
    : whitelist?.filter((w: any) => w.group_id === filterGroupId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Whitelist
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Participantes isentos da moderação automática
            </p>
          </div>

          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="border-border/50 text-xs">
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Importar Admins
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-border/50">
                <DialogHeader>
                  <DialogTitle className="text-base">Importar Admins do Grupo</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 pt-2">
                  <p className="text-xs text-muted-foreground">Selecione um grupo para importar admins automaticamente.</p>
                  {groups?.map((g: any) => (
                    <Button
                      key={g.id}
                      variant="outline"
                      className="w-full justify-between border-border/30 hover:border-primary/30 hover:bg-primary/5 text-sm"
                      disabled={importingGroupId === g.id}
                      onClick={() => importAdmins(g.id)}
                    >
                      {g.name}
                      {importingGroupId === g.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5 text-muted-foreground/40" />
                      )}
                    </Button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 shadow-lg shadow-primary/20 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-border/50">
                <DialogHeader>
                  <DialogTitle className="text-base">Adicionar à Whitelist</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Grupo</Label>
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                      <SelectTrigger className="bg-muted/30 border-border/50"><SelectValue placeholder="Selecione o grupo" /></SelectTrigger>
                      <SelectContent>
                        {groups?.map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Número do WhatsApp</Label>
                    <Input
                      placeholder="5511999999999"
                      value={participantJid}
                      onChange={(e) => setParticipantJid(e.target.value)}
                      className="bg-muted/30 border-border/50"
                    />
                    <p className="text-[10px] text-muted-foreground/50">País + DDD + número (sem espaços)</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Nome (opcional)</Label>
                    <Input
                      placeholder="Nome do participante"
                      value={participantName}
                      onChange={(e) => setParticipantName(e.target.value)}
                      className="bg-muted/30 border-border/50"
                    />
                  </div>
                  <Button className="w-full bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 shadow-lg shadow-primary/20" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
                    {addMutation.isPending ? "Adicionando..." : "Adicionar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="glass-card overflow-hidden">
          <CardHeader className="border-b border-border/30 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserCheck className="h-4 w-4 text-primary" />
                  Participantes na Whitelist
                </CardTitle>
                <CardDescription className="text-xs mt-1">{filtered?.length ?? 0} participante(s)</CardDescription>
              </div>
              <Select value={filterGroupId} onValueChange={setFilterGroupId}>
                <SelectTrigger className="w-[180px] bg-muted/30 border-border/50 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os grupos</SelectItem>
                  {groups?.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="text-center py-10 text-sm text-muted-foreground">Carregando...</p>
            ) : !filtered?.length ? (
              <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                <ShieldCheck className="h-8 w-8 opacity-20" />
                <p className="text-sm">Nenhum participante na whitelist</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30 hover:bg-transparent">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Nome</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Número</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Grupo</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 w-[60px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item: any) => (
                    <TableRow key={item.id} className="border-border/20 hover:bg-muted/10">
                      <TableCell className="text-sm font-medium">
                        {item.participant_name || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-muted/30 text-foreground/70 border-border/30 font-mono text-xs">
                          {item.participant_jid.replace("@s.whatsapp.net", "")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{(item as any).groups?.name || "—"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground/30 hover:text-destructive"
                          onClick={() => removeMutation.mutate(item.id)}
                          disabled={removeMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
