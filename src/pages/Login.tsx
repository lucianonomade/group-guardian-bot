import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shield, Zap } from "lucide-react";

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
      navigate("/");
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
        emailRedirectTo: window.location.origin,
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
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[600px] translate-x-1/4 translate-y-1/4 rounded-full bg-primary/3 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-[420px] space-y-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-emerald-400 shadow-2xl shadow-primary/30">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight gradient-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              WhatsGuard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Moderação inteligente para grupos do WhatsApp
            </p>
          </div>
        </div>

        <Card className="glass-card overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Acesse sua conta</CardTitle>
            <CardDescription>Entre ou crie uma conta para gerenciar seus grupos</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar Conta</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-xs font-medium text-muted-foreground">E-mail</Label>
                    <Input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="bg-muted/30 border-border/50 focus:border-primary/50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-xs font-medium text-muted-foreground">Senha</Label>
                    <Input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="bg-muted/30 border-border/50 focus:border-primary/50" />
                  </div>
                  <Button type="submit" className="w-full bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 shadow-lg shadow-primary/20" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-xs font-medium text-muted-foreground">Nome</Label>
                    <Input id="signup-name" type="text" value={name} onChange={e => setName(e.target.value)} required className="bg-muted/30 border-border/50 focus:border-primary/50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-xs font-medium text-muted-foreground">E-mail</Label>
                    <Input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="bg-muted/30 border-border/50 focus:border-primary/50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-xs font-medium text-muted-foreground">Senha</Label>
                    <Input id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="bg-muted/30 border-border/50 focus:border-primary/50" />
                  </div>
                  <Button type="submit" className="w-full bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 shadow-lg shadow-primary/20" disabled={loading}>
                    {loading ? "Criando..." : "Criar Conta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground/50">
          <Zap className="mr-1 inline h-3 w-3" />
          Integrado com Evolution API
        </p>
      </div>
    </div>
  );
}
