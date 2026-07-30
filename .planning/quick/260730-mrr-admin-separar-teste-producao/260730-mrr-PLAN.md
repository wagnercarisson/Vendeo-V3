---
phase: quick-mrr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  # Implementation plan only — no files created yet
autonomous: true
requirements: []
must_haves:
  truths:
    - "Admin Dashboard card 'Total de Usuários' mostra apenas usuários reais (exclui test stores)"
    - "Card 'Campanhas com Erro' no Dashboard exclui campanhas de test stores"
    - "Métricas pipeline-metrics (success rate, error rate, avg cost, etc.) excluem generation_events de test stores"
    - "Métricas de crédito/wallet (credits granted, refund rate, etc.) excluem transações de test stores"
    - "Lista de usuários no admin permite filtrar/ocultar test stores"
    - "Lista de erros de campanha não exibe campanhas de test stores"
    - "Concessão mensal de créditos (grant_monthly_credits) não concede para test stores"
  artifacts:
    - path: ".planning/quick/260730-mrr-admin-separar-teste-producao/260730-mrr-PLAN.md"
      provides: "Implementation plan with diagnosis, decisions, tasks, risks, acceptance criteria"
      min_lines: 300
  key_links:
    - from: "admin_get_users_summary RPC"
      to: "stores.is_test_store"
      via: "WHERE filter"
      pattern: "is_test_store"
    - from: "pipeline-metrics.ts functions"
      to: "generation_events JOIN stores"
      via: "join filter"
      pattern: "is_test_store"
    - from: "admin/campaigns/errors page/API"
      to: "campaigns JOIN stores"
      via: "join filter"
      pattern: "is_test_store"
---

# MRR — Separar Test Store de Produção no Admin

<objective>

**Purpose:** Investigar e produzir um plano de implementação detalhado para separar os dados de lojas de teste (`is_test_store = true`) dos dados reais de produção em todas as páginas, métricas, RPCs e APIs do admin.

**Output:** Plano de implementação com diagnóstico, decisões de design, lista de tarefas, riscos e critérios de aceite.

</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@src/lib/metrics/pipeline-metrics.ts
@src/app/(app)/admin/page.tsx
@src/app/(app)/admin/metrics/page.tsx
@src/app/(app)/admin/users/page.tsx
@src/app/(app)/admin/campaigns/errors/page.tsx
@src/app/(app)/admin/reviews/page.tsx
@src/app/api/admin/users/route.ts
@src/app/api/admin/campaigns/errors/route.ts
@src/app/api/admin/reviews/route.ts
@src/app/api/admin/credits/grant/route.ts
@src/app/api/admin/monthly-credits/grant/route.ts
@supabase/migrations/20260728000001_f33_cnpj_verification.sql
@supabase/migrations/20260718000001_create_admin_tables.sql
@supabase/migrations/20260727000001_freemium_anti_abuso_cnpj.sql
@supabase/migrations/20260722000002_creditos_mensais_automaticos.sql
@supabase/migrations/20260603000003_create_generation_events.sql
@supabase/migrations/20260718000002_expand_generation_events.sql
</context>

---

## 1. Diagnóstico Breve dos Pontos Atuais no Código

A coluna `stores.is_test_store` existe (F33), com índice parcial (`WHERE is_test_store = true`) e comentário no schema: _"Se true, loja é de teste (criada por admin). Excluída de métricas."_ **Porém nenhuma consulta no admin efetivamente a utiliza para filtrar.** Eis o diagnóstico ponto a ponto:

### 1.1. Admin Dashboard (`/admin`)
- **Query:** `supabaseAdmin.rpc("admin_get_users_summary", ...)` — RPC que **não filtra** `is_test_store`. O total de usuários exibido no card inclui test stores.
- **Campanhas com erro:** `supabaseAdmin.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "error")` — sem JOIN com stores, **sem filtro**.
- **Impacto:** Um admin vê números inflados. Se houver 5 test stores, o card mostra "Total de Usuários = 105" em vez de 100.

### 1.2. Admin Metrics (`/admin/metrics`)
- **Todas as funções em `pipeline-metrics.ts`** consultam `generation_events` diretamente, **sem JOIN com `stores`** e portanto **sem filtro `is_test_store`**:
  - `getSuccessRate`, `getErrorRate`, `getAvgCost`, `getAvgDuration` → filtram apenas por `generation_type` e `created_at`
  - `getActiveUsers` → conta `user_id` distintos em `generation_events`
  - `getCreditsGranted` → consulta `credit_transactions` diretamente
  - `getRefundRate`, `getVsRefundRate`, `getVsCreditsConsumed`, `getVsCreditsRefunded` → consultam `credit_transactions` diretamente
- **Tabelas envolvidas:** `generation_events` (tem `store_id` FK → `stores`), `credit_transactions` (tem `store_id` FK → `stores`)
- **Impacto:** Métricas de pipeline, de VS e de wallet são contaminadas por activity de test stores.

### 1.3. Campaign Errors (`/admin/campaigns/errors`)
- **Página (Server Component):** `supabaseAdmin.from("campaigns").select("*, stores(name)", { count: "exact" }).eq("status", "error")` — sem filtro por test store.
- **API Route:** Mesmo problema, `.eq("status", "error")` sem considerar `stores.is_test_store`.
- **Impacto:** Erros de test stores aparecem na lista de triagem, poluindo a visualização.

