

## Plano: Comandos no WhatsApp + Painel de Membros + Anti-flood

### 1. Comandos no WhatsApp (!ban, !warn, !mute, !unmute)

**Webhook (`whatsguard-webhook/index.ts`):** Adicionar detecção de comandos antes da verificação de violações. Quando uma mensagem começar com `!`, verificar se o remetente é admin do grupo e executar a ação:
- `!ban @usuario` — remove e registra ban
- `!warn @usuario [motivo]` — adiciona aviso manual
- `!unwarn @usuario` — reseta avisos do usuário
- `!mute @usuario [minutos]` — (futuro) silencia temporariamente

**Banco de dados:** Nenhuma alteração necessária — reutiliza as tabelas `warnings`, `bans` e `action_logs`.

**Lógica:** O webhook verifica se o participante é admin do grupo via Evolution API antes de processar o comando. Comandos de não-admins são ignorados.

---

### 2. Painel de Membros do Grupo

**Nova action na Edge Function (`evolution-manager`):** Adicionar `fetch-group-participants` que busca os membros de um grupo específico via Evolution API.

**Nova página (`src/pages/GroupMembers.tsx`):** Acessível ao clicar em um grupo na lista. Exibe:
- Lista de todos os membros com nome, JID, role (admin/membro)
- Quantidade de avisos ativos de cada membro
- Botões de ação rápida: dar aviso, resetar avisos, banir, adicionar à whitelist
- Busca e filtros (por role, por nº de avisos)

**Rota:** `/groups/:groupId/members`

---

### 3. Anti-flood / Rate Limit

**Banco de dados:** Criar tabela `antiflood_settings` com campos:
- `group_id`, `user_id`, `max_messages` (default 5), `time_window_seconds` (default 10), `is_enabled` (default true)

**Webhook:** Adicionar verificação de flood antes das verificações de link/palavra:
- Manter cache em memória (Map) com contagem de mensagens por participante/grupo
- Se exceder o limite → aplicar aviso automático como violação tipo `flood`

**UI na página de Grupos:** Adicionar botão de configuração anti-flood por grupo, com campos para definir limite de mensagens e janela de tempo.

---

### Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| `supabase/functions/whatsguard-webhook/index.ts` | Adicionar comandos + anti-flood |
| `supabase/functions/evolution-manager/index.ts` | Adicionar `fetch-group-participants` |
| `src/pages/GroupMembers.tsx` | Nova página de membros |
| `src/pages/Groups.tsx` | Link para membros |
| `src/App.tsx` | Nova rota `/groups/:groupId/members` |
| `supabase/migrations/..._antiflood.sql` | Tabela `antiflood_settings` com RLS |

