import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Megaphone, Search, ImagePlus, Send, Loader2, Trash2, Clock, CheckCircle, XCircle, Users, RefreshCw, CalendarIcon, Timer } from "lucide-react";
import { motion } from "framer-motion";
import { pageHeader, fadeUpItem, staggerContainer, scaleUpItem } from "@/lib/animations";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Instance {
  id: string;
  name: string;
  is_connected: boolean;
}

interface AvailableGroup {
  jid: string;
  name: string;
  size: number;
}

interface Broadcast {
  id: string;
  message: string;
  image_url: string | null;
  target_groups: string[];
  status: string;
  sent_count: number;
  total_count: number;
  created_at: string;
  scheduled_at: string | null;
}

export default function BroadcastPage() {
  const { user } = useAuth();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [availableGroups, setAvailableGroups] = useState<AvailableGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [searchGroups, setSearchGroups] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledHour, setScheduledHour] = useState("12");
  const [scheduledMinute, setScheduledMinute] = useState("00");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    fetchInstances();
    fetchHistory();
  }, [user]);

  const fetchInstances = async () => {
    const { data } = await supabase.from("instances").select("id, name, is_connected").eq("is_connected", true);
    const list = (data as Instance[]) ?? [];
    setInstances(list);
    if (list.length === 1) {
      setSelectedInstance(list[0]);
      fetchAllGroups(list[0].name);
    }
  };

  const fetchHistory = async () => {
    const { data } = await supabase.from("broadcasts").select("*").order("created_at", { ascending: false }).limit(20);
    setHistory((data as Broadcast[]) ?? []);
  };

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

  const fetchAllGroups = async (instanceName: string) => {
    setLoadingGroups(true);
    try {
      const data = await invokeEvolution("fetch-all-groups", { params: { instanceName } });
      setAvailableGroups(data?.groups ?? []);
    } catch {
      toast.error("Erro ao buscar grupos");
    }
    setLoadingGroups(false);
  };

  const selectInstance = (inst: Instance) => {
    setSelectedInstance(inst);
    setSelectedGroups(new Set());
    fetchAllGroups(inst.name);
  };

  const toggleGroup = (jid: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(jid)) next.delete(jid);
      else next.add(jid);
      return next;
    });
  };

  const selectAll = () => {
    const filtered = filteredGroups;
    if (filtered.every(g => selectedGroups.has(g.jid))) {
      setSelectedGroups(prev => {
        const next = new Set(prev);
        filtered.forEach(g => next.delete(g.jid));
        return next;
      });
    } else {
      setSelectedGroups(prev => {
        const next = new Set(prev);
        filtered.forEach(g => next.add(g.jid));
        return next;
      });
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const sendBroadcast = async () => {
    if (!selectedInstance || selectedGroups.size === 0 || !message.trim()) {
      toast.error("Selecione grupos e escreva uma mensagem");
      return;
    }

    setSending(true);
    try {
      let imageUrl: string | null = null;

      // Upload image if present
      if (imageFile && user) {
        const ext = imageFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("broadcast-images")
          .upload(path, imageFile, { contentType: imageFile.type });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("broadcast-images").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      // Build scheduled_at timestamp
      let scheduledAt: string | null = null;
      if (isScheduled && scheduledDate) {
        const dt = new Date(scheduledDate);
        dt.setHours(parseInt(scheduledHour), parseInt(scheduledMinute), 0, 0);
        if (dt <= new Date()) {
          toast.error("A data/hora deve ser no futuro");
          setSending(false);
          return;
        }
        scheduledAt = dt.toISOString();
      }

      // Create broadcast record
      const { data: broadcast, error: insertError } = await supabase
        .from("broadcasts")
        .insert({
          user_id: user!.id,
          instance_id: selectedInstance.id,
          message: message.trim(),
          image_url: imageUrl,
          target_groups: Array.from(selectedGroups),
          status: scheduledAt ? "scheduled" : "pending",
          total_count: selectedGroups.size,
          scheduled_at: scheduledAt,
        } as any)
        .select()
        .single();

      if (insertError) throw insertError;

      if (scheduledAt) {
        toast.success(`Divulgação agendada para ${format(new Date(scheduledAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}!`);
      } else {
        // Trigger send immediately
        const result = await invokeEvolution("send-broadcast", {
          method: "POST",
          body: { broadcastId: broadcast.id },
        });
        toast.success(`Divulgação enviada para ${result.sent}/${result.total} grupos!`);
      }

      // Reset form
      setMessage("");
      removeImage();
      setSelectedGroups(new Set());
      setIsScheduled(false);
      setScheduledDate(undefined);
      setScheduledHour("12");
      setScheduledMinute("00");
      fetchHistory();
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar divulgação");
    }
    setSending(false);
  };

  const filteredGroups = availableGroups.filter(g =>
    g.name.toLowerCase().includes(searchGroups.toLowerCase())
  );

  const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
    pending: { label: "Pendente", icon: Clock, className: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
    scheduled: { label: "Agendado", icon: Timer, className: "bg-violet-500/15 text-violet-400 border-violet-500/20" },
    sending: { label: "Enviando", icon: Loader2, className: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
    sent: { label: "Enviado", icon: CheckCircle, className: "bg-primary/15 text-primary border-primary/20" },
    partial: { label: "Parcial", icon: CheckCircle, className: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
    failed: { label: "Falhou", icon: XCircle, className: "bg-red-500/15 text-red-400 border-red-500/20" },
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <motion.div {...pageHeader}>
          <h1 className="text-2xl font-bold tracking-tight">Divulgação</h1>
          <p className="mt-1 text-sm text-muted-foreground">Envie mensagens para múltiplos grupos de uma vez</p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Group Selection */}
          <motion.div variants={fadeUpItem} initial="hidden" animate="visible" className="lg:col-span-2">
            <Card className="glass-card overflow-hidden h-full">
              <CardHeader className="border-b border-border/30 pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Selecionar Grupos
                </CardTitle>
                <CardDescription className="text-xs">
                  {selectedGroups.size} de {availableGroups.length} selecionados
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                {/* Instance selector if multiple */}
                {instances.length > 1 && (
                  <div className="flex gap-2">
                    {instances.map(inst => (
                      <Button
                        key={inst.id}
                        size="sm"
                        variant={selectedInstance?.id === inst.id ? "default" : "outline"}
                        onClick={() => selectInstance(inst)}
                        className="text-xs"
                      >
                        {inst.name}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Search + Select All */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                    <Input
                      placeholder="Buscar grupo..."
                      value={searchGroups}
                      onChange={e => setSearchGroups(e.target.value)}
                      className="pl-8 h-8 text-xs bg-muted/30 border-border/50"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={selectAll} className="text-[10px] h-8 px-2 shrink-0">
                    {filteredGroups.every(g => selectedGroups.has(g.jid)) ? "Desmarcar" : "Todos"}
                  </Button>
                </div>

                {/* Refresh button */}
                {selectedInstance && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchAllGroups(selectedInstance.name)}
                    disabled={loadingGroups}
                    className="text-[10px] h-6 px-2 text-muted-foreground"
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${loadingGroups ? "animate-spin" : ""}`} />
                    Atualizar lista
                  </Button>
                )}

                {/* Group list */}
                <ScrollArea className="h-[340px]">
                  {loadingGroups ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <p className="text-xs">Buscando grupos...</p>
                    </div>
                  ) : !selectedInstance ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                      <Users className="h-6 w-6 opacity-20" />
                      <p className="text-xs">Selecione uma instância</p>
                    </div>
                  ) : filteredGroups.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                      <Users className="h-6 w-6 opacity-20" />
                      <p className="text-xs">Nenhum grupo encontrado</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredGroups.map(group => (
                        <label
                          key={group.jid}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                            selectedGroups.has(group.jid) ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/30 border border-transparent"
                          }`}
                        >
                          <Checkbox
                            checked={selectedGroups.has(group.jid)}
                            onCheckedChange={() => toggleGroup(group.jid)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{group.name}</p>
                            <p className="text-[10px] text-muted-foreground/50">{group.size} membros</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>

          {/* Compose Message */}
          <motion.div variants={fadeUpItem} initial="hidden" animate="visible" transition={{ delay: 0.1 }} className="lg:col-span-3 space-y-6">
            <Card className="glass-card overflow-hidden">
              <CardHeader className="border-b border-border/30 pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-primary" />
                  Compor Mensagem
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Image upload */}
                <div className="space-y-2">
                  <Label className="text-xs">Imagem (opcional)</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  {imagePreview ? (
                    <div className="relative inline-block">
                      <img src={imagePreview} alt="Preview" className="h-32 rounded-lg object-cover border border-border/30" />
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={removeImage}
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="border-dashed border-border/50 text-xs h-20 w-full hover:bg-primary/5 hover:border-primary/30"
                    >
                      <ImagePlus className="mr-2 h-4 w-4 text-muted-foreground" />
                      Clique para adicionar uma imagem
                    </Button>
                  )}
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <Label className="text-xs">Mensagem</Label>
                  <Textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Escreva sua mensagem de divulgação aqui..."
                    className="bg-muted/30 border-border/50 min-h-[120px] text-sm"
                    maxLength={2000}
                  />
                  <p className="text-[10px] text-muted-foreground/50 text-right">{message.length}/2000</p>
                </div>

                {/* WhatsApp Preview */}
                {message.trim() && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground/70">Pré-visualização</Label>
                    <div className="rounded-xl bg-[#0b141a] p-4 space-y-2">
                      <div className="flex justify-end">
                        <div className="bg-[#005c4b] rounded-lg rounded-tr-none px-3 py-2 max-w-[85%] shadow-sm">
                          {imagePreview && (
                            <img src={imagePreview} alt="" className="rounded-md mb-2 max-h-40 object-cover" />
                          )}
                          <p className="text-[12px] text-white/90 leading-relaxed whitespace-pre-wrap">
                            {message.split(/(\*[^*]+\*)/).map((part, j) =>
                              part.startsWith("*") && part.endsWith("*") ? (
                                <strong key={j}>{part.slice(1, -1)}</strong>
                              ) : (
                                <span key={j}>{part}</span>
                              )
                            )}
                          </p>
                          <p className="text-[9px] text-white/40 text-right mt-1">12:00 ✓✓</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Schedule toggle */}
                <div className="space-y-3 rounded-lg border border-border/30 bg-muted/10 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4 text-primary" />
                      <Label className="text-xs font-medium">Agendar envio</Label>
                    </div>
                    <Switch checked={isScheduled} onCheckedChange={setIsScheduled} />
                  </div>

                  {isScheduled && (
                    <div className="flex flex-wrap gap-3 pt-1">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn("text-xs h-9 px-3 justify-start", !scheduledDate && "text-muted-foreground")}
                          >
                            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                            {scheduledDate ? format(scheduledDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={scheduledDate}
                            onSelect={setScheduledDate}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      <div className="flex items-center gap-1">
                        <Select value={scheduledHour} onValueChange={setScheduledHour}>
                          <SelectTrigger className="w-16 h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map(h => (
                              <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground font-bold">:</span>
                        <Select value={scheduledMinute} onValueChange={setScheduledMinute}>
                          <SelectTrigger className="w-16 h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["00", "15", "30", "45"].map(m => (
                              <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Send button */}
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    {selectedGroups.size > 0
                      ? isScheduled
                        ? `Será agendado para ${selectedGroups.size} grupo(s)`
                        : `Será enviado para ${selectedGroups.size} grupo(s)`
                      : "Selecione ao menos um grupo"}
                  </p>
                  <Button
                    onClick={sendBroadcast}
                    disabled={sending || selectedGroups.size === 0 || !message.trim() || (isScheduled && !scheduledDate)}
                    className="bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 shadow-lg shadow-primary/20"
                  >
                    {sending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : isScheduled ? (
                      <Timer className="mr-2 h-4 w-4" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    {sending ? "Processando..." : isScheduled ? "Agendar" : "Enviar Agora"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* History */}
            {history.length > 0 && (
              <Card className="glass-card overflow-hidden">
                <CardHeader className="border-b border-border/30 pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Histórico
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="divide-y divide-border/20">
                    {history.map(b => {
                      const cfg = statusConfig[b.status] || statusConfig.pending;
                      const StatusIcon = cfg.icon;
                      return (
                        <motion.div
                          key={b.id}
                          variants={scaleUpItem}
                          className="flex items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{b.message.substring(0, 80)}{b.message.length > 80 ? "..." : ""}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] text-muted-foreground/50">
                                {new Date(b.created_at).toLocaleString("pt-BR")}
                              </span>
                              <span className="text-[10px] text-muted-foreground/50">
                                {b.sent_count}/{b.total_count} grupos
                              </span>
                              {b.image_url && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-border/30">
                                  📷 Imagem
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Badge className={`text-[10px] ${cfg.className}`}>
                            <StatusIcon className={`h-3 w-3 mr-1 ${b.status === "sending" ? "animate-spin" : ""}`} />
                            {cfg.label}
                          </Badge>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}