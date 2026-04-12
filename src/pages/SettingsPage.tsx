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
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">Gerencie suas instâncias da Evolution API</p>
        </div>

        {/* Webhook URL */}
        <Card className="glass-card border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">URL do Webhook</CardTitle>
            <CardDescription>Configure este URL no webhook da sua instância Evolution API</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input readOnly value={webhookUrl} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Copiado!"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              No painel da Evolution API, configure o webhook para enviar eventos de mensagens para este URL.
            </p>
          </CardContent>
        </Card>

        {/* Add Instance */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Adicionar Instância
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Nome da Instância</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="minha-instancia" />
              </div>
              <div className="space-y-2">
                <Label>URL da API</Label>
                <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://api.evolution.example.com" />
              </div>
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input value={newKey} onChange={e => setNewKey(e.target.value)} type="password" placeholder="sua-api-key" />
              </div>
            </div>
            <Button className="mt-4" onClick={addInstance}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar
            </Button>
          </CardContent>
        </Card>

        {/* Instance List */}
        <div className="space-y-3">
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : instances.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Server className="h-8 w-8" />
                <p>Nenhuma instância configurada</p>
              </CardContent>
            </Card>
          ) : (
            instances.map(inst => (
              <Card key={inst.id} className="glass-card">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${inst.is_connected ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                      {inst.is_connected ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="font-medium">{inst.name}</p>
                      <p className="text-xs text-muted-foreground">{inst.api_url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={inst.is_connected ? "default" : "destructive"}>
                      {inst.is_connected ? "Conectado" : "Desconectado"}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => checkConnection(inst)} disabled={checking === inst.id}>
                      {checking === inst.id ? "Verificando..." : "Verificar"}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteInstance(inst.id)}>
                      <Trash2 className="h-4 w-4" />
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
