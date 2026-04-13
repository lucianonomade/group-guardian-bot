import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Flame, Play, Pause, Trash2, Plus, Loader2, CheckCircle2, Clock, AlertTriangle, History, MessageSquare, XCircle, ImagePlus, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { pageHeader } from "@/lib/animations";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

const DEFAULT_PLAN = [
  { day: 1, messages: 2 },
  { day: 2, messages: 4 },
  { day: 3, messages: 6 },
  { day: 4, messages: 10 },
  { day: 5, messages: 15 },
  { day: 6, messages: 20 },
  { day: 7, messages: 25 },
];

const statusMap: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pendente", color: "bg-muted text-muted-foreground", icon: Clock },
  active: { label: "Ativo", color: "bg-primary/20 text-primary", icon: Play },
  paused: { label: "Pausado", color: "bg-warning/20 text-warning", icon: Pause },
  completed: { label: "Concluído", color: "bg-success/20 text-success", icon: CheckCircle2 },
  error: { label: "Erro", color: "bg-destructive/20 text-destructive", icon: AlertTriangle },
};

export default function WarmupPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [instanceId, setInstanceId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [targetNumbers, setTargetNumbers] = useState("");
  const [totalDays, setTotalDays] = useState(7);
  const [customPlan, setCustomPlan] = useState(DEFAULT_PLAN);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [customMessages, setCustomMessages] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

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

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["warmup-tasks", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warmup_tasks")
        .select("*, instances(name)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["warmup-logs", selectedTaskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warmup_logs")
        .select("*")
        .eq("warmup_task_id", selectedTaskId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTaskId && logsOpen,
  });

  // Realtime: listen for warmup task updates (completion notifications)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`warmup-realtime-${user.id}`)
      .on(
        "postgres_changes" as any,
        {
          event: "UPDATE",
          schema: "public",
          table: "warmup_tasks",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          if (payload.new?.status === "completed" && payload.old?.status !== "completed") {
            toast.success(`🎉 Maturação do número ${payload.new.phone_number} concluída!`, {
              duration: 8000,
            });
          }
          queryClient.invalidateQueries({ queryKey: ["warmup-tasks"] });
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [user, queryClient]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const targets = targetNumbers
        .split(/[\n,;]+/)
        .map(n => n.replace(/\D/g, ""))
        .filter(n => n.length >= 10);

      if (!targets.length) throw new Error("Adicione pelo menos um número destino");

      const plan = customPlan.slice(0, totalDays).map((p, i) => ({ day: i + 1, messages: p.messages }));

      const { error } = await supabase.from("warmup_tasks").insert({
        user_id: user!.id,
        instance_id: instanceId,
        phone_number: phoneNumber.replace(/\D/g, ""),
        target_numbers: targets,
        total_days: totalDays,
        schedule_plan: plan,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Maturação criada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["warmup-tasks"] });
      setCreateOpen(false);
      setPhoneNumber("");
      setTargetNumbers("");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar maturação"),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === "active" ? "paused" : "active";
      const updates: any = { status: newStatus };
      if (newStatus === "active" && currentStatus === "pending") {
        updates.started_at = new Date().toISOString();
        updates.current_day = 1;
        updates.max_messages_today = DEFAULT_PLAN[0]?.messages || 2;
      }
      const { error } = await supabase.from("warmup_tasks").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warmup-tasks"] });
      toast.success("Status atualizado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("warmup_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warmup-tasks"] });
      toast.success("Maturação removida!");
    },
  });

  const updatePlanDay = (index: number, messages: number) => {
    setCustomPlan(prev => prev.map((p, i) => i === index ? { ...p, messages: Math.max(1, messages) } : p));
  };

  const handleTotalDaysChange = (days: number) => {
    setTotalDays(days);
    if (days > customPlan.length) {
      const newPlan = [...customPlan];
      for (let i = customPlan.length; i < days; i++) {
        newPlan.push({ day: i + 1, messages: Math.min(30 + i * 5, 100) });
      }
      setCustomPlan(newPlan);
    }
  };

  return (
    <DashboardLayout>
      <motion.div className="space-y-6 sm:space-y-8" {...pageHeader}>
        {/* Header */}
        <motion.div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-foreground flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <Flame className="h-6 w-6 text-primary" />
              </div>
              Maturador de Números
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Aquecimento progressivo de números para evitar bloqueios
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Nova Maturação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Maturação</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Instância</Label>
                  <Select value={instanceId} onValueChange={setInstanceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a instância" />
                    </SelectTrigger>
                    <SelectContent>
                      {instances?.map(inst => (
                        <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Número a Maturar</Label>
                  <Input
                    placeholder="5511999999999"
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Número conectado na instância</p>
                </div>
                <div>
                  <Label>Números Destino (1 por linha)</Label>
                  <Textarea
                    placeholder="5511888888888&#10;5511777777777&#10;5511666666666"
                    value={targetNumbers}
                    onChange={e => setTargetNumbers(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Números reais que receberão as mensagens de aquecimento</p>
                </div>
                <div>
                  <Label>Duração (dias)</Label>
                  <Select value={String(totalDays)} onValueChange={v => handleTotalDaysChange(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[3, 5, 7, 10, 14, 21, 30].map(d => (
                        <SelectItem key={d} value={String(d)}>{d} dias</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Plano Progressivo</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {customPlan.slice(0, totalDays).map((p, i) => (
                      <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">Dia {p.day}:</span>
                        <Input
                          type="number"
                          min={1}
                          value={p.messages}
                          onChange={e => updatePlanDay(i, Number(e.target.value))}
                          className="h-7 text-xs w-16"
                        />
                        <span className="text-xs text-muted-foreground">msgs</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!instanceId || !phoneNumber || !targetNumbers || createMutation.isPending}
                  className="gap-2"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Criar Maturação
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>

        {/* Stats */}
        <motion.div className="grid grid-cols-2 sm:grid-cols-4 gap-3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {[
            { label: "Total", value: tasks?.length || 0, color: "text-foreground" },
            { label: "Ativos", value: tasks?.filter(t => t.status === "active").length || 0, color: "text-primary" },
            { label: "Concluídos", value: tasks?.filter(t => t.status === "completed").length || 0, color: "text-success" },
            { label: "Pausados", value: tasks?.filter(t => t.status === "paused").length || 0, color: "text-warning" },
          ].map((stat, i) => (
            <Card key={i} className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className={`text-2xl font-bold font-display ${stat.color}`}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Tasks list */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Maturações</CardTitle>
              <CardDescription>Gerencie seus planos de aquecimento</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : !tasks?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Flame className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma maturação criada</p>
                  <p className="text-xs mt-1">Clique em "Nova Maturação" para começar</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30">
                        <TableHead>Número</TableHead>
                        <TableHead>Instância</TableHead>
                        <TableHead>Progresso</TableHead>
                        <TableHead>Msgs Hoje</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks.map((task: any) => {
                        const plan = (task.schedule_plan as any[]) || [];
                        const progressPct = task.total_days > 0 ? (task.current_day / task.total_days) * 100 : 0;
                        const status = statusMap[task.status] || statusMap.pending;
                        const StatusIcon = status.icon;

                        return (
                          <TableRow key={task.id} className="border-border/20">
                            <TableCell className="font-mono text-sm">{task.phone_number}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {(task as any).instances?.name || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 min-w-[120px]">
                                <Progress value={progressPct} className="h-2 flex-1" />
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {task.current_day}/{task.total_days}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {task.messages_today}/{task.max_messages_today}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${status.color} gap-1 border-0`}>
                                <StatusIcon className="h-3 w-3" />
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => { setSelectedTaskId(task.id); setLogsOpen(true); }}
                                >
                                  <History className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                {task.status !== "completed" && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => toggleStatus.mutate({ id: task.id, currentStatus: task.status })}
                                  >
                                    {task.status === "active" ? (
                                      <Pause className="h-4 w-4 text-warning" />
                                    ) : (
                                      <Play className="h-4 w-4 text-primary" />
                                    )}
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => deleteMutation.mutate(task.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* How it works */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Como funciona?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { step: "1", title: "Configure", desc: "Escolha a instância, o número e os destinos para o aquecimento" },
                  { step: "2", title: "Plano Progressivo", desc: "Defina quantas mensagens enviar por dia, aumentando gradualmente" },
                  { step: "3", title: "Execução Automática", desc: "O sistema envia mensagens em intervalos aleatórios simulando uso natural" },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">{item.step}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Logs Dialog */}
      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Histórico de Mensagens
            </DialogTitle>
          </DialogHeader>
          {logsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !logs?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma mensagem enviada ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-3 mb-4 text-sm">
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-400" />
                  {logs.filter(l => l.status === "sent").length} enviadas
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <XCircle className="h-3 w-3 text-destructive" />
                  {logs.filter(l => l.status === "error").length} erros
                </Badge>
              </div>
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/30">
                  {log.status === "sent" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">{log.target_number}</span>
                      <Badge variant="outline" className="text-[10px] h-5">Dia {log.day_number}</Badge>
                    </div>
                    <p className="text-sm mt-1 truncate">{log.message_text}</p>
                    {log.error_details && (
                      <p className="text-xs text-destructive mt-1 truncate">{log.error_details}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
