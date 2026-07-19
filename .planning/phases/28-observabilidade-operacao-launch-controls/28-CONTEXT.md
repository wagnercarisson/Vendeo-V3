# Phase 28: Observabilidade + Operação + Launch Controls — Context

**Gathered:** 2026-07-19
**Status:** Ready for planning
**Source:** OpenSpec `openspec/changes/fase-28-observabilidade-operacao-launch-controls/`

<domain>
## Phase Boundary

A v1.5 está com 6/7 fases concluídas — o motor de campanha com créditos, copy IA, admin operacional e saldo visível está implementado e testado (~852 testes). O que falta para o lançamento externo controlado não é funcionalidade, é **instrumentação para operar com confiança**: o pipeline de geração não tem observabilidade (logs ad-hoc, sem formato estruturado, sem telemetria de IA persistida), não há feature flag para rollout seguro, não existe documentação operacional (deploy, rollback, runbook), e o time não tem visibilidade agregada da saúde do sistema.

Esta fase instala os instrumentos de operação sem melhorar o produto — prepara a operação para abrir para usuários reais.

**Estado atual (pós-F27):**
- Pipeline de geração sem logs estruturados (console.log ad-hoc)
- Sem feature flags — rollout v1.5 é all-or-nothing
- Sem telemetria de IA persistida (tokens, custo, modelo) em generation_events
- Sem dashboard de métricas operacionais
- Sem documentação de deploy, rollback ou suporte
- Sem função de cleanup para retenção de 90 dias
- `process.env` espalhado em múltiplos serviços
- `checkRateLimit()` sem flag de bypass

**Dependências:** F24 (credit_balances, credit_transactions), F25 (generation_rate_events, rate-limit, pipeline route), F26 (admin layout, admin gate)

**Nenhuma nova tabela** — apenas ALTER CHECK + ADD COLUMNS em `generation_events`

</domain>

<decisions>
## Implementation Decisions

### D1 — Launch config como módulo central com env vars, não tabela

`DECIDIDO`

Flags explícitas em `src/lib/launch-config/config.ts` lidas de environment variables via `getLaunchConfig()`. Cinco flags booleanas com defaults seguros (todas true exceto `generationPaused=false`).

**Alternativa rejeitada:** Flag única `v15-credits-enabled` com 3 comportamentos implícitos. Rejeitada porque "desligar a flag" deveria significar coisas diferentes para charging, copy director e rate limit — uma única flag torna o comportamento ambíguo e perigoso para operação.

**Alternativa rejeitada:** Tabela `feature_flags` no banco. Rejeitada por adicionar dependência externa e latência de leitura. Env vars são toggleáveis via Vercel (re-deploy ou instantâneo). O helper `getLaunchConfig()` encapsula a fonte, permitindo migração futura para tabela sem mudar callers.

**Regra principal (preservar):** Flags lidas centralmente via `getLaunchConfig()` e decisões aplicadas no pipeline — sem `process.env` espalhado em serviços internos. `CreditService` e `CopyDirectorService` **não verificam flags**. A decisão pertence ao pipeline.

**Contrato com o pipeline:**
- `v15Enabled=false` → desliga todas as outras (exceto `generationPaused`). Pipeline roda como v1.4
- `creditsChargingEnabled=false` → pipeline não chama `getBalance()`/`reserveCredit()`
- `copyDirectorEnabled=false` → `publication_copy_snapshot` populado via fallback determinístico
- `rateLimitEnabled=false` → `checkRateLimit()` sempre retorna `allowed: true`
- `generationPaused=true` → `POST /api/campaign/generate-image` retorna 503 antes de qualquer operação. **Sobrescreve todas as outras flags**

**Onde as flags são verificadas (apenas na orquestração do pipeline):**
- `generate-image/route.ts` — todas as 5 flags
- `rate-limit.ts` — `rateLimitEnabled`
- `CreditService` e `CopyDirectorService` — **não verificam flags**

### D2 — Logging estruturado como helper central, sem lib externa

`DECIDIDO`

Helper `logPipelineEvent()` em `src/lib/logging/pipeline-logger.ts` que sempre emite JSON via `console.log(JSON.stringify(event))`.

**Contrato:**
- Sem lib externa (Pino, Winston) — mantém dependência zero
- Sempre sem base64, sem prompt completo, sem dados sensíveis
- `traceId` gerado por request (`randomUUID()`) e propagado em todas as etapas
- Cada etapa emite 2 eventos: `running` e `complete|failed`
- Fire-and-forget — nunca bloqueia o pipeline
- Não substitui eventos NDJSON para o cliente — são canais diferentes

**Pipeline stages que emitem eventos:**
- PRÉ-STREAM: `rate_limit_check`, `balance_check`, `campaign_create`, `credit_reserve`
- PARALELO: `copy_generation`, `image_generation`
- PÓS-PARALELO: `merge`, `upload`, `update_ready`, `credit_confirm`, `credit_refund`

### D3 — Telemetria via expansão de `generation_events`, não tabela nova

`DECIDIDO`

A tabela `generation_events` já existe com estrutura base (provider, model, duration_ms, estimated_cost_usd, status, metadata, created_at) e política de retenção de 90 dias. A F28 expande sem criar schema novo.

