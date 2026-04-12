import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Wifi, WifiOff, Server, Copy } from "lucide-react";

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
  const [newUrl, setNewUrl] = useState("");
  const [newKey, setNewKey] = useState("");
  const [checking, setChecking] = useState<string | null>(null);

  const fetchInstances = async () => {
    const { data } = await supabase.from("instances").select("*").order("created_at");
    setInstances((data as Instance[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchInstances();
  }, [user]);

  const addInstance = async () => {
    if (!newName.trim() || !newUrl.trim() || !newKey.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    const { error } = await supabase.from("instances").insert({
      user_id: user!.id,
      name: newName.trim(),
      api_url: newUrl.trim().replace(/\/$/, ""),
      api_key: newKey.trim(),
    });
    if (error) {
      toast.error("Erro ao adicionar instância");
    } else {
      toast.success("Instância adicionada!");
      setNewName("");
      setNewUrl("");
      setNewKey("");
      fetchInstances();
    }
  };

  const checkConnection = async (inst: Instance) => {
    setChecking(inst.id);
    try {
      const res = await fetch(`${inst.api_url}/instance/connectionState/${inst.name}`, {
        headers: { apikey: inst.api_key },
      });
      const data = await res.json();
      const connected = data?.state === "open" || data?.instance?.state === "open";
      await supabase.from("instances").update({ is_connected: connected }).eq("id", inst.id);
      setInstances(prev => prev.map(i => i.id === inst.id ? { ...i, is_connected: connected } : i));
      toast[connected ? "success" : "error"](connected ? "Instância conectada!" : "Instância desconectada");
    } catch {
      toast.error("Erro ao verificar conexão");
    }
    setChecking(null);
  };

  const deleteInstance = async (id: string) => {
    await supabase.from("instances").delete().eq("id", id);
    toast.success("Instância removida!");
    fetchInstances();
  };

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsguard-webhook`;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie suas instâncias da Evolution API</p>
        </div>

        {/* Webhook URL */}
        <Card className="glass-card border-primary/15">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">URL do Webhook</CardTitle>
            <CardDescription className="text-xs">Configure este URL no webhook da sua instância</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input readOnly value={webhookUrl} className="font-mono text-xs bg-muted/30 border-border/50" />
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Copiado!"); }} className="border-border/50 shrink-0">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Add Instance */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Adicionar Instância
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nome da Instância</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="minha-instancia" className="bg-muted/30 border-border/50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">URL da API</Label>
                <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://api.example.com" className="bg-muted/30 border-border/50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">API Key</Label>
                <Input value={newKey} onChange={e => setNewKey(e.target.value)} type="password" placeholder="sua-api-key" className="bg-muted/30 border-border/50" />
              </div>
            </div>
            <Button className="mt-4 bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 shadow-lg shadow-primary/20" onClick={addInstance}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar
            </Button>
          </CardContent>
        </Card>

        {/* Instance List */}
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : instances.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                <Server className="h-8 w-8 opacity-30" />
                <p className="text-sm">Nenhuma instância configurada</p>
              </CardContent>
            </Card>
          ) : (
            instances.map(inst => (
              <Card key={inst.id} className="glass-card-hover">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${inst.is_connected ? "bg-primary/10" : "bg-destructive/10"}`}>
                      {inst.is_connected ? <Wifi className="h-4 w-4 text-primary" /> : <WifiOff className="h-4 w-4 text-destructive" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{inst.name}</p>
                      <p className="text-[11px] text-muted-foreground/50 font-mono">{inst.api_url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={inst.is_connected 
                      ? "bg-primary/15 text-primary border-primary/20" 
                      : "bg-red-500/15 text-red-400 border-red-500/20"
                    }>
                      {inst.is_connected ? "Conectado" : "Desconectado"}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => checkConnection(inst)} disabled={checking === inst.id} className="text-xs border-border/50">
                      {checking === inst.id ? "Verificando..." : "Verificar"}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteInstance(inst.id)} className="text-muted-foreground/30 hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