### 1.4. Users (`/admin/users` e `/api/admin/users`)
- **RPC `admin_get_users_summary`:** Já retorna `isTestStore` no JSON (adicionado na F33). A página usa isso para exibir badge "TESTE".
- **Mas não filtra:** O COUNT e o SELECT incluem test stores. O admin vê test stores na lista sem forma de ocultá-las.
- **Impacto:** Menor — o badge já identifica. Mas admins não podem filtrar "apenas produção" ou "apenas teste".

### 1.5. Reviews (`/admin/reviews` e `/api/admin/reviews`)
- **Query:** `supabaseAdmin.from("stores").select(...).eq("verification_status", status)` — sem filtro `is_test_store`.
- **Rota `GET /api/admin/reviews/[id]`:** Retorna `is_test_store` no body (correto).
- **Impacto:** Baixo — test stores criadas via admin já vêm com `verification_status = 'approved'` e não aparecem nas abas "Pendentes". Só aparecem se admin deliberadamente criar com outro status.

### 1.6. Concessão de Créditos (`/api/admin/credits/grant`)
- **RPC `admin_grant_credits`:** Concede créditos para qualquer `store_id`. Não verifica `is_test_store`.
- **Impacto:** Admin pode conceder créditos manuais para test stores. Desejável permitir (para testes), mas essas transações não devem entrar nas métricas de wallet.

### 1.7. Concessão Mensal de Créditos (`/api/admin/monthly-credits/grant` e RPC `grant_monthly_credits`)
- **RPC `grant_monthly_credits` (F27 versão):** Filtra por `cnpj_root_hash IS NOT NULL` e existência de transações `bonus_onboarding`/`bonus_monthly`. **Não filtra explicitamente `is_test_store`**.
- **Impacto:** Test stores com CNPJ preenchido e que passaram por onboarding podem receber créditos mensais — desperdício de créditos.

### 1.8. Audit Log (`/admin/audit-log`)
- **Query:** Direta na tabela `admin_audit_log`, sem relação com stores.
- **Impacto:** Nenhum. Audit log rastreia ações de admin, não dados de loja.

### 1.9. `update-cnpj` Route
- Já trata `is_test_store` como exceção: se API de CNPJ estiver indisponível e for test store, permite continuar com `defer`. Comportamento correto — não deve ser alterado.

---

## 2. Proposta de Comportamento Padrão para Produção/Teste/Todos

### Definição das views/modos:

| Modo | Filtro | Uso principal |
|------|--------|---------------|
| **Produção** (default) | `WHERE stores.is_test_store = false` | Métricas, dashboards, MRR, KPIs operacionais |
| **Teste** | `WHERE stores.is_test_store = true` | Debug, validação de fluxos novos |
| **Todos** | Sem filtro | Administração geral, busca de usuário específico |

### Regras por componente:

| Componente | Default | Oferece toggle? | Justificativa |
|------------|---------|-----------------|---------------|
| Dashboard `/admin` cards | Produção | Não | KPIs operacionais devem refletir apenas produção |
| Métricas `/admin/metrics` | Produção | Sim (query param `?view=all`) | Admins precisam comparar |
| Campaign Errors | Produção | Sim (checkbox "Incluir teste") | Triagem real não deve incluir teste |
| Users list | Todos | Sim (filtro "Tipo" com opções "Todos/Produção/Teste") | Admin precisa gerenciar ambos |
| Reviews | Todos | Não (test stores já approved) | Baixo impacto |
| Credit Grant manual | Permite ambos | N/A | Admin pode conceder para teste |
| Monthly Credits | Produção apenas | N/A | Não desperdiçar créditos |
| Audit Log | Todos | N/A | Sem relação com stores |

### Abordagem técnica:

**Opção A — Filtro no SQL/ORM via p_store_kind (recomendada):**
- Adicionar parâmetro `p_store_kind TEXT DEFAULT 'production'` em RPCs (equivalente a `production | test | all`)
- JOIN com `stores` e filtro explícito: `WHERE CASE WHEN p_store_kind = 'production' THEN s.is_test_store = FALSE WHEN p_store_kind = 'test' THEN s.is_test_store = TRUE ELSE TRUE END`
- ✅ Mais explícito, ✅ auditável, ✅ performático (índice parcial existe), ✅ suporta os 3 modos

**Opção B — Filtro via RLS policy:**
- Não recomendada — `supabaseAdmin` usa `service_role`, que bypassa RLS

**Opção C — Pós-filtro em memória:**
- Não recomendada — COUNT e métricas ficariam incorretas

**Opção D — NOT IN com IDs de test stores (plano inicial, revisada e rejeitada):**
- Rejeitada após validação — risco de formatação de array, tratamento incorreto de NULL, paginação inconsistente

**Decisão:** Opção A — parâmetro ternário `p_store_kind` com filtro SQL explícito.

### ❗ Decisão Técnica Revisada (pós-revisão do plano)

Após validação do usuário, as seguintes correções estruturais foram adotadas:

