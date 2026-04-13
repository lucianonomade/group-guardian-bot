import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Shield, LayoutDashboard, Users, AlertTriangle, Ban,
  MessageSquareOff, ShieldCheck, Settings, LogOut, Menu, X,
  Megaphone, ChevronRight, BarChart3
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/groups", label: "Grupos", icon: Users },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/broadcast", label: "Divulgação", icon: Megaphone },
  { href: "/warnings", label: "Avisos", icon: AlertTriangle },
  { href: "/bans", label: "Banimentos", icon: Ban },
  { href: "/blocked-words", label: "Palavras Bloqueadas", icon: MessageSquareOff },
  { href: "/whitelist", label: "Whitelist", icon: ShieldCheck },
  { href: "/settings", label: "Configurações", icon: Settings },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Background atmosphere */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/[0.03] rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-primary/[0.02] rounded-full blur-[120px]" />
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-sidebar-border/60 bg-sidebar-background/95 backdrop-blur-xl transition-transform lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex h-[72px] items-center gap-3 border-b border-sidebar-border/40 px-6">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-teal-400 to-cyan-400 shadow-lg shadow-primary/25">
            <Shield className="h-5 w-5 text-background" />
            <div className="absolute inset-0 rounded-xl bg-primary/20 blur-md" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-sidebar-accent-foreground" style={{ fontFamily: "'Syne', sans-serif" }}>
              WhatsGuard
            </span>
            <span className="text-[9px] font-semibold text-primary/50 uppercase tracking-[0.2em]">
              Moderação Bot
            </span>
          </div>
          <Button variant="ghost" size="icon" className="ml-auto text-sidebar-foreground/40 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-6">
          <p className="mb-3 px-3 text-[9px] font-bold uppercase tracking-[0.25em] text-sidebar-foreground/25">
            Navegação
          </p>
          {navItems.map(item => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-300",
                  isActive
                    ? "bg-primary/[0.08] text-primary shadow-sm shadow-primary/5"
                    : "text-sidebar-foreground/50 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[2px] rounded-r-full bg-primary"
                    style={{ boxShadow: "0 0 12px 2px hsl(174 72% 46% / 0.4)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon className={cn(
                  "h-[18px] w-[18px] transition-all duration-300",
                  isActive ? "text-primary" : "text-sidebar-foreground/35 group-hover:text-sidebar-foreground/60"
                )} />
                <span className="flex-1">{item.label}</span>
                {isActive && (
                  <ChevronRight className="h-3 w-3 text-primary/50" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Status indicator */}
        <div className="mx-4 mb-4 rounded-xl border border-primary/10 bg-primary/[0.04] p-3.5">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary shadow-sm shadow-primary/50" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-primary/80">Sistema ativo</span>
              <p className="text-[9px] text-sidebar-foreground/30">Monitoramento em tempo real</p>
            </div>
          </div>
        </div>

        {/* Sign out */}
        <div className="border-t border-sidebar-border/30 p-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 rounded-xl text-[13px] text-sidebar-foreground/40 hover:bg-destructive/10 hover:text-destructive transition-all duration-300"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="relative flex-1 overflow-auto">
        <header className="flex h-16 items-center gap-4 border-b border-border/30 px-5 lg:hidden bg-background/80 backdrop-blur-xl sticky top-0 z-30">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="text-muted-foreground">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-cyan-400">
              <Shield className="h-4 w-4 text-background" />
            </div>
            <span className="text-sm font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>WhatsGuard</span>
          </div>
        </header>
        <div className="relative p-6 lg:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
