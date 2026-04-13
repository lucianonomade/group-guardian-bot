import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { User, Settings, CreditCard, LogOut, Shield } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function ProfileDropdown() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: subscription } = useQuery({
    queryKey: ["subscription-status", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("status, plan_name, expires_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Usuário";
  const email = profile?.email || user?.email || "";
  const planName = subscription?.plan_name || "Sem plano";
  const isActive = subscription?.status === "active";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary via-teal-400 to-cyan-400 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-shadow cursor-pointer">
          <User className="h-4 w-4 text-background" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0 glass-card border-border/50" align="end" sideOffset={8}>
        {/* Profile header */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-cyan-400">
              <User className="h-5 w-5 text-background" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{displayName}</p>
              <p className="text-[11px] text-muted-foreground/50 truncate">{email}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-primary" : "bg-amber-400"}`} />
            <span className="text-[10px] font-medium text-muted-foreground/60">{planName}</span>
            {isActive && (
              <span className="text-[10px] text-primary/60 font-medium">• Ativo</span>
            )}
          </div>
        </div>

        <Separator className="bg-border/20" />

        {/* Menu items */}
        <div className="p-1.5">
          <button
            onClick={() => navigate("/settings")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground/70 hover:bg-muted/20 hover:text-foreground transition-colors"
          >
            <Settings className="h-4 w-4 text-muted-foreground/50" />
            Configurações
          </button>
          <button
            onClick={() => navigate("/subscription")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground/70 hover:bg-muted/20 hover:text-foreground transition-colors"
          >
            <CreditCard className="h-4 w-4 text-muted-foreground/50" />
            Assinatura
          </button>
          <button
            onClick={() => navigate("/tutorial")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground/70 hover:bg-muted/20 hover:text-foreground transition-colors"
          >
            <Shield className="h-4 w-4 text-muted-foreground/50" />
            Tutorial
          </button>
        </div>

        <Separator className="bg-border/20" />

        <div className="p-1.5">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