1. **Parâmetro ternário para filtro de store kind:** Usar `p_store_kind TEXT DEFAULT 'production'` com valores `production | test | all` em todas as RPCs que precisam de filtro por tipo de loja. Booleanos binários não suportam o modo "somente teste".
2. **Preservar compatibilidade:** Migrações RPC devem manter `p_verification_status` e demais parâmetros existentes — apenas adicionar `p_store_kind` sem quebrar chamadas atuais.
3. **Estratégia SQL > NOT IN:** Substituir `admin_get_test_store_ids + NOT IN` por RPCs SQL com `JOIN stores` e filtro explícito `WHERE s.is_test_store = (p_store_kind = 'test')` ou omitir para `'all'`. Isso elimina riscos de formatação de array, valores NULL e paginação inconsistente.
4. **Cobertura VS explícita:** Incluir `getVsSuccessRate`, `getVsErrorRate`, `getVsAvgDuration` nos critérios de aceite.
5. **Campaign Errors — corrigir select:** Trocar `.select("*, stores(name)")` por `.select("*, stores!inner(name, user_id, is_test_store)")` na página e na API.
6. **`/admin/metrics?view=all`:** Implementar de ponta a ponta (propagar `p_store_kind` de `AdminMetricsPage` → `fetchMetrics` → todas as funções de métricas) OU remover do escopo desta quick e registrar como tarefa futura. **Decisão:** Implementar agora (impacto cirúrgico nas funções de métricas).

---

## 3. Decisão Recomendada para Métricas de Wallet/Créditos

### Diagnóstico:
As funções de métricas de wallet (`getCreditsGranted`, `getVsCreditsConsumed`, `getVsCreditsRefunded`, `getRefundRate`, `getVsRefundRate`) consultam `credit_transactions` diretamente sem JOIN com `stores`.

### Decisão:

**Todas as métricas de wallet devem filtrar `is_test_store = false`** pelo mesmo motivo que as métricas de pipeline: o admin quer ver números reais de produção.

**Abordagem:** Adicionar JOIN interno com `stores` nas queries de `credit_transactions` que são usadas por métricas. Exemplo:

```sql
-- Antes
SELECT amount FROM credit_transactions WHERE type IN (...) AND created_at >= ...

-- Depois
SELECT ct.amount FROM credit_transactions ct
JOIN stores s ON s.id = ct.store_id AND s.is_test_store = FALSE
WHERE ct.type IN (...) AND ct.created_at >= ...
```

**Exceção:** A rota de concessão manual de créditos (`POST /api/admin/credits/grant`) continua permitindo conceder para test stores — o admin pode querer testar. Mas essas transações não entram nas métricas porque o JOIN as exclui.

**Sobre `grant_monthly_credits`:** Adicionar `AND s.is_test_store = FALSE` no WHERE do loop principal. Zero concessão para test stores.

---

## 4. Arquivos e Migrations/RPCs que Devem Ser Alterados

### 4.1. RPC `admin_get_users_summary`
- **Arquivo:** `supabase/migrations/...` (próxima migration)
- **Assinatura atual (F33):** `admin_get_users_summary(p_search TEXT DEFAULT NULL, p_page INTEGER DEFAULT 1, p_page_size INTEGER DEFAULT 20, p_verification_status TEXT DEFAULT NULL)`
- **Nova assinatura:** `admin_get_users_summary(p_search TEXT DEFAULT NULL, p_page INTEGER DEFAULT 1, p_page_size INTEGER DEFAULT 20, p_verification_status TEXT DEFAULT NULL, p_store_kind TEXT DEFAULT 'production')`
- **Mudança:** Adicionar `p_store_kind` ao final (reduz risco com chamadas posicionais). Valores: `'production' | 'test' | 'all'`. Quando `'production'`, filtrar `s.is_test_store = FALSE`; quando `'test'`, filtrar `s.is_test_store = TRUE`; quando `'all'`, omitir filtro. **Preservar defaults originais:** `p_page DEFAULT 1`, `p_page_size DEFAULT 20`.
- **⚠️ DROP FUNCTION obrigatório:** Como a assinatura muda, `CREATE OR REPLACE FUNCTION` não é suficiente — o PostgreSQL trata assinaturas diferentes como overloads. A migration deve executar `DROP FUNCTION IF EXISTS public.admin_get_users_summary(TEXT, INTEGER, INTEGER, TEXT)` antes do `CREATE OR REPLACE` para evitar ambiguidade.
- **⚠️ Preservar `p_verification_status`** — a página `/admin/users` já chama este parâmetro. Mantido como existente.

### 4.2. `pipeline-metrics.ts` (10 funções — incluir métricas VS)
- **Arquivo:** `src/lib/metrics/pipeline-metrics.ts`
- **Mudança:** Migrar de `NOT IN (testStoreIds)` para RPC SQL com `JOIN stores` e filtro explícito via `p_store_kind`. Ver seção 4.3 para a RPC de métricas.
- **Funções de geração a modificar:** `getSuccessRate`, `getErrorRate`, `getAvgCost`, `getAvgDuration`, `getActiveUsers`, **`getVsSuccessRate`**, **`getVsErrorRate`**, **`getVsAvgDuration`**
- **Funções de wallet a modificar:** `getCreditsGranted`, `getVsCreditsConsumed`, `getVsCreditsRefunded`, `getRefundRate`, `getVsRefundRate`, `classifyDomainRefunds`
- **Decisão:** Criar RPC dedicada `admin_get_metrics(p_store_kind TEXT, ...)` que recebe período, tipo de métrica e store_kind, fazendo o JOIN internamente no SQL. Isso elimina: (a) risco de formatação de array, (b) tratamento de NULL, (c) dupla query, (d) paginação inconsistente.

