import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Ban, UserCheck } from "lucide-react";

interface BanRecord {
  id: string;
  participant_jid: string;
  participant_name: string | null;
  reason: string;
  is_active: boolean;
  banned_at: string;
  unbanned_at: string | null;
  group_id: string;
  groups?: { name: string } | null;
}

export default function Bans() {
  const { user } = useAuth();
  const [bans, setBans] = useState<BanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBans = async () => {
    const { data } = await supabase
      .from("bans")
      .select("*, groups(name)")
      .order("banned_at", { ascending: false });
    setBans((data as BanRecord[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchBans();
  }, [user]);

  const unban = async (ban: BanRecord) => {
    await supabase
      .from("bans")
      .update({ is_active: false, unbanned_at: new Date().toISOString() })
      .eq("id", ban.id);
    toast.success(`${ban.participant_name || ban.participant_jid} desbanido!`);
    fetchBans();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Banimentos</h1>
          <p className="text-muted-foreground">Usuários banidos dos grupos</p>
        </div>

        <Card className="glass-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participante</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : bans.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum banimento registrado.</TableCell></TableRow>
                ) : (
                  bans.map(b => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{b.participant_name || b.participant_jid}</p>
                          <p className="text-xs text-muted-foreground">{b.participant_jid}</p>
                        </div>
                      </TableCell>
                      <TableCell>{b.groups?.name || "—"}</TableCell>
                      <TableCell className="text-sm">{b.reason}</TableCell>
                      <TableCell>
                        <Badge variant={b.is_active ? "destructive" : "secondary"}>
                          {b.is_active ? "Banido" : "Desbanido"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(b.banned_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        {b.is_active && (
                          <Button variant="outline" size="sm" onClick={() => unban(b)}>
                            <UserCheck className="mr-1 h-4 w-4" />
                            Desbanir
                          </Button>
                        )}
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
