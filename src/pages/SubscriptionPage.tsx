import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, CalendarDays, Shield, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  active: { label: "Ativa", variant: "default", icon: CheckCircle },
  pending: { label: "Pendente", variant: "secondary", icon: Clock },
  expired: { label: "Expirada", variant: "destructive", icon: XCircle },
  cancelled: { label: "Cancelada", variant: "destructive", icon: XCircle },
};

export default function SubscriptionPage() {
  const { user } = useAuth();

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["subscriptions-all", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const activeSubscription = subscriptions?.find(
    (s) => s.status === "active" && s.expires_at && new Date(s.expires_at) > new Date()
  );

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount / 100);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assinatura</h1>
          <p className="text-sm text-muted-foreground">Gerencie seu plano e veja o histórico de pagamentos</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Current Plan Card */}
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-primary" />
                  Plano Atual
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeSubscription ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold">{activeSubscription.plan_name}</h3>
                        <Badge variant="default" className="bg-primary/15 text-primary border-primary/20">
                          <CheckCircle className="mr-1 h-3 w-3" /> Ativa
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(activeSubscription.amount)} / mês
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          Válido até: {formatDate(activeSubscription.expires_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center py-6 gap-3">
                    <XCircle className="h-10 w-10 text-muted-foreground/30" />
                    <div>
                      <p className="font-semibold">Nenhuma assinatura ativa</p>
                      <p className="text-sm text-muted-foreground">Assine o WhatsGuard Pro para acessar todas as funcionalidades</p>
                    </div>
                    <Link to="/checkout">
                      <Button className="mt-2 rounded-xl bg-gradient-to-r from-primary via-teal-500 to-cyan-500 text-background font-bold shadow-lg shadow-primary/25 hover:opacity-90">
                        <CreditCard className="mr-2 h-4 w-4" /> Assinar Agora
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment History */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  Histórico de Pagamentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {subscriptions && subscriptions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plano</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Validade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions.map((sub) => {
                        const status = statusMap[sub.status] || statusMap.pending;
                        const StatusIcon = status.icon;
                        return (
                          <TableRow key={sub.id}>
                            <TableCell className="font-medium">{sub.plan_name}</TableCell>
                            <TableCell>{formatCurrency(sub.amount)}</TableCell>
                            <TableCell>
                              <Badge variant={status.variant} className="text-xs">
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDate(sub.paid_at || sub.created_at)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDate(sub.expires_at)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum pagamento encontrado
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
