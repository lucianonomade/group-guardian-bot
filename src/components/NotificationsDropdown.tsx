import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, AlertTriangle, Ban, Link2, ShieldAlert, MessageSquareOff, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Notification {
  id: string;
  action_type: string;
  participant_name: string | null;
  details: string | null;
  created_at: string;
  read?: boolean;
}

const ACTION_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  warning: { label: "Aviso", icon: AlertTriangle, color: "text-amber-400" },
  ban: { label: "Banimento", icon: Ban, color: "text-red-400" },
  unban: { label: "Desbanimento", icon: CheckCheck, color: "text-emerald-400" },
  link_deleted: { label: "Link Removido", icon: Link2, color: "text-primary" },
  word_deleted: { label: "Palavra Bloqueada", icon: MessageSquareOff, color: "text-purple-400" },
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function NotificationsDropdown() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    let isMounted = true;
    fetchNotifications();

    const channel = supabase.channel(`notif-${user.id}-${Date.now()}`);
    
    channel.on(
      "postgres_changes" as any,
      { event: "INSERT", schema: "public", table: "action_logs" },
      () => {
        if (isMounted) fetchNotifications();
      }
    );
    
    channel.subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from("action_logs")
      .select("id, action_type, participant_name, details, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    const items = (data as Notification[]) ?? [];
    setNotifications(items);
    setUnreadCount(Math.min(items.length, 9));
  };

  const markAllRead = () => {
    setUnreadCount(0);
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) markAllRead();
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground/50 hover:text-foreground relative">
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shadow-sm shadow-primary/50">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0 glass-card border-border/50" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
          <h3 className="text-sm font-bold">Notificações</h3>
          <Button variant="ghost" size="sm" className="text-[10px] text-primary h-6 px-2" onClick={markAllRead}>
            Marcar como lidas
          </Button>
        </div>
        <ScrollArea className="h-[360px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/40 gap-2">
              <Bell className="h-8 w-8 opacity-20" />
              <p className="text-xs">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y divide-border/10">
              {notifications.map(n => {
                const config = ACTION_CONFIG[n.action_type] || { label: n.action_type, icon: ShieldAlert, color: "text-muted-foreground" };
                const Icon = config.icon;
                return (
                  <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/10 transition-colors">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/30 ${config.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${config.color}`}>{config.label}</span>
                        {n.participant_name && (
                          <span className="text-xs text-foreground/60 truncate">— {n.participant_name}</span>
                        )}
                      </div>
                      {n.details && (
                        <p className="text-[11px] text-muted-foreground/50 mt-0.5 truncate">{n.details}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground/30 whitespace-nowrap mt-0.5">{timeAgo(n.created_at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
