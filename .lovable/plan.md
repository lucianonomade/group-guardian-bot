

## Plano: Automação, Analytics e Resumo Diário de Grupo

### 1. Comandos de Automação no WhatsApp

**Novos comandos no webhook (`whatsguard-webhook`):**
- `!menu` — Envia lista de todos os comandos disponíveis ao grupo
- `!regras` — Envia as regras do grupo (configuráveis pelo painel)
- `!info` — Mostra estatísticas rápidas do grupo (total membros, avisos ativos, bans)

**Configuração no painel:** Adicionar campo "Regras do grupo" na página de Grupos (ou nos detalhes do grupo) para que o admin defina o texto que o `!regras` envia.

**Banco de dados:** Adicionar coluna `rules_text` na tabela `groups` para armazenar as regras.

---

### 2. Resumo Diário do Grupo (com IA)

**Nova Edge Function (`daily-summary`):**
- Agendada via `pg_cron` para rodar uma vez por dia (ex: 22h)
- Para cada grupo monitorado, busca os `action_logs` do dia (avisos, bans, mensagens deletadas)
- Envia o resumo para a Lovable AI Gateway (Gemini Flash) pedindo um resumo formatado em português
- Envia o resumo como mensagem no grupo via Evolution API

**Nova tabela `daily_summaries`:**
- `id`, `group_id`, `user_id`, `summary_text`, `date`, `members_active` (JSON), `created_at`

**UI no Dashboard:** Card mostrando o último resumo de cada grupo, com opção de ver histórico.

---

### 3. Analytics e Relatórios no Dashboard

**Melhorias na página Index (Dashboard):**
- **Ranking de membros mais ativos:** Baseado na contagem de `action_logs` por participante (quem mais recebeu avisos, quem mais foi moderado)
- **Gráfico de crescimento:** Evolução de membros por grupo ao longo do tempo (requer tracking de `participant_count` com histórico)
- **Gráfico de moderação:** Avisos vs Bans por semana/mês

**Nova tabela `group_snapshots`:**
- `id`, `group_id`, `user_id`, `participant_count`, `snapshot_date`, `created_at`
- Populada automaticamente pela função `daily-summary` ou pelo sync de grupos

**Nova página `Analytics` (opcional):** Página dedicada com gráficos mais detalhados, filtros por grupo e período.

---

### 4. Mensagens Recorrentes (Agendamento)

**Extensão do Broadcast:**
- Adicionar opção de "recorrência" (diário, semanal) nos broadcasts
- Novo campo `recurrence` na tabela `broadcasts` (null = envio único, 'daily', 'weekly')
- O `broadcast-scheduler` já existente passa a verificar e re-agendar broadcasts recorrentes

---

### Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| `supabase/functions/whatsguard-webhook/index.ts` | Adicionar !menu, !regras, !info |
| `supabase/functions/daily-summary/index.ts` | Nova função de resumo diário com IA |
| `src/pages/Index.tsx` | Adicionar ranking de membros e gráficos extras |
| `src/pages/Groups.tsx` | Campo de regras do grupo |
| `src/pages/Analytics.tsx` | Nova página de analytics (opcional) |
| `src/App.tsx` | Nova rota /analytics |
| Migration: `groups` | Adicionar coluna `rules_text` |
| Migration: `daily_summaries` | Nova tabela |
| Migration: `group_snapshots` | Nova tabela para histórico |
| Migration: `broadcasts` | Adicionar coluna `recurrence` |
| SQL (insert tool): `pg_cron` | Agendar daily-summary |

### Ordem de implementação sugerida
1. Comandos !menu, !regras, !info (rápido, valor imediato)
2. Analytics no dashboard (ranking + gráficos)
3. Resumo diário com IA (mais complexo, maior impacto)
4. Mensagens recorrentes (extensão natural do broadcast)

