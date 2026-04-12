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
          <h1 className="text-2xl font-bold tracking-tight">Banimentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Usuários banidos dos grupos</p>
        </div>

        <Card className="glass-card overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Participante</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Grupo</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Motivo</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Status</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Data</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">Carregando...</TableCell></TableRow>
                ) : bans.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">Nenhum banimento registrado.</TableCell></TableRow>
                ) : (
                  bans.map(b => (
                    <TableRow key={b.id} className="border-border/20 hover:bg-muted/10">
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{b.participant_name || b.participant_jid}</p>
                          <p className="text-[11px] text-muted-foreground/50 font-mono">{b.participant_jid}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{b.groups?.name || "—"}</TableCell>
                      <TableCell className="text-xs">{b.reason}</TableCell>
                      <TableCell>
                        <Badge className={b.is_active 
                          ? "bg-red-500/15 text-red-400 border-red-500/20 hover:bg-red-500/20" 
                          : "bg-muted text-muted-foreground border-border"
                        }>
                          {b.is_active ? "Banido" : "Desbanido"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground/60">
                        {new Date(b.banned_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        {b.is_active && (
                          <Button variant="outline" size="sm" onClick={() => unban(b)} className="text-xs border-border/50 hover:border-primary/30 hover:text-primary">
                            <UserCheck className="mr-1.5 h-3 w-3" />
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