### 4.3. Nova RPC `admin_get_metrics`
- **Arquivo:** Próxima migration
- **Assinatura sugerida:** `admin_get_metrics(p_store_kind TEXT DEFAULT 'production', p_hours INTEGER DEFAULT 24, p_metric_type TEXT DEFAULT 'pipeline') RETURNS JSONB`
- **Ação:** 
  - JOIN `generation_events` com `stores` com filtro `WHERE CASE WHEN p_store_kind = 'production' THEN s.is_test_store = FALSE WHEN p_store_kind = 'test' THEN s.is_test_store = TRUE ELSE TRUE END`
  - Para métricas de wallet, JOIN equivalente em `credit_transactions`
  - **⚠️ Portar lógica cross-window de refunds:** O código atual em `classifyDomainRefunds` e `getVsCreditsRefunded` resolve refunds cujo `reference` aponta para uma `deduction` fora da janela de tempo. Na RPC SQL, isso significa: para cada refund em `credit_transactions` dentro da janela, fazer lookup do `reference` sem filtrar pela janela — se a deduction referenciada existir (em qualquer janela), o refund é contabilizado. Usar uma subquery separada ou CTE que busca `deduction` pelo `reference_id` sem restrição de `created_at`.
- **⚠️ DROP FUNCTION necessário:** `DROP FUNCTION IF EXISTS public.admin_get_metrics(p_store_kind TEXT, p_hours INTEGER, p_metric_type TEXT)` antes do `CREATE OR REPLACE`.
- **Retorno JSONB:** Estrutura com `{ pipeline: { total, success, error, avg_cost_ms, avg_duration_ms, active_users }, vs: { ... }, wallet: { credits_granted, credits_consumed, credits_refunded, refund_rate, vs_credits_consumed, vs_credits_refunded, vs_refund_rate } }` para que `fetchMetrics` possa chamar a RPC **uma vez por janela** (1h, 24h, 7d) e distribuir os resultados.
- **Alternativa:** Se o refactor para RPC única for grande demais para esta quick, criar RPC `admin_get_test_store_ids()` + usar `stores!inner()` no select do Supabase JS — porém documentar que esta é a estratégia de fallback, não a recomendada. **Decisão preferida:** RPC única.

### 4.4. Admin Dashboard (`/admin`)
- **Arquivo:** `src/app/(app)/admin/page.tsx`
- **Mudanças:**
  - Query de campanhas com erro: adicionar JOIN com stores e filtro `is_test_store = false`
  - RPC `admin_get_users_summary`: passar novo parâmetro `p_store_kind => 'production'`

### 4.5. Campaign Errors (`/admin/campaigns/errors`)
- **Arquivo:** `src/app/(app)/admin/campaigns/errors/page.tsx`
- **Mudança:** Adicionar filtro `is_test_store = false` via JOIN com stores
- **🐞 Correção adicional:** Trocar `.select("*, stores(name)")` por `.select("*, stores!inner(name, user_id, is_test_store)")` — a página atual tenta ler `stores.user_id` mas o select atual não o traz. O `!inner` garante que campanhas sem store sejam excluídas e que `user_id` esteja disponível para exibir email do usuário.
- **Toggle:** Adicionar query param `?include_test=1` para exibir todos (com badge TESTE)

### 4.6. API Campaign Errors (`/api/admin/campaigns/errors`)
- **Arquivo:** `src/app/api/admin/campaigns/errors/route.ts`
- **Mudança:** Mesmo filtro que a página + correção do select para `stores!inner(name, user_id, is_test_store)`

### 4.7. Admin Users (página e API)
- **Arquivos:** `src/app/(app)/admin/users/page.tsx`, `src/app/api/admin/users/route.ts`
- **Mudança:** Adicionar filtro "Tipo" (Todos/Produção/Teste) usando `p_store_kind`. A RPC já retorna `isTestStore` no JSON (adicionado na F33) — usar para exibir badge.
- **API Route:** Passar `p_store_kind` baseado no query param `?kind=production|test|all`
- **Default da página:** `kind=all` (para não quebrar a experiência atual de gerenciamento)

### 4.8. RPC `grant_monthly_credits`
- **Arquivo:** Próxima migration
- **Mudança:** Adicionar `AND s.is_test_store = FALSE` no WHERE do loop principal e na pré-contagem

### 4.9. RPC `admin_grant_credits`
- **Arquivo:** Próxima migration (ou nenhuma — decisão de design)
- **Decisão:** Não alterar. Admin deve poder conceder créditos para test stores. A métrica que exclui.

### 4.10. Test files
- **Arquivos:** `src/lib/metrics/__tests__/pipeline-metrics.test.ts`, `src/app/api/admin/__tests__/*.test.ts`
- **Mudança:** Atualizar mocks para incluir `stores` join behavior

---

## 5. Lista de Tarefas em Ordem

### Wave 1 — Migration + RPCs (Foundation)

