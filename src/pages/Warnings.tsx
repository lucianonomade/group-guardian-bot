import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";

interface Warning {
  id: string;
  participant_jid: string;
  participant_name: string | null;
  reason: string;
  message_content: string | null;
  warning_number: number;
  created_at: string;
  group_id: string;
  groups?: { name: string } | null;
}

export default function Warnings() {
  const { user } = useAuth();
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWarnings = async () => {
    const { data } = await supabase
      .from("warnings")
      .select("*, groups(name)")
      .order("created_at", { ascending: false });
    setWarnings((data as Warning[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchWarnings();
  }, [user]);

  const resetWarnings = async (participantJid: string, groupId: string) => {
    await supabase.from("warnings").delete().eq("participant_jid", participantJid).eq("group_id", groupId);
    toast.success("Avisos resetados!");
    fetchWarnings();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Avisos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Histórico de avisos dados pelo bot</p>
        </div>

        <Card className="glass-card overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Participante</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Grupo</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Motivo</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Aviso Nº</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Data</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">Carregando...</TableCell></TableRow>
                ) : warnings.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">Nenhum aviso registrado.</TableCell></TableRow>
                ) : (
                  warnings.map(w => (
                    <TableRow key={w.id} className="border-border/20 hover:bg-muted/10">
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{w.participant_name || w.participant_jid}</p>
                          <p className="text-[11px] text-muted-foreground/50 font-mono">{w.participant_jid}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{w.groups?.name || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="h-3 w-3 text-amber-400/70" />
                          <span className="text-xs">{w.reason}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={w.warning_number >= 2 
                          ? "bg-red-500/15 text-red-400 border-red-500/20 hover:bg-red-500/20" 
                          : "bg-amber-500/15 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                        }>
                          {w.warning_number}/2
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground/60">
                        {new Date(w.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => resetWarnings(w.participant_jid, w.group_id)} className="text-muted-foreground/50 hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
