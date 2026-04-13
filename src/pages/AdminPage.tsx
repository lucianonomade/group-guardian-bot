import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  ShieldAlert, Users, CreditCard, CheckCircle, XCircle, Clock,
  Loader2, Search, UserPlus, Edit, Ban
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface UserData {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  active_subscription: {
    id: string;
    status: string;
    plan_name: string;
    amount: number;
    expires_at: string | null;
    paid_at: string | null;
  } | null;
  subscriptions: Array<{
    id: string;
    status: string;
    plan_name: string;
    amount: number;
    expires_at: string | null;
    paid_at: string | null;
    created_at: string;
  }>;
  roles: string[];
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: "Ativa", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", icon: CheckCircle },
  pending: { label: "Pendente", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20", icon: Clock },
  expired: { label: "Expirada", color: "bg-red-500/15 text-red-400 border-red-500/20", icon: XCircle },
  cancelled: { label: "Cancelada", color: "bg-red-500/15 text-red-400 border-red-500/20", icon: Ban },
};

export default function AdminPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [activateDays, setActivateDays] = useState("30");
  const [editSubId, setEditSubId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("active");
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-panel", {
        body: { action: "list_users" },
      });
      if (error) throw error;
      return data.data as UserData[];
    },
    enabled: !!user,
  });

  const activateMutation = useMutation({
    mutationFn: async ({ targetUserId, days }: { targetUserId: string; days: number }) => {
      const { data, error } = await supabase.functions.invoke("admin-panel", {
        body: { action: "activate_subscription", target_user_id: targetUserId, days },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Assinatura ativada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setShowActivateDialog(false);
    },
    onError: () => toast.error("Erro ao ativar assinatura"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ subscriptionId, status }: { subscriptionId: string; status: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-panel", {
        body: { action: "update_subscription", subscription_id: subscriptionId, status },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Assinatura atualizada!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setShowEditDialog(false);
    },
    onError: () => toast.error("Erro ao atualizar assinatura"),
  });

  const cancelMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { data, error } = await supabase.functions.invoke("admin-panel", {
        body: { action: "cancel_subscription", subscription_id: subscriptionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Assinatura cancelada!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => toast.error("Erro ao cancelar assinatura"),
  });

  const filteredUsers = users?.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.email?.toLowerCase().includes(q) ?? false) ||
      (u.display_name?.toLowerCase().includes(q) ?? false)
    );
  });

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-primary" /> Painel Admin
            </h1>
            <p className="text-sm text-muted-foreground">Gerencie usuários e assinaturas</p>
          </div>
          <Badge variant="outline" className="text-xs">
            {users?.length || 0} usuários
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4 flex items-center gap-3">
              <Users className="h-8 w-8 text-primary/60" />
              <div>
                <p className="text-2xl font-bold">{users?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total de Usuários</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-emerald-500/60" />
              <div>
                <p className="text-2xl font-bold">
                  {users?.filter((u) => u.active_subscription).length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Assinaturas Ativas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-yellow-500/60" />
              <div>
                <p className="text-2xl font-bold">
                  {users?.filter((u) => !u.active_subscription).length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Sem Assinatura</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers?.map((u) => {
                    const sub = u.active_subscription;
                    const latestSub = u.subscriptions?.[0];
                    const displaySub = sub || latestSub;
                    const st = displaySub ? statusConfig[displaySub.status] || statusConfig.pending : null;
                    const StIcon = st?.icon || XCircle;

                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{u.display_name || "—"}</span>
                            {u.roles.includes("admin") && (
                              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Admin</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          {st ? (
                            <Badge className={`text-xs ${st.color}`}>
                              <StIcon className="mr-1 h-3 w-3" /> {st.label}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Nenhuma</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{displaySub?.plan_name || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(displaySub?.expires_at || null)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {/* Activate */}
                            <Dialog open={showActivateDialog && selectedUser?.user_id === u.user_id} onOpenChange={(open) => {
                              setShowActivateDialog(open);
                              if (open) setSelectedUser(u);
                            }}>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Ativar assinatura">
                                  <UserPlus className="h-4 w-4 text-emerald-500" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Ativar Assinatura</DialogTitle>
                                </DialogHeader>
                                <p className="text-sm text-muted-foreground">
                                  Ativar assinatura para <strong>{u.display_name || u.email}</strong>
                                </p>
                                <div className="space-y-2">
                                  <Label className="text-xs">Dias de acesso</Label>
                                  <Input
                                    type="number"
                                    value={activateDays}
                                    onChange={(e) => setActivateDays(e.target.value)}
                                    className="rounded-xl"
                                  />
                                </div>
                                <DialogFooter>
                                  <Button
                                    onClick={() => activateMutation.mutate({
                                      targetUserId: u.user_id,
                                      days: parseInt(activateDays) || 30,
                                    })}
                                    disabled={activateMutation.isPending}
                                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                                  >
                                    {activateMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                    )}
                                    Ativar
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            {/* Edit status */}
                            {displaySub && (
                              <Dialog open={showEditDialog && editSubId === displaySub.id} onOpenChange={(open) => {
                                setShowEditDialog(open);
                                if (open) {
                                  setEditSubId(displaySub.id);
                                  setEditStatus(displaySub.status);
                                }
                              }}>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Editar status">
                                    <Edit className="h-4 w-4 text-blue-400" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Editar Assinatura</DialogTitle>
                                  </DialogHeader>
                                  <p className="text-sm text-muted-foreground">
                                    Alterar status da assinatura de <strong>{u.display_name || u.email}</strong>
                                  </p>
                                  <div className="space-y-2">
                                    <Label className="text-xs">Status</Label>
                                    <Select value={editStatus} onValueChange={setEditStatus}>
                                      <SelectTrigger className="rounded-xl">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="active">Ativa</SelectItem>
                                        <SelectItem value="pending">Pendente</SelectItem>
                                        <SelectItem value="expired">Expirada</SelectItem>
                                        <SelectItem value="cancelled">Cancelada</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <DialogFooter>
                                    <Button
                                      onClick={() => updateMutation.mutate({
                                        subscriptionId: displaySub.id,
                                        status: editStatus,
                                      })}
                                      disabled={updateMutation.isPending}
                                      className="rounded-xl"
                                    >
                                      {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                      Salvar
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            )}

                            {/* Cancel */}
                            {sub && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                title="Cancelar assinatura"
                                onClick={() => {
                                  if (confirm(`Cancelar assinatura de ${u.display_name || u.email}?`)) {
                                    cancelMutation.mutate(sub.id);
                                  }
                                }}
                              >
                                <XCircle className="h-4 w-4 text-red-400" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