**Task 1.1: Migration — Adicionar `p_store_kind` na RPC `admin_get_users_summary` + `grant_monthly_credits`**
- **Arquivo:** Nova migration `20260731000001_admin_test_store_filter.sql`
- **Ação em `admin_get_users_summary`:**
  1. `DROP FUNCTION IF EXISTS public.admin_get_users_summary(TEXT, INTEGER, INTEGER, TEXT)`
  2. `CREATE OR REPLACE FUNCTION public.admin_get_users_summary(p_search TEXT DEFAULT NULL, p_page INTEGER DEFAULT 1, p_page_size INTEGER DEFAULT 20, p_verification_status TEXT DEFAULT NULL, p_store_kind TEXT DEFAULT 'production')` — `p_store_kind` ao final (evita ambiguidade com chamadas posicionais). Preservar defaults: `p_page DEFAULT 1`, `p_page_size DEFAULT 20`. Quando `'production'`, adicionar `AND s.is_test_store = FALSE`; quando `'test'`, `AND s.is_test_store = TRUE`; quando `'all'`, omitir.
- **Ação em `grant_monthly_credits`:** Adicionar `AND s.is_test_store = FALSE` no WHERE do cursor principal e na pré-contagem.
- **Verify (usar named args — `p_store_kind` está ao final):**
  - `SELECT admin_get_users_summary(p_store_kind => 'production')` — retorna apenas produção
  - `SELECT admin_get_users_summary(p_store_kind => 'all')` — retorna todos (produção + teste)
  - `SELECT admin_get_users_summary(p_store_kind => 'test')` — retorna apenas test stores

**Task 1.2: Criar RPC de métricas `admin_get_metrics`**
- **Arquivo:** Mesma migration acima
- **Ação:** `DROP FUNCTION IF EXISTS public.admin_get_metrics(TEXT, INTEGER, TEXT)` + `CREATE OR REPLACE FUNCTION public.admin_get_metrics(p_store_kind TEXT DEFAULT 'production', p_hours INTEGER DEFAULT 24, p_metric_type TEXT DEFAULT 'pipeline') RETURNS JSONB` que:
  - JOIN `generation_events` com `stores` aplicando filtro por `p_store_kind`
  - Calcula sucesso, erro, custo médio, duração média, usuários ativos
  - Para `p_metric_type = 'all'` ou `'wallet'`, também JOIN `credit_transactions` com `stores`
  - **⚠️ Portar lógica cross-window de refunds:** Para cada refund na janela, buscar a deduction referenciada sem filtro de janela. Exemplo: CTE separada que faz lookup do `reference` em `credit_transactions` onde `type = 'deduction'` sem restrição de `created_at`. Se existir, o refund é contabilizado — mesmo que a deduction esteja fora da janela.
  - Retorna JSONB com estrutura: `{ pipeline: {total, success, error, avg_cost_ms, avg_duration_ms, active_users}, vs: {success_rate, error_rate, avg_duration_ms}, wallet: {credits_granted, credits_consumed, credits_refunded, refund_rate, vs_credits_consumed, vs_credits_refunded, vs_refund_rate} }` — **todas as métricas em uma chamada** para que `fetchMetrics` execute 3 chamadas (1h/24h/7d) em vez de N funções × 3 janelas.
- **RPC helper `admin_is_test_store(p_store_id UUID) RETURNS BOOLEAN`** — para validações pontuais (admin_grant_credits, etc.).
- **Verify:** Chamar com diferentes `p_store_kind` retorna valores esperados; taxas de refund batem com implementação atual (regressão zero).

### Wave 2 — Backend: pipeline-metrics.ts

**Task 2.1: pipeline-metrics.ts — Criar helper `fetchMetricsBundle` + refatorar funções para consumir bundle**
- **Arquivo:** `src/lib/metrics/pipeline-metrics.ts`
- **Ações:**
  - Criar função `fetchMetricsBundle(hours: number, storeKind: 'production' | 'test' | 'all'): Promise<MetricsBundle>` que chama `supabaseAdmin.rpc("admin_get_metrics", { p_store_kind: storeKind, p_hours: hours, p_metric_type: 'all' })` **uma vez** — retorna o JSONB completo com pipeline + VS + wallet
  - **Não chamar a RPC N vezes.** Em vez disso, `fetchMetrics(hours, storeKind?)` (função de topo já existente) chama `fetchMetricsBundle` para cada janela e distribui para as funções específicas via um cache simples (ex: `Map<string, MetricsBundle>` por `{hours, storeKind}`)
  - As funções `getSuccessRate`, `getErrorRate`, `getAvgCost`, `getAvgDuration`, `getActiveUsers`, `getVsSuccessRate`, `getVsErrorRate`, `getVsAvgDuration`, `getCreditsGranted`, `getVsCreditsConsumed`, `getVsCreditsRefunded`, `classifyDomainRefunds` passam a ler do bundle em vez de fazer query própria
  - `getRefundRate` e `getVsRefundRate` herdam via `classifyDomainRefunds`
  - Manter fallback para queries diretas caso a RPC não esteja disponível (degradação suave)
- **Verify:** Mesmo número de chamadas RPC de antes (3 por carregamento: 1h, 24h, 7d), resultados idênticos, `npm test -- src/lib/metrics/__tests__/pipeline-metrics.test.ts`

