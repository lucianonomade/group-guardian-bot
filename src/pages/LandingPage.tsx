import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield, Users, MessageSquareOff, Ban, AlertTriangle,
  Megaphone, Radar, Phone, Zap, Check, ChevronRight,
  ShieldCheck, BarChart3, BookOpen, Star
} from "lucide-react";
import { motion } from "framer-motion";

const features = [
  { icon: Shield, title: "Moderação Automática", desc: "Proteja seus grupos com regras inteligentes 24/7" },
  { icon: MessageSquareOff, title: "Palavras Bloqueadas", desc: "Filtre conteúdo indesejado automaticamente" },
  { icon: Ban, title: "Banimentos", desc: "Gerencie banimentos com histórico completo" },
  { icon: AlertTriangle, title: "Sistema de Avisos", desc: "Avisos progressivos antes do banimento" },
  { icon: Megaphone, title: "Divulgação em Massa", desc: "Envie mensagens para múltiplos grupos" },
  { icon: Radar, title: "Buscador de Grupos", desc: "Encontre e entre em grupos automaticamente" },
  { icon: Phone, title: "Validar Números", desc: "Verifique números válidos do WhatsApp" },
  { icon: BarChart3, title: "Analytics", desc: "Dados e métricas dos seus grupos em tempo real" },
  { icon: ShieldCheck, title: "Whitelist", desc: "Membros VIP protegidos da moderação" },
];

const plans = [
  {
    name: "WhatsGuard Pro",
    price: "100",
    period: "/mês",
    description: "Acesso completo a todas as funcionalidades",
    trial: "3 dias grátis",
      "Instâncias ilimitadas",
      "Grupos ilimitados",
      "Moderação automática 24/7",
      "Palavras bloqueadas",
      "Sistema de avisos",
      "Banimentos com histórico",
      "Whitelist de membros VIP",
      "Divulgação em massa",
      "Buscador de grupos",
      "Validar números ilimitados",
      "Analytics avançado",
      "Anti-flood",
      "Agendamento de broadcasts",
      "Suporte prioritário",
    ],
    highlight: true,
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 grid-pattern opacity-20" />
        <div className="absolute left-1/2 top-0 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-primary/[0.05] blur-[200px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[600px] rounded-full bg-primary/[0.03] blur-[150px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-20 flex items-center justify-between px-6 lg:px-16 py-5 border-b border-border/20">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-teal-400 to-cyan-400 shadow-lg shadow-primary/25">
            <Shield className="h-5 w-5 text-background" />
          </div>
          <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
            WhatsGuard
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
              Entrar
            </Button>
          </Link>
          <Link to="/login">
            <Button className="rounded-xl bg-gradient-to-r from-primary via-teal-500 to-cyan-500 text-background font-bold shadow-lg shadow-primary/25 hover:opacity-90">
              Começar Grátis
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-20 pb-24 lg:pt-32 lg:pb-36">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Badge className="mb-6 rounded-full border-primary/20 bg-primary/10 text-primary px-4 py-1.5 text-xs font-semibold">
            <Zap className="mr-1.5 h-3 w-3" /> Moderação automatizada para WhatsApp
          </Badge>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7 }}
          className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight max-w-4xl leading-[1.1]"
          style={{ fontFamily: "'Syne', sans-serif" }}
        >
          Proteja seus grupos com{" "}
          <span className="gradient-text">inteligência</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mt-6 max-w-2xl text-base lg:text-lg text-muted-foreground/70 leading-relaxed"
        >
          WhatsGuard é o bot de moderação mais completo para grupos do WhatsApp.
          Automatize regras, bloqueie spam, gerencie membros e muito mais.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-10 flex flex-col sm:flex-row gap-4"
        >
          <Link to="/login">
            <Button size="lg" className="rounded-xl bg-gradient-to-r from-primary via-teal-500 to-cyan-500 text-background font-bold shadow-xl shadow-primary/30 hover:opacity-90 px-8 h-12 text-base">
              Começar Agora <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
          <a href="#planos">
            <Button size="lg" variant="outline" className="rounded-xl border-border/50 hover:bg-muted/30 px-8 h-12 text-base font-semibold">
              Ver Planos
            </Button>
          </a>
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 lg:px-16 pb-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
            Tudo que você precisa
          </h2>
          <p className="mt-3 text-muted-foreground/60 max-w-lg mx-auto">
            Ferramentas poderosas para gerenciar seus grupos com eficiência
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={fadeUp}
            >
              <div className="glass-card-hover rounded-2xl p-6 h-full">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-bold mb-1.5">{f.title}</h3>
                <p className="text-xs text-muted-foreground/60 leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="planos" className="relative z-10 px-6 lg:px-16 pb-32 scroll-mt-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
            Planos & Preços
          </h2>
          <p className="mt-3 text-muted-foreground/60 max-w-lg mx-auto">
            Escolha o plano ideal para o tamanho da sua operação
          </p>
        </div>
        <div className="flex justify-center max-w-lg mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={fadeUp}
              className={plan.highlight ? "lg:-mt-4" : ""}
            >
              <Card className={`rounded-2xl overflow-hidden relative ${
                plan.highlight
                  ? "border-primary/30 shadow-2xl shadow-primary/10 bg-card/80"
                  : "glass-card"
              }`}>
                {plan.highlight && (
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />
                )}
                <CardHeader className="pb-2 pt-7 px-7">
                  {plan.highlight && (
                    <Badge className="w-fit mb-3 rounded-full bg-primary/15 text-primary border-primary/20 text-[10px] font-bold">
                      <Star className="mr-1 h-3 w-3" /> Mais Popular
                    </Badge>
                  )}
                  <CardTitle className="text-lg font-bold">{plan.name}</CardTitle>
                  <p className="text-xs text-muted-foreground/50">{plan.description}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-xs text-muted-foreground/40">R$</span>
                    <span className="text-4xl font-extrabold tracking-tight gradient-text">{plan.price}</span>
                    <span className="text-sm text-muted-foreground/40">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="px-7 pb-7 pt-5">
                  <ul className="space-y-3 mb-7">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-xs text-muted-foreground/70">
                        <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/checkout">
                    <Button className={`w-full rounded-xl h-11 font-bold text-sm ${
                      plan.highlight
                        ? "bg-gradient-to-r from-primary via-teal-500 to-cyan-500 text-background shadow-lg shadow-primary/25 hover:opacity-90"
                        : "bg-muted/40 hover:bg-muted/60 text-foreground"
                    }`}>
                      Assinar Agora
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/20 py-10 px-6 lg:px-16">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-5xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-cyan-400">
              <Shield className="h-4 w-4 text-background" />
            </div>
            <span className="text-sm font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>WhatsGuard</span>
          </div>
          <p className="text-xs text-muted-foreground/30">
            © {new Date().getFullYear()} WhatsGuard. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
