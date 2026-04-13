

# Backup e Restauração de Configurações de Grupo

## Visão geral

Criar uma funcionalidade que permite exportar todas as configurações de um grupo (regras, palavras bloqueadas, whitelist, antiflood) como um "template de backup" salvo no banco, e depois aplicar esse template a outros grupos com um clique.

## Estrutura

### 1. Banco de dados — Nova tabela `group_backups`

```sql
CREATE TABLE group_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  source_group_name text,
  rules_text text,
  blocked_words jsonb DEFAULT '[]',
  whitelist_entries jsonb DEFAULT '[]',
  antiflood_settings jsonb,
  created_at timestamptz DEFAULT now()
);
-- RLS: user_id = auth.uid() para SELECT, INSERT, DELETE
```

Os dados são armazenados como JSON snapshot no momento do backup — independente do grupo original.

### 2. Nova página `src/pages/BackupPage.tsx`

Duas seções principais:

- **Criar Backup**: Selecionar um grupo existente → busca regras, palavras bloqueadas, whitelist e antiflood daquele grupo → salva como template com um nome personalizado.
- **Lista de Backups**: Mostra os templates salvos com botão "Restaurar" que abre um seletor de grupo(s) destino.

**Restauração**: Ao aplicar um backup a um grupo, o sistema:
1. Atualiza `groups.rules_text` e `groups.welcome_message`
2. Insere palavras bloqueadas (evitando duplicatas)
3. Insere entradas de whitelist (evitando duplicatas)
4. Cria/atualiza `antiflood_settings` para o grupo

### 3. Navegação

- Adicionar item "Backup" com ícone `Archive` na sidebar do `DashboardLayout.tsx`
- Registrar rota `/backup` no `App.tsx` como rota protegida

### 4. Botão rápido na página de Grupos

Na tabela de grupos (`Groups.tsx`), adicionar um botão de ação "Exportar Config" por grupo, que cria o backup diretamente com um clique.

## Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar tabela `group_backups` com RLS |
| `src/pages/BackupPage.tsx` | Nova página completa |
| `src/App.tsx` | Adicionar rota `/backup` |
| `src/components/DashboardLayout.tsx` | Adicionar link na sidebar |
| `src/pages/Groups.tsx` | Botão "Exportar Config" por grupo |