**Task 2.2: pipeline-metrics.ts — Adicionar `storeKind` nas funções e propagar**
- **Arquivo:** `src/lib/metrics/pipeline-metrics.ts`
- **Ações:**
  - Adicionar parâmetro `storeKind?: 'production' | 'test' | 'all'` em todas as funções exportadas (default: `'production'`)
  - Propagar `storeKind` para `fetchMetricsBundle` que o repassa para a RPC
  - `fetchMetrics(hours, storeKind?)` aceita e passa adiante
- **Verify:** `npm test -- src/lib/metrics/__tests__/pipeline-metrics.test.ts`

### Wave 3 — Admin Pages

**Task 3.1: Admin Dashboard — Excluir test stores dos cards**
- **Arquivo:** `src/app/(app)/admin/page.tsx`
- **Ações:**
  - Card "Total de Usuários": chamar `admin_get_users_summary` com `p_store_kind => 'production'`
  - Card "Campanhas com Erro": modificar query para usar `stores!inner()` com filtro `is_test_store = false`. Trocar `.select("*, stores(name)")` por `.select("*, stores!inner(name, user_id, is_test_store)").eq("stores.is_test_store", false)`.
- **Verify:** Testar manualmente que os cards mostram números menores que antes.

**Task 3.2: Campaign Errors — Filtrar test stores + toggle + corrigir select**
- **Arquivo:** `src/app/(app)/admin/campaigns/errors/page.tsx`
- **Ações:**
  - **🐞 Corrigir select:** Trocar `.select("*, stores(name)")` por `.select("*, stores!inner(name, user_id, is_test_store)")` — necessário porque a página tenta ler `stores.user_id` que não era trazido
  - Por padrão: adicionar `.eq("stores.is_test_store", false)` no encadeamento
  - Se `searchParams.include_test === "1"`: remover o filtro e exibir badge "TESTE"
  - Adicionar link/checkbox "Incluir lojas de teste"
- **API Route:** Modificar `src/app/api/admin/campaigns/errors/route.ts` com mesma lógica e correção de select
- **Verify:** Página sem param mostra só produção com dados completos (nome + email); com `?include_test=1` mostra tudo com badge

**Task 3.3: Admin Users — Adicionar filtro por tipo (Produção/Teste/Todos)**
- **Arquivo:** `src/app/(app)/admin/users/page.tsx`
- **Ações:**
  - Adicionar select "Tipo" com opções "Todos" (default), "Produção", "Teste"
  - Passar `p_store_kind => 'production' | 'test' | 'all'` para a RPC baseado na seleção
  - Badges "TESTE" já existem no retorno da RPC (campo `isTestStore`)
- **API Route:** Modificar `src/app/api/admin/users/route.ts` para aceitar query param `?kind=production|test|all`
- **Verify:** Select "Todos" mostra tudo; "Produção" filtra test stores; "Teste" mostra só test stores

**Task 3.4: Admin Metrics — Propagar `?view=all` de ponta a ponta**
- **Arquivo:** `src/app/(app)/admin/metrics/page.tsx` e `src/lib/metrics/pipeline-metrics.ts`
- **Ações:**
  - Ler `searchParams.view` na página (ex: `?view=all` → `storeKind='all'`, default → `storeKind='production'`)
  - Propagar `storeKind` para `fetchMetrics()` e daí para todas as funções de métrica
  - As funções já recebem `storeKind` por Task 2.1/2.2 — a página só precisa passar o valor
  - Adicionar indicador visual "Modo: Produção" / "Modo: Todos" no cabeçalho da página
- **Verify:** `/admin/metrics` mostra dados de produção; `/admin/metrics?view=all` inclui test stores; `fetchMetrics` faz exatamente 3 chamadas RPC (1h, 24h, 7d) independente de quantas funções de métrica existem

### Wave 4 — Testes

**Task 4.1: Pipeline metrics tests — Adicionar cenários com test store**
- **Arquivo:** `src/lib/metrics/__tests__/pipeline-metrics.test.ts`
- **Ações:** Adicionar cenários onde `generation_events` têm `store_id` de test store. Verificar que funções de métricas as excluem.
- **Verify:** `npm test -- src/lib/metrics/__tests__/pipeline-metrics.test.ts` — todos passando

**Task 4.2: Admin page tests — Adicionar cenários de filtro**
- **Arquivo:** `src/app/api/admin/__tests__/*.test.ts`
- **Ações:** Adicionar testes que verificam que campanhas de test store não aparecem nas respostas default
- **Verify:** `npm test -- src/app/api/admin/__tests__/` — todos passando

### Wave 5 — UAT Manual (ver plano abaixo)

---

## 6. Testes Automatizados Recomendados

### 6.1. Testes de Unidade (Vitest) — pipeline-metrics

| Teste | Descrição | Arquivo |
|-------|-----------|---------|
| `getSuccessRate excludes test stores` | Mock generation_events com store_id de test store, verifica que não entra no cálculo | `pipeline-metrics.test.ts` |
| `getVsSuccessRate excludes test stores` | Mock generation_events VS com test store | `pipeline-metrics.test.ts` |
| `getCreditsGranted excludes test store transactions` | Mock credit_transactions com store_id de test store | `pipeline-metrics.test.ts` |
| `getActiveUsers excludes test store users` | generation_events com user_id de test store | `pipeline-metrics.test.ts` |
| `getRefundRate excludes test store refunds` | Refund chain envolvendo test store | `pipeline-metrics.test.ts` |
| `p_store_kind='test' retorna só test stores` | Verificar filtro ternário | `pipeline-metrics.test.ts` |
| `p_store_kind='all' retorna tudo` | Verificar que 'all' inclui test stores | `pipeline-metrics.test.ts` |

