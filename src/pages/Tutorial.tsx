import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { fadeUpItem, pageHeader } from "@/lib/animations";
import {
  Users, MessageSquare, ShieldAlert, Ban, AlertTriangle,
  MessageSquareOff, ShieldCheck, Megaphone, Radar, BarChart3,
  BookOpen, Zap, ChevronRight, Terminal, Send
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const steps = [
  {
    number: "01",
    icon: Users,
    title: "Ativar seus Grupos",
    description: "Escolha quais grupos o bot vai proteger.",
    details: [
      'Clique em "Grupos" no menu lateral',
      "Seus grupos aparecerão automaticamente na lista",
      'Ative o botão "Monitorar" nos grupos que deseja proteger',
      "Pronto! O bot já começa a moderar esses grupos",
    ],
  },
  {
    number: "02",
    icon: MessageSquareOff,
    title: "Bloquear Palavras",
    description: "Defina palavras proibidas que serão apagadas automaticamente.",
    details: [
      'Clique em "Palavras Bloqueadas" no menu',
      "Digite a palavra e escolha uma categoria (spam, ofensa, link...)",
      "Quando alguém enviar essa palavra, a mensagem será apagada",
      "O membro recebe um aviso automático",
      "Após 3 avisos, o membro é removido do grupo",
    ],
  },
  {
    number: "03",
    icon: MessageSquare,
    title: "Mensagem de Boas-vindas",
    description: "Receba novos membros com uma mensagem automática.",
    details: [
      'Na página "Grupos", clique em "Configurar" na coluna Boas-vindas',
      "Escreva sua mensagem de boas-vindas",
      "Use {name} para incluir o nome da pessoa automaticamente",
      "Use {group} para incluir o nome do grupo",
      'Exemplo: "Bem-vindo(a), {name}! 👋 Siga as regras do {group}."',
    ],
  },
  {
    number: "04",
    icon: BookOpen,
    title: "Regras do Grupo",
    description: "Configure as regras para os membros consultarem a qualquer momento.",
    details: [
      'Na página "Grupos", clique em "Configurar" na coluna Regras',
      "Escreva as regras do seu grupo",
      "Qualquer membro pode digitar !regras no grupo para vê-las",
    ],
  },
  {
    number: "05",
    icon: ShieldAlert,
    title: "Anti-flood (Anti-spam)",
    description: "Bloqueie quem manda muitas mensagens seguidas.",
    details: [
      'Na página "Grupos", clique em "Configurar" na coluna Anti-flood',
      "Escolha quantas mensagens são permitidas (ex: 10)",
      "Escolha em quantos segundos (ex: 30 segundos)",
      "Se alguém passar do limite, recebe um aviso automático",
    ],
  },
  {
    number: "06",
    icon: ShieldCheck,
    title: "Whitelist (Membros VIP)",
    description: "Proteja membros específicos de serem moderados.",
    details: [
      'Clique em "Whitelist" no menu',
      "Adicione os membros que não devem ser moderados",
      "Eles poderão enviar qualquer mensagem sem restrição",
      "Administradores do grupo já são protegidos automaticamente",
    ],
  },
  {
    number: "07",
    icon: Megaphone,
    title: "Enviar Mensagens em Massa",
    description: "Mande uma mensagem para vários grupos ao mesmo tempo.",
    details: [
      'Clique em "Divulgação" no menu',
      "Selecione os grupos de destino",
      "Escreva sua mensagem (pode incluir imagem)",
      "Envie agora ou agende para depois",
      "Pode configurar para repetir todo dia ou toda semana",
    ],
  },
  {
    number: "08",
    icon: Radar,
    title: "Buscar Novos Grupos",
    description: "Encontre e entre em grupos públicos automaticamente.",
    details: [
      'Clique em "Buscador" no menu',
      "Digite um tema (ex: vendas, marketing, crypto...)",
      "O sistema busca grupos públicos relacionados",
      "Você também pode colar links de convite manualmente",
      "Selecione os grupos e o bot entra automaticamente",
    ],
  },
  {
    number: "09",
    icon: BarChart3,
    title: "Acompanhar Estatísticas",
    description: "Veja tudo que acontece nos seus grupos.",
    details: [
      'Clique em "Analytics" no menu',
      "Veja quantos avisos e banimentos foram aplicados",
      "Acompanhe o crescimento dos seus grupos",
      "Receba um resumo diário automático com IA direto no grupo",
    ],
  },
];

const commands = [
  { cmd: "!menu", desc: "Mostra os comandos disponíveis", access: "Todos" },
  { cmd: "!regras", desc: "Mostra as regras do grupo", access: "Todos" },
  { cmd: "!info", desc: "Mostra informações do grupo", access: "Todos" },
  { cmd: "!warn", desc: "Dá um aviso a um membro (responda a mensagem dele)", access: "Admins" },
  { cmd: "!ban", desc: "Remove um membro do grupo (responda a mensagem dele)", access: "Admins" },
  { cmd: "!unwarn", desc: "Remove o último aviso de um membro", access: "Admins" },
];

export default function Tutorial() {
  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-4xl">
        <motion.div {...pageHeader}>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-cyan-400 shadow-lg shadow-primary/20">
              <BookOpen className="h-5 w-5 text-background" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Como Usar</h1>
              <p className="text-sm text-muted-foreground">Guia passo a passo para configurar o WhatsGuard</p>
            </div>
          </div>
        </motion.div>

        {/* Quick start */}
        <motion.div variants={fadeUpItem} initial="hidden" animate="visible">
          <Card className="glass-card border-primary/20 bg-primary/[0.03]">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-sm mb-1">⚡ Começando em 2 minutos</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="text-foreground font-medium">1)</span> Ative os grupos que quer proteger →{" "}
                    <span className="text-foreground font-medium">2)</span> Adicione palavras bloqueadas →{" "}
                    <span className="text-foreground font-medium">3)</span> Pronto! O bot já está moderando automaticamente. 🚀
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Steps */}
        <motion.div variants={fadeUpItem} initial="hidden" animate="visible" transition={{ delay: 0.1 }}>
          <Accordion type="multiple" className="space-y-3">
            {steps.map((step, i) => (
              <AccordionItem key={i} value={`step-${i}`} className="border-0">
                <Card className="glass-card overflow-hidden">
                  <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/10 transition-colors [&[data-state=open]]:border-b [&[data-state=open]]:border-border/20">
                    <div className="flex items-center gap-4 text-left">
                      <span className="text-xs font-bold text-primary/40 tabular-nums">{step.number}</span>
                      <step.icon className="h-4 w-4 text-primary shrink-0" />
                      <div>
                        <h3 className="text-sm font-semibold">{step.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-4 pt-3">
                    <ul className="space-y-2 ml-[52px]">
                      {step.details.map((detail, j) => (
                        <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <ChevronRight className="h-3 w-3 text-primary/40 mt-0.5 shrink-0" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>

        {/* Commands */}
        <motion.div variants={fadeUpItem} initial="hidden" animate="visible" transition={{ delay: 0.2 }}>
          <Card className="glass-card overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Terminal className="h-4 w-4 text-primary" />
                Comandos no WhatsApp
              </CardTitle>
              <p className="text-xs text-muted-foreground">Digite esses comandos diretamente no grupo</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/20">
                {commands.map((cmd, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/10 transition-colors">
                    <code className="text-xs font-mono font-semibold text-primary bg-primary/10 px-2 py-1 rounded-md whitespace-nowrap">
                      {cmd.cmd}
                    </code>
                    <span className="text-xs text-muted-foreground flex-1">{cmd.desc}</span>
                    <Badge variant={cmd.access === "Admins" ? "default" : "secondary"} className="text-[10px]">
                      {cmd.access}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tips */}
        <motion.div variants={fadeUpItem} initial="hidden" animate="visible" transition={{ delay: 0.3 }}>
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Dicas Úteis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                "O bot precisa ser administrador do grupo para funcionar corretamente.",
                "Administradores do grupo nunca são moderados pelo bot.",
                "Para usar !warn ou !ban, responda à mensagem do membro que quer avisar/banir.",
                "Você pode adicionar membros VIP na Whitelist para protegê-los da moderação.",
                "O resumo diário com IA é enviado automaticamente todo dia no grupo.",
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    {i + 1}
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">{tip}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
