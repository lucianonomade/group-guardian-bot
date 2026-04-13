import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Search, Globe, Link2, Loader2, CheckCircle2, XCircle, UserPlus, Users } from "lucide-react";
import { motion } from "framer-motion";
import { pageHeader, fadeUpItem } from "@/lib/animations";

interface Instance {
  id: string;
  name: string;
}

interface GroupResult {
  link: string;
  inviteCode: string;
  valid: boolean;
  groupName?: string;
  size?: number;
  description?: string;
  error?: string;
  joined?: boolean;
}

export default function GroupFinder() {
  const { user } = useAuth();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState("");
  const [theme, setTheme] = useState("");
  const [manualLinks, setManualLinks] = useState("");
  const [mode, setMode] = useState<"search" | "manual">("search");
  const [searching, setSearching] = useState(false);
  const [validating, setValidating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [results, setResults] = useState<GroupResult[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<"input" | "results" | "done">("input");

  useEffect(() => {
    if (!user) return;
    supabase.from("instances").select("id, name").then(({ data }) => {
      setInstances((data as Instance[]) || []);
      if (data && data.length > 0) setSelectedInstance(data[0].name);
    });
  }, [user]);

  const instanceId = instances.find(i => i.name === selectedInstance)?.id || "";

  const handleSearch = async () => {
    if (!selectedInstance) return toast.error("Selecione uma instância");
    if (!theme.trim()) return toast.error("Digite um tema para buscar");

    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("group-finder", {
        body: { theme, instanceId },
        headers: { "Content-Type": "application/json" },
      });
      // Fix: pass action via query params
      const queryStr = new URLSearchParams({ action: "search" }).toString();
      const res = await supabase.functions.invoke(`group-finder?${queryStr}`, {
        method: "POST" as any,
        body: { theme, instanceId },
      });

      if (res.error) throw res.error;
      if (res.data?.links?.length > 0) {
        toast.success(`${res.data.links.length} links encontrados!`);
        await validateLinks(res.data.links, res.data.taskId);
      } else {
        toast.info("Nenhum link encontrado. Tente outro tema ou cole links manualmente.");
        setStep("input");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro na busca");
    }
    setSearching(false);
  };

  const handleManualLinks = async () => {
    if (!selectedInstance) return toast.error("Selecione uma instância");
    const links = manualLinks
      .split(/[\n,]+/)
      .map(l => l.trim())
      .filter(l => l.includes("chat.whatsapp.com/"));

    if (links.length === 0) return toast.error("Nenhum link válido encontrado");
    await validateLinks(links);
  };

  const validateLinks = async (links: string[], taskId?: string) => {
    setValidating(true);
    setStep("results");
    try {
      const queryStr = new URLSearchParams({ action: "validate" }).toString();
      const { data, error } = await supabase.functions.invoke(`group-finder?${queryStr}`, {
        method: "POST" as any,
        body: { links, instanceName: selectedInstance, taskId },
      });

      if (error) throw error;
      const validResults = (data?.results || []) as GroupResult[];
      setResults(validResults);

      const validCount = validResults.filter(r => r.valid).length;
      toast.success(`${validCount} de ${validResults.length} grupos válidos!`);

      // Auto-select all valid groups
      const validCodes = new Set(validResults.filter(r => r.valid).map(r => r.inviteCode));
      setSelectedCodes(validCodes);
    } catch (err: any) {
      toast.error(err.message || "Erro na validação");
    }
    setValidating(false);
  };

  const handleJoin = async () => {
    if (selectedCodes.size === 0) return toast.error("Selecione ao menos um grupo");
    setJoining(true);
    try {
      const queryStr = new URLSearchParams({ action: "join" }).toString();
      const { data, error } = await supabase.functions.invoke(`group-finder?${queryStr}`, {
        method: "POST" as any,
        body: { inviteCodes: Array.from(selectedCodes), instanceName: selectedInstance },
      });

      if (error) throw error;
      toast.success(`Entrou em ${data?.joined || 0} de ${data?.total || 0} grupos!`);
      setStep("done");

      // Update results with join status
      if (data?.results) {
        setResults(prev => prev.map(r => {
          const joinResult = data.results.find((jr: any) => jr.inviteCode === r.inviteCode);
          return joinResult ? { ...r, joined: joinResult.joined } : r;
        }));
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao entrar nos grupos");
    }
    setJoining(false);
  };

  const toggleCode = (code: string) => {
    setSelectedCodes(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const validResults = results.filter(r => r.valid);
  const invalidResults = results.filter(r => !r.valid);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <motion.div {...pageHeader}>
          <h1 className="text-2xl font-bold tracking-tight">Buscador de Grupos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Busque, valide e entre em grupos do WhatsApp automaticamente
          </p>
        </motion.div>

        {/* Instance selector */}
        <motion.div variants={fadeUpItem} initial="hidden" animate="visible" className="max-w-sm">
          <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Instância</label>
          <Select value={selectedInstance} onValueChange={setSelectedInstance}>
            <SelectTrigger className="bg-muted/30 border-border/50">
              <SelectValue placeholder="Selecione a instância" />
            </SelectTrigger>
            <SelectContent>
              {instances.map(inst => (
                <SelectItem key={inst.id} value={inst.name}>{inst.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {step === "input" && (
          <motion.div variants={fadeUpItem} initial="hidden" animate="visible" transition={{ delay: 0.1 }} className="grid gap-6 md:grid-cols-2">
            {/* Search by theme */}
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  Buscar por Tema
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Busca links de grupos no Google baseado no tema escolhido
                </p>
                <Input
                  placeholder="Ex: marketing digital, futebol, programação..."
                  value={theme}
                  onChange={e => setTheme(e.target.value)}
                  className="bg-muted/30 border-border/50"
                />
                <Button
                  onClick={handleSearch}
                  disabled={searching || !theme.trim() || !selectedInstance}
                  className="w-full gap-2"
                >
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {searching ? "Buscando..." : "Buscar Grupos"}
                </Button>
              </CardContent>
            </Card>

            {/* Manual links */}
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-primary" />
                  Colar Links
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Cole os links de convite para validar e entrar automaticamente
                </p>
                <Textarea
                  placeholder={"https://chat.whatsapp.com/ABC123\nhttps://chat.whatsapp.com/DEF456\n..."}
                  value={manualLinks}
                  onChange={e => setManualLinks(e.target.value)}
                  className="bg-muted/30 border-border/50 min-h-[100px]"
                  rows={4}
                />
                <Button
                  onClick={handleManualLinks}
                  disabled={validating || !manualLinks.trim() || !selectedInstance}
                  className="w-full gap-2"
                  variant="secondary"
                >
                  {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  {validating ? "Validando..." : "Validar e Entrar"}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {(step === "results" || step === "done") && (
          <motion.div variants={fadeUpItem} initial="hidden" animate="visible" className="space-y-4">
            {/* Valid groups */}
            {validResults.length > 0 && (
              <Card className="glass-card">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Grupos Válidos ({validResults.length})
                  </CardTitle>
                  {step === "results" && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const allCodes = validResults.map(r => r.inviteCode);
                          setSelectedCodes(prev => prev.size === allCodes.length ? new Set() : new Set(allCodes));
                        }}
                        className="text-xs"
                      >
                        {selectedCodes.size === validResults.length ? "Desmarcar Todos" : "Selecionar Todos"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleJoin}
                        disabled={joining || selectedCodes.size === 0}
                        className="gap-1.5"
                      >
                        {joining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                        {joining ? "Entrando..." : `Entrar em ${selectedCodes.size} grupo(s)`}
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {validResults.map((r, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border border-border/20 bg-muted/10 p-3 transition-colors hover:bg-muted/20">
                        {step === "results" && (
                          <Checkbox
                            checked={selectedCodes.has(r.inviteCode)}
                            onCheckedChange={() => toggleCode(r.inviteCode)}
                          />
                        )}
                        {step === "done" && (
                          r.joined
                            ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            : <XCircle className="h-4 w-4 text-destructive shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{r.groupName || "Grupo"}</span>
                            {r.size && (
                              <Badge variant="secondary" className="text-[10px] gap-1">
                                <Users className="h-2.5 w-2.5" />{r.size}
                              </Badge>
                            )}
                            {step === "done" && r.joined && (
                              <Badge className="bg-green-500/15 text-green-500 border-green-500/20 text-[10px]">Entrou</Badge>
                            )}
                          </div>
                          {r.description && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{r.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Invalid groups */}
            {invalidResults.length > 0 && (
              <Card className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                    <XCircle className="h-4 w-4 text-destructive/60" />
                    Links Inválidos ({invalidResults.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {invalidResults.map((r, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border border-border/10 bg-muted/5 p-2.5 text-sm text-muted-foreground">
                        <XCircle className="h-3.5 w-3.5 text-destructive/40 shrink-0" />
                        <span className="truncate text-xs">{r.link}</span>
                        <span className="text-[10px] text-destructive/50 ml-auto shrink-0">{r.error}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Back button */}
            <Button variant="outline" onClick={() => { setStep("input"); setResults([]); setSelectedCodes(new Set()); }}>
              Nova Busca
            </Button>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}