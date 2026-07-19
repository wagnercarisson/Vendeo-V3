## Context

A v1.5 está com 6/7 fases concluídas — pipeline transacional (F24/F25), admin operacional (F26), conta e saldo visível (F27). O que impede o lançamento externo controlado não é funcionalidade, é a ausência de instrumentos operacionais: logs ad-hoc sem formato estruturado, feature flags inexistentes, sem telemetria de IA persistida, sem dashboard de saúde, sem documentação de deploy/rollback/suporte.

Esta fase instala a camada operacional que permite ao time operar o produto com confiança durante o beta controlado (3-5 lojistas). Nenhuma melhoria de produto — apenas instrumentação.

**Dependências:** F24 (credit_balances, credit_transactions), F25 (generation_rate_events, rate-limit, pipeline route), F26 (admin layout, admin gate)

## Goals / Non-Goals

**Goals:**
- Módulo `launch-config` com 5 flags explícitas lidas de env vars via helper único — zero `process.env` espalhado
- Logging estruturado via `logPipelineEvent()` com formato JSON consistente, fire-and-forget, sem dados sensíveis
- Telemetria de IA persistida em `generation_events` (expansão via CHECK constraint + colunas opcionais)
- Helper `estimateAiCost()` para custo estimado por provider/modelo
- Página `/admin/metrics` com cards de métricas + health state banner
- Documentação `docs/operations/` com deploy checklist, support runbook, catálogo de env vars
- Função SQL `cleanup_generation_events_90d()` versionada
- Testes de concorrência no pipeline com mocks (dois requests simultâneos, saldo=1, apenas um vence)
- Migration apenas com ALTER CHECK + ADD COLUMNS em `generation_events` (sem novas tabelas)
- 28+ testes novos; regressão geral (build, typecheck, lint, ~852 existentes)

**Non-Goals:**
- Alertas push (Slack, email, webhook) — health states + runbook substituem no beta
- Integração com Datadog, Grafana ou ferramentas externas — Vercel Logs + JSON estruturado bastam
- Gráficos/séries temporais no dashboard — cards com valores numéricos são suficientes para 3-5 lojistas
- Cache de métricas ou agregação prévia (tabela hourly) — volume baixo, SSR sem cache é suficiente
- Job automático de cleanup — adiado para D+30 ou F29; script versionado + runbook manual desbloqueiam o ship
- Refinamento visual de componentes existentes — F29
- UAT externo com lojistas reais — F29
- Melhoria de funcionalidade do produto — apenas instrumentação operacional

## Decisions

### D1 — Launch config como módulo central com env vars, não tabela

`DECIDIDO`

Flags explícitas em `src/lib/launch-config/config.ts` lidas de environment variables via `getLaunchConfig()`. Cinco flags booleanas com defaults seguros (todas true exceto `generationPaused=false`).

**Alternativa rejeitada:** Flag única `v15-credits-enabled` com 3 comportamentos implícitos. Rejeitada porque "desligar a flag" deveria significar coisas diferentes para charging, copy director e rate limit — uma única flag torna o comportamento ambíguo e perigoso para operação.

**Alternativa rejeitada:** Tabela `feature_flags` no banco. Rejeitada por adicionar dependência externa e latência de leitura. Env vars são toggleáveis via Vercel (re-deploy ou instantâneo). O helper `getLaunchConfig()` encapsula a fonte, permitindo migração futura para tabela sem mudar callers.

**Contrato com o pipeline:**
- `v15Enabled=false` → desliga todas as outras (exceto `generationPaused`). Pipeline roda como v1.4
- `creditsChargingEnabled=false` → pipeline não chama `getBalance()`/`reserveCredit()`
- `copyDirectorEnabled=false` → `publication_copy_snapshot` populado via fallback determinístico
- `rateLimitEnabled=false` → `checkRateLimit()` sempre retorna `allowed: true`
- `generationPaused=true` → `POST /api/campaign/generate-image` retorna 503 antes de qualquer operação. **Sobrescreve todas as outras flags**

**Onde as flags são verificadas (apenas na orquestração do pipeline):**
- `generate-image/route.ts` — todas as 5 flags
- `rate-limit.ts` — `rateLimitEnabled`
- `CreditService` e `CopyDirectorService` — **não verificam flags**. A decisão pertence ao pipeline

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

