
## Sistema de Gerenciamento de Grupos WhatsApp com Evolution API

### Visão Geral
Dashboard web completo para gerenciar bot de moderação de grupos WhatsApp, integrado com Evolution API. O bot apaga links e palavras proibidas, aplica sistema de avisos (2 avisos + banimento no 3º).

### Funcionalidades

#### 1. Autenticação
- Login/cadastro de administradores com Supabase Auth
- Rotas protegidas para o dashboard

#### 2. Configuração da Instância Evolution API
- Tela para cadastrar URL e API Key da Evolution API
- Salvar credenciais como secrets no Supabase
- Status de conexão da instância (online/offline)

#### 3. Dashboard Principal
- Visão geral: total de grupos monitorados, avisos dados, banimentos
- Lista de grupos conectados com status
- Atividade recente (últimas ações do bot)

#### 4. Gerenciamento de Grupos
- Lista de grupos com busca e filtro
- Detalhes do grupo: membros, avisos ativos, banimentos
- Histórico de ações por grupo

#### 5. Sistema de Avisos e Banimentos
- Tabela de avisos por usuário/grupo (0, 1, 2 avisos)
- Histórico de banimentos
- Possibilidade de resetar avisos manualmente
- Possibilidade de desbanir usuários

#### 6. Lista de Palavras Proibidas
- CRUD completo: adicionar, editar, remover palavras
- Categorias (palavrões, pornografia, etc.)
- Importar/exportar lista

#### 7. Webhook (Edge Function)
- Receber eventos da Evolution API (mensagens de grupo)
- Detectar links em mensagens → apagar mensagem + enviar aviso
- Detectar palavras proibidas → apagar mensagem + enviar aviso
- Contabilizar avisos: no 3º, banir o usuário do grupo
- Enviar mensagem personalizada de aviso e banimento

#### 8. Banco de Dados (Supabase)
- Tabelas: instances, groups, warnings, bans, blocked_words
- RLS policies para segurança
- Triggers para contagem automática de avisos

### Stack
- **Frontend**: React + Tailwind + shadcn/ui
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **Integração**: Evolution API via Edge Function webhook