### 6.2. Testes de API (Vitest)

| Teste | Descrição | Arquivo |
|-------|-----------|---------|
| `GET /api/admin/campaigns/errors excludes test stores` | Criar campanha de erro em test store, não aparece na resposta default | `campaigns-errors.test.ts` |
| `GET /api/admin/campaigns/errors?include_test=1 includes test stores` | Mesmo cenário, com param opcional | `campaigns-errors.test.ts` |
| `GET /api/admin/users?kind=production` | RPC chamada com `p_store_kind='production'` | `users.test.ts` |
| `GET /api/admin/metrics?view=all` | Métricas incluem test stores | `metrics.test.ts` |

### 6.3. Testes de RPC (SQL direto)

| Teste | Descrição |
|-------|-----------|
| `admin_get_users_summary(p_store_kind => 'production') < ...(p_store_kind => 'all')` | Verificar que produção < total (named args obrigatório) |
| `admin_get_users_summary(p_store_kind => 'test')` | Retorna apenas test stores | |
| `admin_get_metrics('production') < admin_get_metrics('all')` | Métricas de produção < total | |
| `grant_monthly_credits não concede para test stores` | Criar test store elegível, executar RPC, verificar 0 concessões |

---

## 7. UAT Manual Recomendado

### Pré-condição
- Existir ao menos 1 test store com campanhas, créditos, erros
- Existir ao menos 1 production store com campanhas, créditos, erros

### Roteiro

| # | Passo | Resultado esperado |
|---|-------|--------------------|
| 1 | Acessar `/admin` | Cards "Total de Usuários" e "Campanhas com Erro" mostram números de produção apenas |
| 2 | Acessar `/admin/metrics` | Métricas de pipeline, VS e wallet refletem apenas produção |
| 3 | Acessar `/admin/metrics?view=all` | Métricas incluem test stores (quando implementado) |
| 4 | Acessar `/admin/campaigns/errors` | Nenhuma campanha de test store aparece |
| 5 | Acessar `/admin/campaigns/errors?include_test=1` | Campanhas de test stores aparecem com badge "TESTE" |
| 6 | Acessar `/admin/users` | Select "Tipo" presente, default "Todos" |
| 7 | Selecionar "Produção" em `/admin/users` | Apenas production stores aparecem |
| 8 | Selecionar "Teste" em `/admin/users` | Apenas test stores aparecem |
| 9 | Acessar `/admin/users/{test_user_id}` | Badge "TESTE" visível, dados normais |
| 10 | Executar monthly grant manualmente (RPC) | Nenhum crédito concedido para test stores |
| 11 | Verificar audit log | Ações em test stores ainda aparecem |

---

## 8. Riscos e Cuidados

### 8.1. Performance
- **Risco:** Chamar `admin_get_metrics()` via RPC em todas as funções de métrica pode adicionar latência.
- **Mitigação:** A RPC é uma única chamada SQL com JOIN indexado (índice parcial em `stores.is_test_store` existe). O número de test stores é pequeno (tipicamente < 10). A RPC retorna todos os agregados em uma resposta JSONB — substituindo N queries separadas por 1. Resultado: **mais rápido que o atual**.
- **Plano B:** Se latência for problema, cache de 30s nas métricas do admin.

### 8.2. `store_id` nulo em `generation_events`
- **Risco:** Eventos de sistema sem `store_id` (valor NULL) podem ser incorretamente tratados.
- **Mitigação:** Com `JOIN stores`, registros com `store_id IS NULL` são naturalmente excluídos (INNER JOIN). Isso é correto: eventos de sistema não têm store vinculada e representam operações internas, não atividade de loja. Se algum evento de sistema precisar ser incluído, usar LEFT JOIN com filtro condicional.

### 8.3. Valores negativos no toggle
- **Risco:** Admin pode esquecer de incluir test stores e tomar decisão baseada em dados incompletos.
- **Mitigação:** Adicionar indicador visual sutil "Modo: Produção" ou "Modo: Todos" na página de métricas. Não necessário para dashboard (só produção faz sentido).

### 8.4. RPC `admin_grant_credits` sem proteção
- **Risco:** Se métricas excluem test stores mas concedemos créditos, admin pode achar que créditos "sumiram".
- **Mitigação:** Aceitar como comportamento deliberado. Adicionar badge "TESTE" na página de concessão se a store alvo for test store, com microcopy: "Store de teste — transações não aparecem nas métricas de produção."

### 8.5. Test stores com dados reais de CNPJ
- **Risco:** Test stores podem ter CNPJ real, passando por `cnpj_root_hash IS NOT NULL` no monthly grant.
- **Mitigação:** O filtro `AND s.is_test_store = FALSE` na RPC `grant_monthly_credits` resolve.

### 8.6. Quebra de compatibilidade
- **Risco:** Mudar a assinatura da RPC `admin_get_users_summary` quebra chamadas existentes (especialmente `p_verification_status`).
- **Mitigação:** A nova migration `CREATE OR REPLACE FUNCTION` deve incluir **todos os parâmetros existentes** (`p_verification_status TEXT DEFAULT NULL`) mais o novo `p_store_kind TEXT DEFAULT 'production'`. DEFAULT garante que chamadas existentes sem o novo parâmetro continuem funcionando com comportamento padrão 'production'. Testar: verificar que a página `/admin/users` carrega sem erros antes e depois da migration.