**Migration:**
1. Remover CHECK constraint existente
2. Adicionar nova CHECK constraint aceitando: `visual_signature`, `brand_profile_without_logo`, `brand_profile_with_logo`, `campaign_pipeline`, `campaign_copy`, `campaign_image`
3. ADD COLUMN: `campaign_id` (UUID, FK campaigns), `user_id` (UUID, sem FK), `prompt_tokens`, `completion_tokens`, `total_tokens`, `trace_id`, `phase`

**Separação de responsabilidades:**
- `generation_rate_events` → enforcement/quota (F25)
- `generation_events` → observabilidade/IA/custo/diagnóstico (F28)
- `credit_transactions` → financeiro/ledger (F24)
- `admin_audit_log` → operação humana (F26)

**Regra de inserção:** Best-effort, nunca bloqueia o pipeline. INSERT via `supabaseAdmin`, sem RLS. Se falhar, pipeline continua — telemetria não é crítica.

### D4 — Dashboard MVP com cards, sem gráficos

`DECIDIDO`

Página `/admin/metrics` como Server Component SSR. Dados consultados via `src/lib/metrics/` que acessa `generation_events`, `credit_transactions` e `generation_rate_events` via `supabaseAdmin`.

**Estrutura:**
- Health State Banner (healthy / attention / pause) — o pior entre todos os indicadores
- Cards com 3 períodos (última hora / 24h / 7d): taxa de sucesso, erro rate, custo médio, tempo médio, créditos concedidos, estorno rate, users ativos
- Opcional: tabela de falhas recentes (últimas 10)

**Health state thresholds (conservadores para beta):**
| Métrica | Healthy | Attention | Pause |
|---------|---------|-----------|-------|
| Taxa de sucesso | ≥ 85% | ≥ 70% e < 85% | < 70% |
| Erro rate | < 5% | ≥ 5% e < 10% | ≥ 10% |
| Custo médio | < USD 0,02 | ≥ USD 0,02 e < USD 0,05 | ≥ USD 0,05 |
| Tempo médio | < 30s | ≥ 30s e < 45s | ≥ 45s |
| Estorno rate | < 10% | ≥ 10% e < 15% | ≥ 15% |

**Alternativa rejeitada:** Dashboard com gráficos Chart.js/Recharts. Cards com valores numéricos são suficientes para 3-5 lojistas.

### D5 — Alertas como health states + runbook, não sistema real

`DECIDIDO`

"Alertas configurados" significa: dashboard mostra health state, logs estruturados podem incluir `alertKind`, runbook documenta procedimentos. Sem Slack, Datadog, PagerDuty ou email automático.

### D6 — Documentação operacional versionada em `docs/operations/`

`DECIDIDO`

Três documentos:
- `deploy-checklist.md` — pré-requisitos, passos de deploy Vercel, verificação pós-deploy, rollback de código e banco
- `support-runbook.md` — conceder créditos, estornar, verificar saldo/extrato, investigar erros, cleanup manual, pausar geração
- `environment-variables.md` — catálogo completo de env vars com descrição, obrigatoriedade, default e exemplo

### D7 — Retenção 90d como função SQL + runbook; job automático adiado

`DECIDIDO`

Função `public.cleanup_generation_events_90d()` criada via migration que apenas define a função (não executa). Runbook documenta comando `SELECT public.cleanup_generation_events_90d();`. Job automático agendado para D+30 ou F29.

**Alternativa rejeitada:** Migration com DELETE direto. Rejeitado porque migrations que executam DELETE podem rodar automaticamente em deploy com risco de deletar dados acidentalmente. Uma função versionada é segura — só executa quando chamada.

### D8 — Concorrência testada no pipeline com mocks, não apenas SQL

`DECIDIDO`

F24 já testou atomicidade SQL. F28 testa o encadeamento pipeline → SQL onde o risco de race condition reaparece. Dois requests simultâneos com mocks de IA, mesma loja, saldo=1, apenas um vence (200), o outro falha (402). Saldo final = 0, credit_transactions consistente.

### D9 — Nenhuma nova tabela

`DECIDIDO`

Apenas ALTER CHECK + ADD COLUMNS em `generation_events`. Nenhuma criação de tabela. Colunas novas são todas opcionais (nullable) — zero quebra retroativa.

### D10 — Custo exibido em BRL com conversão

`DECIDIDO`

Cards de custo no dashboard convertem USD → BRL usando `VENDEO_USD_BRL_RATE` (default 5.50). Formatação brasileira (R$ 0,11).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Source (F28)
- `openspec/changes/fase-28-observabilidade-operacao-launch-controls/proposal.md` — Why, What Changes, 9 new capabilities, 3 modified, impact
- `openspec/changes/fase-28-observabilidade-operacao-launch-controls/design.md` — D1-D9, goals/non-goals, estrutura de código, riscos
- `openspec/changes/fase-28-observabilidade-operacao-launch-controls/tasks.md` — 13 task groups, 28+ testes

