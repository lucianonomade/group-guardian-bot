import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Wifi, WifiOff, Server, QrCode, RefreshCw, Smartphone, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { pageHeader, fadeUpItem, staggerContainer, scaleUpItem } from "@/lib/animations";

interface Instance {
  id: string;
  name: string;
  api_url: string;
  api_key: string;
  is_connected: boolean;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [qrData, setQrData] = useState<{ instanceName: string; qrcode: string | null } | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchInstances = async () => {
    const { data } = await supabase.from("instances").select("*").order("created_at");
    setInstances((data as Instance[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchInstances();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user]);

  const invokeEvolution = async (action: string, opts: { method?: string; body?: any; params?: Record<string, string> } = {}) => {
    const { method = "GET", body, params = {} } = opts;
    const queryStr = new URLSearchParams({ action, ...params }).toString();
    const { data, error } = await supabase.functions.invoke(`evolution-manager?${queryStr}`, {
      method: method as any,
      body: body ? JSON.stringify(body) : undefined,
      headers: body ? { "Content-Type": "application/json" } : undefined,
    });
    if (error) throw error;
    return data;
  };

  const createInstance = async () => {
    if (!newName.trim()) {
      toast.error("Digite um nome para a instância");
      return;
    }
    setCreating(true);
    try {
      const data = await invokeEvolution("create", {
        method: "POST",
        body: { instanceName: newName.trim() },
      });

      if (data?.error) {
        toast.error(data.error);
        setCreating(false);
        return;
      }

      setQrData({ instanceName: data.instanceName, qrcode: data.qrcode });
      setQrDialogOpen(true);
      setNewName("");
      fetchInstances();

      // Start polling for connection
      startPolling(data.instanceName);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar instância");
    }
    setCreating(false);
  };

  const syncGroups = async (instanceName: string) => {
    try {
      const data = await invokeEvolution("sync-groups", { params: { instanceName } });
      if (data?.success) {
        toast.success(`${data.synced} grupo(s) sincronizado(s) automaticamente!`);
      }
    } catch {
      // Non-fatal: user can sync manually later
      console.log("Auto-sync groups failed, user can sync manually");
    }
  };

  const startPolling = (instanceName: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const data = await invokeEvolution("status", { params: { instanceName } });
        if (data?.connected) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setQrDialogOpen(false);
          setQrData(null);
          toast.success("WhatsApp conectado com sucesso!");
          fetchInstances();
          // Auto-sync groups after connection
          syncGroups(instanceName);
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);
  };

  const refreshQR = async (instanceName: string) => {
    try {
      const data = await invokeEvolution("qrcode", { params: { instanceName } });
      if (data?.qrcode) {
        setQrData({ instanceName, qrcode: data.qrcode });
      }
    } catch {
      toast.error("Erro ao atualizar QR Code");
    }
  };

  const reconnect = async (inst: Instance) => {
    setChecking(inst.id);
    try {
      const statusData = await invokeEvolution("status", { params: { instanceName: inst.name } });
      if (statusData?.connected) {
        toast.success("Instância já está conectada!");
        fetchInstances();
      } else {
        const data = await invokeEvolution("qrcode", { params: { instanceName: inst.name } });
        setQrData({ instanceName: inst.name, qrcode: data?.qrcode || null });
        setQrDialogOpen(true);
        startPolling(inst.name);
      }
    } catch {
      toast.error("Erro ao reconectar");
    }
    setChecking(null);
  };

  const checkStatus = async (inst: Instance) => {
    setChecking(inst.id);
    try {
      const data = await invokeEvolution("status", { params: { instanceName: inst.name } });
      await supabase.from("instances").update({ is_connected: data.connected }).eq("id", inst.id);
      setInstances(prev => prev.map(i => i.id === inst.id ? { ...i, is_connected: data.connected } : i));
      toast[data.connected ? "success" : "error"](data.connected ? "Conectado!" : "Desconectado");
    } catch {
      toast.error("Erro ao verificar");
    }
    setChecking(null);
  };

  const deleteInstance = async (inst: Instance) => {
    try {
      await invokeEvolution("delete", { method: "DELETE", params: { instanceName: inst.name } });
      toast.success("Instância removida!");
      fetchInstances();
    } catch {
      // Fallback: delete from DB only
      await supabase.from("instances").delete().eq("id", inst.id);
      toast.success("Instância removida!");
      fetchInstances();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <motion.div {...pageHeader}>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="mt-1 text-sm text-muted-foreground">Conecte seu WhatsApp escaneando o QR Code</p>
        </motion.div>

        {/* Create Instance */}
        <motion.div variants={fadeUpItem} initial="hidden" animate="visible">
          <Card className="glass-card border-primary/15">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                Conectar WhatsApp
              </CardTitle>
              <CardDescription className="text-xs">
                Digite um nome para sua instância e escaneie o QR Code com seu WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Nome da instância (ex: meu-whatsapp)"
                    className="bg-muted/30 border-border/50"
                    onKeyDown={e => e.key === "Enter" && createInstance()}
                  />
                </div>
                <Button
                  onClick={createInstance}
                  disabled={creating}
                  className="bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 shadow-lg shadow-primary/20"
                >
                  {creating ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <QrCode className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {creating ? "Criando..." : "Gerar QR Code"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* QR Code Dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={(open) => {
          setQrDialogOpen(open);
          if (!open && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }}>
          <DialogContent className="glass-card border-border/50 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <QrCode className="h-4 w-4 text-primary" />
                Escaneie o QR Code
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              {qrData?.qrcode ? (
                <>
                  <div className="rounded-2xl bg-white p-4 shadow-xl">
                    <img
                      src={qrData.qrcode.startsWith("data:") ? qrData.qrcode : `data:image/png;base64,${qrData.qrcode}`}
                      alt="QR Code"
                      className="h-64 w-64"
                    />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Abra o WhatsApp → Menu → Aparelhos Conectados → Conectar
                    </p>
                    <div className="flex items-center gap-2 justify-center">
                      <div className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                      </div>
                      <span className="text-[11px] text-amber-400 font-medium">Aguardando conexão...</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refreshQR(qrData.instanceName)}
                    className="border-border/50 text-xs"
                  >
                    <RefreshCw className="mr-1.5 h-3 w-3" /> Atualizar QR Code
                  </Button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Instance List */}
        <motion.div variants={fadeUpItem} initial="hidden" animate="visible" transition={{ delay: 0.15 }}>
          <Card className="glass-card overflow-hidden">
            <CardHeader className="border-b border-border/30 pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-4 w-4 text-primary" />
                Instâncias Conectadas
              </CardTitle>
              <CardDescription className="text-xs">{instances.length} instância(s)</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : instances.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                  <Smartphone className="h-8 w-8 opacity-20" />
                  <p className="text-sm">Nenhuma instância configurada</p>
                  <p className="text-[11px] text-muted-foreground/50">Crie uma acima para começar</p>
                </div>
              ) : (
                <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="divide-y divide-border/20">
                  {instances.map(inst => (
                    <motion.div
                      key={inst.id}
                      variants={scaleUpItem}
                      className="flex items-center justify-between p-4 transition-colors hover:bg-muted/10"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${inst.is_connected ? "bg-primary/10" : "bg-destructive/10"}`}>
                          {inst.is_connected ? <Wifi className="h-4 w-4 text-primary" /> : <WifiOff className="h-4 w-4 text-destructive" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{inst.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {inst.is_connected ? (
                              <div className="flex items-center gap-1">
                                <div className="relative flex h-1.5 w-1.5">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                </div>
                                <span className="text-[10px] text-emerald-400 font-medium">Online</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/50">Desconectado</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={inst.is_connected
                          ? "bg-primary/15 text-primary border-primary/20"
                          : "bg-red-500/15 text-red-400 border-red-500/20"
                        }>
                          {inst.is_connected ? "Conectado" : "Desconectado"}
                        </Badge>
                        {!inst.is_connected && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => reconnect(inst)}
                            disabled={checking === inst.id}
                            className="text-xs border-primary/30 text-primary hover:bg-primary/10"
                          >
                            {checking === inst.id ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <QrCode className="mr-1 h-3 w-3" />
                            )}
                            Reconectar
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => checkStatus(inst)}
                          disabled={checking === inst.id}
                          className="text-xs border-border/50"
                        >
                          <RefreshCw className={`h-3 w-3 ${checking === inst.id ? "animate-spin" : ""}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteInstance(inst)}
                          className="text-muted-foreground/30 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
