import { useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shield, Zap, Lock, Mail, User } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/dashboard");
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Conta criada! Verifique seu e-mail para confirmar.");
    }
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        {/* Grid pattern */}
        <div className="absolute inset-0 grid-pattern opacity-30" />
        {/* Radial glow */}
        <div className="absolute left-1/2 top-1/3 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.06] blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 h-[300px] w-[500px] rounded-full bg-primary/[0.03] blur-[100px]" />
        {/* Decorative lines */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-1/3 bg-gradient-to-b from-transparent via-primary/20 to-transparent" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[440px] space-y-8"
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-teal-400 to-cyan-400 shadow-2xl shadow-primary/30">
              <Shield className="h-10 w-10 text-background" />
            </div>
            <div className="absolute -inset-3 rounded-3xl bg-primary/10 blur-2xl" />
          </div>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight gradient-text" style={{ fontFamily: "'Syne', sans-serif" }}>
              WhatsGuard
            </h1>
            <p className="mt-2 text-sm text-muted-foreground/70 font-medium">
              Moderação inteligente para grupos do WhatsApp
            </p>
          </div>
        </div>

        {/* Auth Card */}
        <Card className="glass-card overflow-hidden ambient-glow">
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-lg font-bold">Acesse sua conta</CardTitle>
            <CardDescription className="text-xs">Entre ou crie uma conta para gerenciar seus grupos</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2 bg-muted/40 p-1 rounded-xl">
                <TabsTrigger value="login" className="rounded-lg text-xs font-semibold data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-sm">Entrar</TabsTrigger>
                <TabsTrigger value="signup" className="rounded-lg text-xs font-semibold data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-sm">Criar Conta</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 pt-5">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-xs font-semibold text-muted-foreground/80 flex items-center gap-1.5">
                      <Mail className="h-3 w-3" /> E-mail
                    </Label>
                    <Input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="bg-muted/20 border-border/40 focus:border-primary/50 rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-xs font-semibold text-muted-foreground/80 flex items-center gap-1.5">
                      <Lock className="h-3 w-3" /> Senha
                    </Label>
                    <Input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="bg-muted/20 border-border/40 focus:border-primary/50 rounded-xl h-11" />
                  </div>
                  <Button type="submit" className="w-full h-11 rounded-xl bg-gradient-to-r from-primary via-teal-500 to-cyan-500 hover:opacity-90 text-background font-bold shadow-lg shadow-primary/25 transition-all duration-300" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4 pt-5">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-xs font-semibold text-muted-foreground/80 flex items-center gap-1.5">
                      <User className="h-3 w-3" /> Nome
                    </Label>
                    <Input id="signup-name" type="text" value={name} onChange={e => setName(e.target.value)} required className="bg-muted/20 border-border/40 focus:border-primary/50 rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-xs font-semibold text-muted-foreground/80 flex items-center gap-1.5">
                      <Mail className="h-3 w-3" /> E-mail
                    </Label>
                    <Input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="bg-muted/20 border-border/40 focus:border-primary/50 rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-xs font-semibold text-muted-foreground/80 flex items-center gap-1.5">
                      <Lock className="h-3 w-3" /> Senha
                    </Label>
                    <Input id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="bg-muted/20 border-border/40 focus:border-primary/50 rounded-xl h-11" />
                  </div>
                  <Button type="submit" className="w-full h-11 rounded-xl bg-gradient-to-r from-primary via-teal-500 to-cyan-500 hover:opacity-90 text-background font-bold shadow-lg shadow-primary/25 transition-all duration-300" disabled={loading}>
                    {loading ? "Criando..." : "Criar Conta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground/30 font-medium">
          <Zap className="mr-1 inline h-3 w-3 text-primary/40" />
          Integrado com Evolution API
        </p>
      </motion.div>
    </div>
  );
}
