import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Search, Users, AlertTriangle, Ban, ShieldCheck, Shield, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUpItem } from "@/lib/animations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Participant {
  jid: string;
  name: string;
  admin: string | null;
  warningCount?: number;
}

interface GroupInfo {
  id: string;
  name: string;
  group_jid: string;
  instance_id: string;
}

export default function GroupMembers() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !groupId) return;
    loadGroup();
  }, [user, groupId]);

  const loadGroup = async () => {
    const { data } = await supabase
      .from("groups")
      .select("id, name, group_jid, instance_id")
      .eq("id", groupId)
      .maybeSingle();

    if (!data) {
      toast.error("Grupo não encontrado");
      navigate("/groups");
      return;
    }
    setGroup(data as GroupInfo);
    await loadParticipants(data as GroupInfo);
  };

  const loadParticipants = async (g: GroupInfo) => {
    setLoading(true);
    try {
      // Get instance name
      const { data: inst } = await supabase
        .from("instances")
        .select("name")
        .eq("id", g.instance_id)
        .maybeSingle();

      if (!inst) throw new Error("Instância não encontrada");

      const queryStr = new URLSearchParams({
        action: "fetch-group-participants",
        instanceName: inst.name,
        groupJid: g.group_jid,
      }).toString();

      const { data, error } = await supabase.functions.invoke(
        `evolution-manager?${queryStr}`,
        { method: "GET" as any }
      );
      if (error) throw error;

      const parts: Participant[] = data?.participants || [];

      // Fetch warning counts for all participants
      const { data: warnings } = await supabase
        .from("warnings")
        .select("participant_jid")
        .eq("group_id", g.id);

      const warnMap = new Map<string, number>();
      (warnings || []).forEach((w: any) => {
        warnMap.set(w.participant_jid, (warnMap.get(w.participant_jid) || 0) + 1);
      });

      const enriched = parts.map((p) => ({
        ...p,
        warningCount: warnMap.get(p.jid) || 0,
      }));

      // Sort: admins first, then by warning count desc
      enriched.sort((a, b) => {
        if (a.admin && !b.admin) return -1;
        if (!a.admin && b.admin) return 1;
        return (b.warningCount || 0) - (a.warningCount || 0);
      });

      setParticipants(enriched);
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar membros");
    }
    setLoading(false);
  };

  const handleWarn = async (p: Participant) => {
    if (!group || !user) return;
    const reason = prompt("Motivo do aviso:");
    if (!reason) return;

    const newNum = (p.warningCount || 0) + 1;
    await supabase.from("warnings").insert({
      user_id: user.id,
      group_id: group.id,
      participant_jid: p.jid,
      participant_name: p.name,
      reason,
      warning_number: newNum,
    });
    toast.success(`Aviso ${newNum} dado para ${p.name}`);
    setParticipants((prev) =>
      prev.map((x) => (x.jid === p.jid ? { ...x, warningCount: newNum } : x))
    );
  };

  const handleResetWarnings = async (p: Participant) => {
    if (!group) return;
    await supabase.from("warnings").delete().eq("group_id", group.id).eq("participant_jid", p.jid);
    toast.success(`Avisos de ${p.name} resetados`);
    setParticipants((prev) =>
      prev.map((x) => (x.jid === p.jid ? { ...x, warningCount: 0 } : x))
    );
  };

  const handleBan = async (p: Participant) => {
    if (!group || !user) return;
    if (!confirm(`Banir ${p.name} do grupo?`)) return;

    await supabase.from("bans").insert({
      user_id: user.id,
      group_id: group.id,
      participant_jid: p.jid,
      participant_name: p.name,
      reason: "Banido manualmente via painel",
    });
    toast.success(`${p.name} registrado como banido`);
  };

  const handleWhitelist = async (p: Participant) => {
    if (!group || !user) return;
    const { data: existing } = await supabase
      .from("whitelist")
      .select("id")
      .eq("group_id", group.id)
      .eq("participant_jid", p.jid)
      .maybeSingle();

    if (existing) {
      toast.info(`${p.name} já está na whitelist`);
      return;
    }

    await supabase.from("whitelist").insert({
      user_id: user.id,
      group_id: group.id,
      participant_jid: p.jid,
      participant_name: p.name,
    });
    toast.success(`${p.name} adicionado à whitelist`);
  };

  const filtered = participants.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.jid.includes(search);
    const matchRole =
      roleFilter === "all" ||
      (roleFilter === "admin" && p.admin) ||
      (roleFilter === "member" && !p.admin) ||
      (roleFilter === "warned" && (p.warningCount || 0) > 0);
    return matchSearch && matchRole;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/groups")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Membros {group ? `- ${group.name}` : ""}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {participants.length} membros no grupo
            </p>
          </div>
          {group && (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={() => group && loadParticipants(group)}
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              placeholder="Buscar membro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-muted/30 border-border/50"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px] bg-muted/30 border-border/50">
              <SelectValue placeholder="Filtrar por..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
              <SelectItem value="member">Membros</SelectItem>
              <SelectItem value="warned">Com avisos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <motion.div variants={fadeUpItem} initial="hidden" animate="visible">
          <Card className="glass-card overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30 hover:bg-transparent">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Membro</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Role</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Avisos</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-10">
                        <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />
                        Carregando membros...
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-10">
                        Nenhum membro encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((p) => (
                      <TableRow key={p.jid} className="border-b border-border/20 hover:bg-muted/10">
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{p.name}</p>
                            <p className="text-xs text-muted-foreground/50">{p.jid.split("@")[0]}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {p.admin ? (
                            <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/20 gap-1">
                              <Shield className="h-3 w-3" />
                              {p.admin === "superadmin" ? "Super Admin" : "Admin"}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Membro</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {(p.warningCount || 0) > 0 ? (
                            <Badge variant="destructive" className="bg-destructive/15 text-destructive border-destructive/20 gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {p.warningCount}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-amber-500 hover:text-amber-600" onClick={() => handleWarn(p)} title="Dar aviso">
                              <AlertTriangle className="h-3 w-3" />
                            </Button>
                            {(p.warningCount || 0) > 0 && (
                              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-primary hover:text-primary/80" onClick={() => handleResetWarnings(p)} title="Resetar avisos">
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-destructive hover:text-destructive/80" onClick={() => handleBan(p)} title="Banir">
                              <Ban className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground" onClick={() => handleWhitelist(p)} title="Whitelist">
                              <ShieldCheck className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
