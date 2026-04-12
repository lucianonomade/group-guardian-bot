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
import { ShieldCheck, Plus, Trash2, UserCheck, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

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
      
      // Extract admin participants
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
        const jid = admin.id || admin.jid || "";
        if (!jid || !jid.includes("@s.whatsapp.net")) continue;
        
        const { error } = await supabase.from("whitelist").upsert(
          {
            user_id: user!.id,
            group_id: groupId,
            participant_jid: jid,
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
              <ShieldCheck className="h-6 w-6 text-primary" />
              Whitelist
            </h1>
            <p className="text-muted-foreground">
              Participantes isentos da moderação automática
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Adicionar</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar à Whitelist</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Grupo</Label>
                  <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o grupo" /></SelectTrigger>
                    <SelectContent>
                      {groups?.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Número do WhatsApp</Label>
                  <Input
                    placeholder="5511999999999"
                    value={participantJid}
                    onChange={(e) => setParticipantJid(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Código do país + DDD + número (sem espaços ou traços)</p>
                </div>
                <div className="space-y-2">
                  <Label>Nome (opcional)</Label>
                  <Input
                    placeholder="Nome do participante"
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
                  {addMutation.isPending ? "Adicionando..." : "Adicionar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Participantes na Whitelist
                </CardTitle>
                <CardDescription>{filtered?.length ?? 0} participante(s)</CardDescription>
              </div>
              <Select value={filterGroupId} onValueChange={setFilterGroupId}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os grupos</SelectItem>
                  {groups?.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : !filtered?.length ? (
              <p className="text-center py-8 text-muted-foreground">Nenhum participante na whitelist</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.participant_name || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {item.participant_jid.replace("@s.whatsapp.net", "")}
                        </Badge>
                      </TableCell>
                      <TableCell>{(item as any).groups?.name || "—"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMutation.mutate(item.id)}
                          disabled={removeMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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
