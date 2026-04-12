import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Shield, LayoutDashboard, Users, AlertTriangle, Ban,
  MessageSquareOff, ShieldCheck, Settings, LogOut, Menu, X,
  Zap
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/groups", label: "Grupos", icon: Users },
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
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-sidebar-border bg-sidebar-background transition-transform lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-400 shadow-lg shadow-primary/20">
            <Shield className="h-[18px] w-[18px] text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-bold tracking-tight text-sidebar-accent-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              WhatsGuard
            </span>
            <span className="text-[10px] font-medium text-sidebar-foreground/40 uppercase tracking-widest">
              Moderação Bot
            </span>
          </div>
          <Button variant="ghost" size="icon" className="ml-auto text-sidebar-foreground/50 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
            Menu
          </p>
          {navItems.map(item => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm shadow-primary/5"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className={cn(
                  "h-4 w-4 transition-colors",
                  isActive ? "text-primary" : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70"
                )} />
                {item.label}
                {isActive && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-sm shadow-primary/50" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Status indicator */}
        <div className="mx-3 mb-3 rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <span className="text-[11px] font-medium text-sidebar-foreground/60">Bot ativo</span>
          </div>
        </div>

        {/* Sign out */}
        <div className="border-t border-sidebar-border p-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-[13px] text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <header className="flex h-14 items-center gap-4 border-b border-border/50 px-5 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="text-muted-foreground">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-emerald-400">
              <Shield className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>WhatsGuard</span>
          </div>
        </header>
        <div className="p-5 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
