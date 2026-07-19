## Why

A v1.5 está com 6/7 fases concluídas — o motor de campanha com créditos, copy IA, admin operacional e saldo visível está implementado e testado (~852 testes). O que falta para o lançamento externo controlado não é funcionalidade, é **instrumentação para operar com confiança**: o pipeline de geração não tem observabilidade (logs ad-hoc, sem formato estruturado, sem telemetria de IA persistida), não há feature flag para rollout seguro, não existe documentação operacional (deploy, rollback, runbook), e o time não tem visibilidade agregada da saúde do sistema. Esta fase instala os instrumentos de operação sem melhorar o produto — prepara a operação para abrir para usuários reais.

## What Changes

- **Launch config centralizado** — módulo `launch-config` com 5 flags explícitas (`VENDEO_V15_ENABLED`, `VENDEO_CREDITS_CHARGING_ENABLED`, `VENDEO_COPY_DIRECTOR_ENABLED`, `VENDEO_RATE_LIMIT_ENABLED`, `VENDEO_GENERATION_PAUSED`), lido via helper único, sem `process.env` espalhado
- **Logging estruturado no pipeline** — helper `logPipelineEvent()` que emite JSON consistente com `traceId`, `campaignId`, `storeId`, `userId`, `phase`, `status`, `durationMs`, sem dados sensíveis
- **Telemetria de IA persistida** — expansão da tabela `generation_events` (CHECK constraint + colunas: `campaign_id`, `user_id`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `trace_id`, `phase`) para registrar execuções de Copy Director, Image Director e pipeline completo
- **Estimador de custo IA** — helper `estimateAiCost()` que calcula custo estimado por provider/modelo com base em tokens de entrada/saída
- **Dashboard operacional MVP** — página `/admin/metrics` com cards de métricas (taxa de sucesso, erro rate, custo médio, tempo médio, créditos concedidos, estorno rate, users ativos) + health state banner (healthy / attention / pause)
- **Documentação operacional** — `docs/operations/` com deploy checklist, support runbook e catálogo de variáveis de ambiente
- **Retenção 90 dias implementável** — função SQL `cleanup_generation_events_90d()` versionada + runbook executável; job automático adiado para D+30 ou F29
- **Testes de concorrência no pipeline** — dois requests simultâneos com saldo insuficiente para ambos, apenas um vence
- **Nenhuma nova tabela** — apenas ALTER CHECK + ADD COLUMNS em `generation_events`
- **Sem alertas externos** (Slack, email, webhook) — health states no dashboard + runbook manual

## Capabilities

### New Capabilities
- `launch-config`: Módulo centralizado de feature flags com 5 flags explícitas, defaults seguros e helper único `getLaunchConfig()`
- `pipeline-logger`: Helper `logPipelineEvent()` que emite JSON estruturado com campos obrigatórios, sem dados sensíveis, fire-and-forget
- `ai-cost-estimator`: Helper `estimateAiCost()` para calcular custo estimado de chamadas IA por provider/modelo
- `pipeline-metrics`: Funções de consulta agregada em `generation_events`, `credit_transactions` e `generation_rate_events` para alimentar o dashboard
- `admin-metrics-dashboard`: Página `/admin/metrics` com cards de métricas e health state banner
- `pipeline-telemetry`: Persistência best-effort de telemetria de IA em `generation_events` após Copy Director, Image Director e pipeline completo
- `generation-events-cleanup`: Função SQL `cleanup_generation_events_90d()` versionada para retenção de 90 dias
- `concurrency-test`: Testes de pipeline concorrente com mocks — dois requests simultâneos, saldo=1, apenas um vence

### Modified Capabilities
- `campaign-generate`: Rota `POST /api/campaign/generate-image` passa a verificar `generationPaused` (503), `v15Enabled` (master switch), `rateLimitEnabled`, `creditsChargingEnabled`, `copyDirectorEnabled`, além de emitir logs estruturados e telemetria em todas as etapas
- `rate-limit`: `checkRateLimit()` passa a verificar `rateLimitEnabled` — quando false, sempre retorna `allowed: true`; tentativas continuam registradas para auditoria
- `admin-operations`: Navegação admin existente (F26) ganha link para `/admin/metrics`

## Impact

- **Arquivos novos:** `src/lib/launch-config/`, `src/lib/logging/`, `src/lib/metrics/`, `src/lib/ai-cost/`, `src/app/(app)/admin/metrics/`, `supabase/migrations/` (2 migrations), `docs/operations/` (3 documentos)
- **Arquivos modificados:** `src/app/api/campaign/generate-image/route.ts`, `src/lib/rate-limit/rate-limit.ts`, `src/app/(app)/admin/layout.tsx`
- **Dependências:** F24 (credit_balances, credit_transactions), F25 (generation_rate_events, rate-limit, pipeline), F26 (admin layout)
- **2 novas migrations** (ALTER CHECK + ADD COLUMNS em generation_events; função SQL cleanup)
- **28+ testes novos** — launch config (5), pipeline logger (4), metrics (5), health state (3), concurrency (3), cost estimator (3), telemetria (3), regressão (2)