A tabela `generation_events` já existe com a estrutura base (provider, model, duration_ms, estimated_cost_usd, status, metadata, created_at) e política de retenção de 90 dias. A F28 expande sem criar schema novo.

**Migration:**
1. Remover CHECK constraint existente
2. Adicionar nova CHECK constraint aceitando `visual_signature`, `brand_profile_without_logo`, `brand_profile_with_logo`, `campaign_pipeline`, `campaign_copy`, `campaign_image`
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

**Alternativa rejeitada:** Dashboard com gráficos Chart.js/Recharts. Rejeitado porque 3-5 lojistas não justificam gráficos. Cards com valores numéricos são suficientes para decisão. Gráficos podem ser adicionados depois sem refatoração.

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

F24 já testou atomicidade SQL (`reserve_credit`, `refund_credit`). F28 testa o encadeamento pipeline → SQL onde o risco de race condition reaparece. Dois requests simultâneos com mocks de IA (sem HTTP real), mesma loja, saldo=1, apenas um vence (200), o outro falha (402). Saldo final = 0, `credit_transactions` consistente.

### D9 — Nenhuma nova tabela

`DECIDIDO`

Apenas ALTER CHECK + ADD COLUMNS em `generation_events`. Nenhuma criação de tabela. Colunas novas são todas opcionais (nullable) — zero quebra retroativa.

## Estrutura de Código

```
ARQUIVOS NOVOS:
════════════════
src/lib/
  launch-config/
    config.ts                          ← getLaunchConfig(), LaunchConfig type
    __tests__/config.test.ts
  logging/
    pipeline-logger.ts                 ← logPipelineEvent(), PipelineEvent type
    __tests__/pipeline-logger.test.ts
  metrics/
    index.ts                           ← barrel export
    pipeline-metrics.ts                ← consultas agregadas
    health.ts                          ← computeHealthState()
    types.ts                           ← MetricCard, HealthState, TimeRange
    __tests__/
      pipeline-metrics.test.ts
      health.test.ts
  ai-cost/
    index.ts
    cost-estimator.ts                  ← estimateAiCost()
    __tests__/cost-estimator.test.ts

src/app/(app)/admin/metrics/
  page.tsx                             ← Server Component SSR
  metrics-cards.tsx                    ← Client Component
  health-banner.tsx                    ← Client Component

supabase/migrations/
  20260718000002_expand_generation_events.sql
  20260718000003_cleanup_generation_events_90d.sql

docs/operations/
  deploy-checklist.md
  support-runbook.md
  environment-variables.md

ARQUIVOS MODIFICADOS:
══════════════════════
src/app/api/campaign/generate-image/route.ts
  ← Launch config checks (generationPaused, v15Enabled, rateLimitAllowed, creditsCharging, copyDirectorEnabled)
  ← logPipelineEvent() em cada etapa
  ← Telemetria em generation_events
  ← traceId por request

src/lib/rate-limit/rate-limit.ts
  ← Verificação de rateLimitEnabled
  ← Logging estruturado

src/app/(app)/admin/layout.tsx
  ← Link para /admin/metrics na navegação admin
```

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **Feature flags confundem a operação** — time não sabe qual flag ligar/desligar | Runbook documenta cenários. Flags têm defaults seguros (todas ON, exceto generationPaused) |
| **Logging estruturado sem schema** — logs viram ruído | Campos obrigatórios definidos como contrato. Vercel Logs permite filtragem por campo |
| **Health state enganoso** — dashboard mostra green mas pipeline quebrado | Health state é o **pior** entre todos os indicadores. Runbook instrui verificação cruzada |
| **Race condition no pipeline real** — teste com mock passa mas falha em produção | Teste usa mocks realistas. Risco baixo porque `reserve_credit` é função SQL atômica testada na F24 |
| **Telemetria bloqueia o pipeline** — INSERT falha e propaga erro | Best-effort: try/catch, nunca propaga. Pipeline continua sem telemetria |
| **Cleanup manual esquecido** — generation_events acumula >90 dias | Runbook documenta periodicidade (1x/semana). Job automático entra em D+30 ou F29 |
| **Deploy checklist desatualizado** | Checklist versionado no repositório. Atualizado a cada fase que modifica deploy |
| **Env vars mal documentadas** | Policy: toda PR que adiciona env var deve atualizar `docs/operations/environment-variables.md` |
