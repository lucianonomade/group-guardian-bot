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

  const warningColor = (num: number) => {
    if (num >= 2) return "destructive";
    if (num === 1) return "secondary";
    return "default";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Avisos</h1>
          <p className="text-muted-foreground">Histórico de avisos dados pelo bot</p>
        </div>

        <Card className="glass-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participante</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Aviso Nº</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : warnings.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum aviso registrado.</TableCell></TableRow>
                ) : (
                  warnings.map(w => (
                    <TableRow key={w.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{w.participant_name || w.participant_jid}</p>
                          <p className="text-xs text-muted-foreground">{w.participant_jid}</p>
                        </div>
                      </TableCell>
                      <TableCell>{w.groups?.name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {w.reason}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={warningColor(w.warning_number)}>
                          {w.warning_number}/2
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(w.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => resetWarnings(w.participant_jid, w.group_id)}>
                          <Trash2 className="h-4 w-4" />
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