### 8.7. Testes existentes
- **Risco:** Testes existentes de pipeline metrics podem quebrar se os mocks não incluírem `store_id` ou o comportamento de filtro.
- **Mitigação:** Atualizar mocks para incluir `store_id` e garantir que os testes cubram ambos os cenários (com e sem test stores).

---

## 9. Critério de Aceite

O plano será considerado implementado com sucesso quando:

1. ✅ **Dashboard** — Card "Total de Usuários" reflete apenas produção (admins podem ver diferença de ao menos 1 usuário)
2. ✅ **Métricas de pipeline (geração)** — `getSuccessRate`, `getErrorRate`, `getAvgCost`, `getAvgDuration`, `getActiveUsers` NÃO incluem eventos de test stores
3. ✅ **Métricas de pipeline (VS)** — `getVsSuccessRate`, `getVsErrorRate`, `getVsAvgDuration` NÃO incluem eventos de test stores (correção pós-revisão)
4. ✅ **Métricas de wallet/créditos** — `getCreditsGranted`, `getVsCreditsConsumed`, `getVsCreditsRefunded`, `getRefundRate`, `getVsRefundRate` NÃO incluem transações de test stores
5. ✅ **Campaign Errors page** — Default mostra apenas erros de production; `?include_test=1` inclui test stores com badge. Select corrigido para `stores!inner(name, user_id, is_test_store)` — nome e email do usuário aparecem.
6. ✅ **Campaign Errors API** — Comportamento equivalente à página
7. ✅ **Users page** — Select "Tipo" (Todos/Produção/Teste) funcional, badges TESTE corretos, `p_verification_status` preservado
8. ✅ **Monthly credits** — `grant_monthly_credits` não concede para test stores
9. ✅ **Tests** — Todos os testes novos e existentes passam (lint + typecheck + build + test)
10. ✅ **UAT** — 11/11 passos do roteiro manual executados com sucesso
11. ✅ **Nenhuma regression** — Funcionalidades existentes de admin (grant manual, reviews, audit log, user detail, `p_verification_status`) continuam funcionando

---

## Resumo da Arquitetura de Mudanças

```
┌──────────────────────────────────────────────────────────┐
│                    Migration SQL                          │
│  • admin_get_users_summary: +p_store_kind (production|   │
│    test|all) preservando p_verification_status           │
│  • admin_get_metrics: nova RPC com JOIN stores +         │
│    filtro por p_store_kind (cobre geração, VS, wallet)   │
│  • admin_is_test_store(): nova RPC helper                │
│  • grant_monthly_credits: +WHERE is_test_store = false   │
└──────────────────────┬───────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────┐
│              pipeline-metrics.ts                          │
│  • fetchMetricsBundle() chama admin_get_metrics()         │
│    UMA vez por janela (1h/24h/7d) para bundle completo   │
│  • Funções específicas leem do bundle, sem N chamadas     │
│  • Parâmetro storeKind propagado de páginas admin         │
│  • Sem NOT IN, sem busca de IDs em JS                    │
│  • Inclui getVsSuccessRate, getVsErrorRate,              │
│    getVsAvgDuration + cross-window refund logic          │
└──────────────────────┬───────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────┐
│              Admin Pages + API Routes                     │
│  Dashboard:   RPC com p_store_kind='production'          │
│  Errors:      stores!inner(name, user_id, is_test_store) │
│               + filtro + toggle                           │
│  Users:       Select tipo → p_store_kind na RPC          │
│  Metrics:     Query param ?view=all → storeKind='all'    │
│               propagado até admin_get_metrics            │
└──────────────────────┬───────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────┐
│              Testes + UAT                                 │
│  Unit:    pipeline-metrics.test.ts (6 novos cenários)     │
│  API:     campaigns-errors.test.ts + users.test.ts       │
│  Manual:  11 passos UAT                                  │
└──────────────────────────────────────────────────────────┘
```

---

## PLANNING COMPLETE

**Plan path:** `.planning/quick/260730-mrr-admin-separar-teste-producao/260730-mrr-PLAN.md`

**Wave Structure:**

| Wave | Tasks | Description |
|------|-------|-------------|
| 1 | 1.1, 1.2 | Migration — `admin_get_users_summary` com assinatura completa + `p_store_kind` ao final + DROP explícito; `admin_get_metrics` com cross-window refund logic; `grant_monthly_credits` filter |
| 2 | 2.1, 2.2 | `pipeline-metrics.ts` — criar `fetchMetricsBundle` (1 chamada/janela) + distribuir para funções; adicionar `storeKind` param |
| 3 | 3.1–3.4 | Admin pages — Dashboard, Campaign Errors (toggle + fix stores!inner), Users (filtro ternário), Metrics (propagar `?view=all`) |
| 4 | 4.1, 4.2 | Tests — pipeline metrics + admin API (6+ novos cenários) |
| 5 | Manual UAT | Roteiro 11 passos |

**Next Step:** Execute via `/gsd-execute-phase quick-mrr` or implement tasks individually starting with Wave 1 (migration).
