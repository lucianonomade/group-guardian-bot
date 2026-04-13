import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { fadeUpItem, pageHeader } from "@/lib/animations";
import {
  Settings, Users, MessageSquare, ShieldAlert, Ban, AlertTriangle,
  MessageSquareOff, ShieldCheck, Megaphone, Radar, BarChart3,
  BookOpen, Zap, ChevronRight, Terminal, Send, Clock
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const steps = [
  {
    number: "01",
    icon: Settings,
    title: "Conectar a Instância",
    description: "Configure sua instância da Evolution API para conectar o WhatsGuard ao seu WhatsApp.",
    details: [
      'Acesse "Configurações" no menu lateral',
      "Clique em \"Nova Instância\" e preencha os dados:",
      "• Nome: identificador da instância (ex: meu-bot)",
      "• URL da API: endereço da sua Evolution API",
      "• Chave da API: apikey da sua Evolution API",
      "Clique em Salvar e escaneie o QR Code para conectar",
      "O status ficará verde quando estiver online",
    ],
  },
  {
    number: "02",
    icon: Users,
    title: "Sincronizar Grupos",
    description: "Os grupos do WhatsApp são importados automaticamente ao acessar a página de Grupos.",
    details: [
      'Acesse "Grupos" no menu lateral',
      "A sincronização automática inicia ao abrir a página",
      "Todos os grupos da instância serão listados",
      'Ative o switch "Monitorar" nos grupos desejados',
      "Somente grupos monitorados terão moderação ativa",
    ],
  },
  {
    number: "03",
    icon: MessageSquareOff,
    title: "Configurar Palavras Bloqueadas",
    description: "Defina palavras e expressões proibidas que serão filtradas automaticamente.",
    details: [
      'Acesse "Palavras Bloqueadas" no menu lateral',
      "Adicione palavras por categoria (spam, ofensas, links, etc.)",
      "Mensagens com essas palavras serão apagadas automaticamente",
      "O membro receberá um aviso (warning) automático",
      "Após 3 avisos, o membro é banido do grupo",
    ],
  },
  {
    number: "04",
    icon: ShieldCheck,
    title: "Configurar Whitelist",
    description: "Membros na whitelist são imunes à moderação automática.",
    details: [
      'Acesse "Whitelist" no menu lateral',
      "Adicione o JID do membro (número@s.whatsapp.net)",
      "Opcionalmente, vincule a um grupo específico",
      "Membros na whitelist podem enviar qualquer mensagem sem restrição",
      "Admins do grupo já são automaticamente ignorados pela moderação",
    ],
  },
  {
    number: "05",
    icon: MessageSquare,
    title: "Mensagem de Boas-vindas",
    description: "Configure uma mensagem automática para novos membros dos grupos.",
    details: [
      'Na página "Grupos", clique em "Configurar" na coluna Boas-vindas',
      "Use {name} para incluir o nome do novo membro",
      "Use {group} para incluir o nome do grupo",
      "Exemplo: Bem-vindo(a), {name}! 👋 Leia as regras do {group}.",
      "A mensagem é enviada automaticamente quando alguém entra",
    ],
  },
  {
    number: "06",
    icon: BookOpen,
    title: "Regras do Grupo",
    description: "Defina as regras que serão exibidas com o comando !regras.",
    details: [
      'Na página "Grupos", clique em "Configurar" na coluna Regras',
      "Escreva as regras do grupo no campo de texto",
      "Qualquer membro pode digitar !regras para vê-las",
      "Mantenha as regras claras e objetivas",
    ],
  },
  {
    number: "07",
    icon: ShieldAlert,
    title: "Anti-flood",
    description: "Proteja os grupos contra spam de mensagens em sequência.",
    details: [
      'Na página "Grupos", clique em "Configurar" na coluna Anti-flood',
      "Defina o limite de mensagens (ex: 10 mensagens)",
      "Defina a janela de tempo (ex: 30 segundos)",
      "Se um membro ultrapassar o limite, receberá um aviso",
      "Membros da whitelist são imunes ao anti-flood",
    ],
  },
  {
    number: "08",
    icon: Megaphone,
    title: "Broadcast / Divulgação",
    description: "Envie mensagens em massa para múltiplos grupos de uma vez.",
    details: [
      'Acesse "Divulgação" no menu lateral',
      "Selecione a instância e os grupos de destino",
      "Escreva a mensagem (suporta texto e imagem)",
      "Escolha envio imediato ou agendado (data/hora futura)",
      "Configure recorrência diária ou semanal se desejado",
      "Acompanhe o status de envio na lista de broadcasts",
    ],
  },
  {
    number: "09",
    icon: Radar,
    title: "Buscador de Grupos",
    description: "Encontre e entre em novos grupos automaticamente baseado em temas.",
    details: [
      'Acesse "Buscador" no menu lateral',
      "Digite um tema/palavra-chave para buscar grupos públicos",
      "Ou cole links de convite manualmente (um por linha)",
      "O sistema valida cada link automaticamente",
      "Selecione os grupos válidos e clique em Entrar",
      "O bot entrará automaticamente nos grupos selecionados",
    ],
  },
  {
    number: "10",
    icon: BarChart3,
    title: "Analytics e Relatórios",
    description: "Acompanhe estatísticas de moderação e atividade dos grupos.",
    details: [
      'Acesse "Analytics" no menu lateral',
      "Veja estatísticas de avisos, banimentos e ações",
      "Acompanhe o crescimento dos grupos ao longo do tempo",
      "O resumo diário com IA é enviado automaticamente no grupo",
    ],
  },
];

const commands = [
  { cmd: "!menu", desc: "Exibe o menu de comandos disponíveis", access: "Todos" },
  { cmd: "!regras", desc: "Exibe as regras configuradas do grupo", access: "Todos" },
  { cmd: "!info", desc: "Mostra informações do grupo e do bot", access: "Todos" },
  { cmd: "!warn @membro", desc: "Adiciona um aviso a um membro (marque ou responda)", access: "Admins" },
  { cmd: "!ban @membro", desc: "Bane um membro do grupo (marque ou responda)", access: "Admins" },
  { cmd: "!unwarn @membro", desc: "Remove o último aviso de um membro", access: "Admins" },
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
              <h1 className="text-2xl font-bold tracking-tight">Tutorial</h1>
              <p className="text-sm text-muted-foreground">Guia completo para configurar e usar o WhatsGuard</p>
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
                  <h3 className="font-semibold text-sm mb-1">Início Rápido</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Para começar a usar: <span className="text-foreground font-medium">1)</span> Conecte sua instância Evolution API nas Configurações → <span className="text-foreground font-medium">2)</span> Sincronize e ative os grupos → <span className="text-foreground font-medium">3)</span> Adicione palavras bloqueadas. O bot já estará moderando!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Steps accordion */}
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
                          {detail.startsWith("•") ? (
                            <span className="ml-3">{detail}</span>
                          ) : (
                            <>
                              <ChevronRight className="h-3 w-3 text-primary/40 mt-0.5 shrink-0" />
                              <span>{detail}</span>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>

        {/* Commands reference */}
        <motion.div variants={fadeUpItem} initial="hidden" animate="visible" transition={{ delay: 0.2 }}>
          <Card className="glass-card overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Terminal className="h-4 w-4 text-primary" />
                Comandos do Bot
              </CardTitle>
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
                Dicas Importantes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                "O bot precisa ser administrador do grupo para apagar mensagens e remover membros.",
                "Administradores do grupo são automaticamente imunes à moderação.",
                "Use a Whitelist para proteger membros específicos de serem moderados.",
                "O webhook da Evolution API deve apontar para a Edge Function do WhatsGuard.",
                "Mensagens enviadas pelo próprio número da instância são processadas como admin.",
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