### Specs (F28)
- `openspec/changes/fase-28-observabilidade-operacao-launch-controls/specs/launch-config/spec.md` — LaunchConfig type, getLaunchConfig(), 5 flags, defaults, cenários
- `openspec/changes/fase-28-observabilidade-operacao-launch-controls/specs/pipeline-logger/spec.md` — PipelineEvent type, logPipelineEvent(), sanitização, fire-and-forget, 11 stages
- `openspec/changes/fase-28-observabilidade-operacao-launch-controls/specs/pipeline-telemetry/spec.md` — INSERT em generation_events após Copy/Image/Pipeline, best-effort
- `openspec/changes/fase-28-observabilidade-operacao-launch-controls/specs/ai-cost-estimator/spec.md` — estimateAiCost(), tabela de preços OpenAI + Gemini
- `openspec/changes/fase-28-observabilidade-operacao-launch-controls/specs/pipeline-metrics/spec.md` — 7 funções agregadas, MetricCard/HealthState/TimeRange types
- `openspec/changes/fase-28-observabilidade-operacao-launch-controls/specs/admin-metrics-dashboard/spec.md` — /admin/metrics SSR, cards 3 períodos, health banner
- `openspec/changes/fase-28-observabilidade-operacao-launch-controls/specs/rate-limit/spec.md` — rateLimitEnabled bypass, auditoria contínua
- `openspec/changes/fase-28-observabilidade-operacao-launch-controls/specs/transactional-pipeline/spec.md` — Launch config checks, traceId, logging, telemetria no pipeline
- `openspec/changes/fase-28-observabilidade-operacao-launch-controls/specs/generation-events-cleanup/spec.md` — cleanup_generation_events_90d() SQL function
- `openspec/changes/fase-28-observabilidade-operacao-launch-controls/specs/concurrency-test/spec.md` — Teste de concorrência saldo=1, 2 requests

### Pipeline Route (F25)
- `src/app/api/campaign/generate-image/route.ts` — Handler POST com 3 zonas (pré-stream, paralelo, pós-paralelo)
- `src/lib/rate-limit/rate-limit.ts` — checkRateLimit() que será modificado para aceitar rateLimitEnabled

### CreditService (F24)
- `src/lib/credit/credit-service.ts` — CreditService com 6 métodos
- `src/lib/credit/types.ts` — CreditTransaction, CreditBalance

### Admin Layout (F26)
- `src/app/(app)/admin/layout.tsx` — Layout admin que ganhará link para /admin/metrics
- `src/lib/admin/gate.ts` — requireAdmin()

### Supabase Admin
- `src/lib/supabase/admin.ts` — supabaseAdmin client para operações service_role

### Project Requirements
- `.planning/REQUIREMENTS.md` — OPS-01 a OPS-09 mapped to Phase 28

</canonical_refs>

<specifics>
## Specific Ideas

- `getLaunchConfig()` lê `process.env.VENDEO_V15_ENABLED` etc. com defaults seguros — helper único em `src/lib/launch-config/config.ts`
- `logPipelineEvent()` sanitiza base64 (match `/^[A-Za-z0-9+/=]{100,}$/`) e chaves prompt/Prompt
- Telemetria INSERT via `supabaseAdmin.from("generation_events").insert()` com try/catch
- `estimateAiCost()` com tabela de preços: gpt-4o ($2.50/1M input, $10/1M output), gpt-4o-mini, dall-e-3, gemini-2.0-flash
- Métricas consultam `generation_events` (success_rate, error_rate, avg_cost, avg_duration), `credit_transactions` (credits_granted, refund_rate), `generation_rate_events` (active_users)
- Health state = worst-case entre todas as métricas de 24h
- Dashboard com conversão USD→BRL via `VENDEO_USD_BRL_RATE` (default 5.50)
- Nenhuma chamada de IA real nos testes — mocks de TextProvider e ImageProvider
- Migration 1: ALTER CHECK + ADD COLUMNS (20260718000002)
- Migration 2: CREATE FUNCTION cleanup (20260718000003) — não executa
- `rateLimitEnabled=false`: checkRateLimit retorna `{ allowed: true }` mas registra em `generation_rate_events`
- Concorrência: Promise.all com 2 requests, mesma storeId, saldo=1

</specifics>

<deferred>
## Deferred Ideas

- Alertas push (Slack, email, webhook) — health states + runbook substituem no beta
- Integração com Datadog, Grafana ou ferramentas externas — Vercel Logs + JSON estruturado bastam
- Gráficos/séries temporais no dashboard — cards com valores numéricos são suficientes para 3-5 lojistas
- Cache de métricas ou agregação prévia (tabela hourly) — volume baixo, SSR sem cache é suficiente
- Job automático de cleanup — adiado para D+30 ou F29; script versionado + runbook manual desbloqueiam o ship
- Refinamento visual de componentes existentes — F29
- UAT externo com lojistas reais — F29
- Melhoria de funcionalidade do produto — apenas instrumentação operacional
- Formulário de solicitação de crédito in-app — CTA leva a mailto/modal

</deferred>

---

*Phase: 28-observabilidade-operacao-launch-controls*
*Context gathered: 2026-07-19 via OpenSpec source of truth*
