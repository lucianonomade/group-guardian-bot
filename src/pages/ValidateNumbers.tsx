import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Phone, CheckCircle2, XCircle, Loader2, Copy, Download, Users } from "lucide-react";
import { motion } from "framer-motion";
import { pageHeader, fadeUpItem } from "@/lib/animations";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface ValidationResult {
  number: string;
  exists: boolean;
  jid: string | null;
}

export default function ValidateNumbers() {
  const { user } = useAuth();
  const [instanceId, setInstanceId] = useState("");
  const [numbersText, setNumbersText] = useState("");
  const [loading, setLoading] = useState(false);
  const [importingGroup, setImportingGroup] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [results, setResults] = useState<ValidationResult[] | null>(null);
  const [stats, setStats] = useState<{ total: number; valid: number; invalid: number } | null>(null);

  const { data: instances } = useQuery({
    queryKey: ["instances", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instances")
        .select("*")
        .eq("user_id", user!.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

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

  const importGroupMembers = async (groupId: string) => {
    const group = groups?.find((g: any) => g.id === groupId);
    if (!group || !group.instances) return;

    setImportingGroup(groupId);
    try {
      const instance = group.instances as any;
      const res = await fetch(
        `${instance.api_url}/group/participants/${instance.name}?groupJid=${group.group_jid}`,
        { headers: { apikey: instance.api_key } }
      );
      const data = await res.json();
      const participants = data?.participants || data || [];

      const numbers = participants
        .map((p: any) => {
          const jid = p.id || p.jid || p.phoneNumber || "";
          return jid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
        })
        .filter((n: string) => n.length >= 10);

      if (!numbers.length) {
        toast.info("Nenhum membro encontrado neste grupo");
        return;
      }

      const existing = numbersText.trim();
      const newText = existing ? `${existing}\n${numbers.join("\n")}` : numbers.join("\n");
      setNumbersText(newText);
      setImportDialogOpen(false);
      toast.success(`${numbers.length} número(s) importado(s) do grupo "${group.name}"`);
    } catch (e) {
      console.error("Import error:", e);
      toast.error("Erro ao importar membros do grupo");
    } finally {
      setImportingGroup(null);
    }
  };

  const handleValidate = async () => {
    if (!instanceId) {
      toast.error("Selecione uma instância");
      return;
    }

    const lines = numbersText
      .split(/[\n,;]+/)
      .map(l => l.trim())
      .filter(Boolean);

    if (!lines.length) {
      toast.error("Cole pelo menos um número");
      return;
    }

    if (lines.length > 500) {
      toast.error("Máximo de 500 números por vez");
      return;
    }

    setLoading(true);
    setResults(null);
    setStats(null);

    try {
      const { data, error } = await supabase.functions.invoke("validate-numbers", {
        body: { numbers: lines, instanceId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResults(data.results);
      setStats({ total: data.total, valid: data.valid, invalid: data.invalid });
      toast.success(`${data.valid} válido(s) de ${data.total} número(s)`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao validar");
    } finally {
      setLoading(false);
    }
  };

  const copyNumbers = (onlyValid: boolean) => {
    if (!results) return;
    const filtered = onlyValid ? results.filter(r => r.exists) : results.filter(r => !r.exists);
    const text = filtered.map(r => r.number).join("\n");
    navigator.clipboard.writeText(text);
    toast.success(`${filtered.length} número(s) copiado(s)`);
  };

  const downloadCSV = () => {
    if (!results) return;
    const csv = "Número,Status,JID\n" + results.map(r =>
      `${r.number},${r.exists ? "Válido" : "Inválido"},${r.jid || ""}`
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "validacao_whatsapp.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <motion.div {...pageHeader}>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Validar Números
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cole uma lista de números e descubra quais têm WhatsApp ativo
          </p>
        </motion.div>

        <motion.div variants={fadeUpItem} initial="hidden" animate="visible" transition={{ delay: 0.1 }}>
          <Card className="glass-card">
            <CardHeader className="border-b border-border/30 pb-4">
              <CardTitle className="text-base">Verificar Números</CardTitle>
              <CardDescription className="text-xs">
                Insira os números separados por linha, vírgula ou ponto-e-vírgula. Máximo 500.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Instância</Label>
                <Select value={instanceId} onValueChange={setInstanceId}>
                  <SelectTrigger className="bg-muted/30 border-border/50">
                    <SelectValue placeholder="Selecione a instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {instances?.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Números</Label>
                <Textarea
                  placeholder={"5511999999999\n5521988888888\n5531977777777"}
                  value={numbersText}
                  onChange={(e) => setNumbersText(e.target.value)}
                  className="bg-muted/30 border-border/50 min-h-[150px] font-mono text-sm"
                />
                <p className="text-[10px] text-muted-foreground/50">
                  Formato: código do país + DDD + número (ex: 5511999999999)
                </p>
              </div>

              <Button
                className="w-full bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 shadow-lg shadow-primary/20"
                onClick={handleValidate}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <Phone className="h-4 w-4 mr-2" />
                    Validar Números
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {stats && results && (
          <motion.div variants={fadeUpItem} initial="hidden" animate="visible" transition={{ delay: 0.2 }}>
            <Card className="glass-card overflow-hidden">
              <CardHeader className="border-b border-border/30 pb-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-base">Resultados</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {stats.total} verificado(s) · {stats.valid} válido(s) · {stats.invalid} inválido(s)
                    </CardDescription>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" className="text-xs border-border/50" onClick={() => copyNumbers(true)}>
                      <Copy className="h-3 w-3 mr-1" /> Copiar Válidos
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs border-border/50" onClick={() => copyNumbers(false)}>
                      <Copy className="h-3 w-3 mr-1" /> Copiar Inválidos
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs border-border/50" onClick={downloadCSV}>
                      <Download className="h-3 w-3 mr-1" /> CSV
                    </Button>
                  </div>
                </div>

                {/* Stats badges */}
                <div className="flex gap-3 mt-3">
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> {stats.valid} válidos
                  </Badge>
                  <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
                    <XCircle className="h-3 w-3 mr-1" /> {stats.invalid} inválidos
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30 hover:bg-transparent">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Número</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Status</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">JID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r, i) => (
                      <TableRow key={i} className="border-b border-border/20 hover:bg-muted/10">
                        <TableCell className="font-mono text-sm">{r.number}</TableCell>
                        <TableCell>
                          {r.exists ? (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Válido
                            </Badge>
                          ) : (
                            <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
                              <XCircle className="h-3 w-3 mr-1" /> Inválido
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {r.jid || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
