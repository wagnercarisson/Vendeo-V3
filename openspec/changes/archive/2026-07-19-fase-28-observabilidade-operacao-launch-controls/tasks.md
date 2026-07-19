## 1. Migrations — Expandir generation_events + Função Cleanup

- [x] 1.1 Criar `supabase/migrations/20260718000002_expand_generation_events.sql`: DROP CHECK constraint existente, ADD nova CHECK constraint com tipos `campaign_pipeline`, `campaign_copy`, `campaign_image`, ADD COLUMNS `campaign_id`, `user_id`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `trace_id`, `phase`
- [x] 1.2 Criar `supabase/migrations/20260718000003_cleanup_generation_events_90d.sql`: CREATE OR REPLACE FUNCTION `public.cleanup_generation_events_90d()` que DELETE registros com `created_at < NOW() - INTERVAL '90 days'` e retorna `deleted_count`
- [x] 1.3 Executar migrations localmente e verificar schema: novos tipos aceitos, colunas opcionais existem, função existe sem ter sido executada

## 2. Launch Config — Módulo Centralizado de Feature Flags

- [x] 2.1 Criar `src/lib/launch-config/config.ts` com tipo `LaunchConfig` (5 flags booleanas) e função `getLaunchConfig()` que lê de env vars com defaults seguros
- [x] 2.2 Criar `src/lib/launch-config/__tests__/config.test.ts` com 7+ testes: defaults sem env vars, cada flag individual, env var mal formatada → fallback, `getLaunchConfig()` nunca lança exceção

## 3. AI Cost Estimator — Helper de Custo Estimado

- [x] 3.1 Criar `src/lib/ai-cost/index.ts` com barrel export
- [x] 3.2 Criar `src/lib/ai-cost/cost-estimator.ts` com tipo `AiCostEstimate` e função `estimateAiCost()` com tabela de preços OpenAI (gpt-4o, gpt-4o-mini, dall-e-3) + Gemini; retorna `null` para modelo desconhecido ou sem usage
- [x] 3.3 Criar `src/lib/ai-cost/__tests__/cost-estimator.test.ts` com 3+ testes: OpenAI gpt-4o com tokens, modelo desconhecido → null, sem usage → null

## 4. Pipeline Logger — Logging Estruturado

- [x] 4.1 Criar `src/lib/logging/pipeline-logger.ts` com tipo `PipelineEvent` e função `logPipelineEvent()` que emite `console.log(JSON.stringify(event))` com sanitização de base64 e prompt completo em metadata
- [x] 4.2 Criar `src/lib/logging/__tests__/pipeline-logger.test.ts` com 4+ testes: JSON com todos os campos obrigatórios, sanitização de base64, sanitização de prompt, erro interno não propaga

## 5. Pipeline Integration — Launch Config + Logging + Telemetria em generate-image/route.ts

- [x] 5.1 Adicionar verificação de `generationPaused` no início de `src/app/api/campaign/generate-image/route.ts` → HTTP 503 se true
- [x] 5.2 Adicionar verificação de `v15Enabled` como master switch — quando false, pipeline ignora `creditsChargingEnabled`, `copyDirectorEnabled`, `rateLimitEnabled`
- [x] 5.3 Adicionar verificação de `rateLimitEnabled` antes do rate limit guard — quando false, `checkRateLimit()` retorna `allowed: true`
- [x] 5.4 Adicionar verificação de `creditsChargingEnabled` antes do saldo check / reserva de crédito
- [x] 5.5 Adicionar verificação de `copyDirectorEnabled` antes de chamar CopyDirectorService
- [x] 5.6 Gerar `traceId` via `randomUUID()` no início do handler e propagar em logs e telemetria
- [x] 5.7 Adicionar `logPipelineEvent()` em cada etapa do pré-stream: `rate_limit_check`, `balance_check`, `campaign_create`, `credit_reserve`
- [x] 5.8 Adicionar `logPipelineEvent()` em cada etapa do paralelo: `copy_generation`, `image_generation`
- [x] 5.9 Adicionar `logPipelineEvent()` em cada etapa do pós-paralelo: `merge`, `upload`, `update_ready`, `credit_confirm`, `credit_refund`
- [x] 5.10 Adicionar INSERT best-effort em `generation_events` após Copy Director completar/falhar (`campaign_copy`) com tokens, custo, modelo
- [x] 5.11 Adicionar INSERT best-effort em `generation_events` após Image Director completar/falhar (`campaign_image`) com custo, modelo
- [x] 5.12 Adicionar INSERT best-effort em `generation_events` ao final do pipeline (`campaign_pipeline`) com custo total, duração total, metadata

## 6. Rate Limit — Respeitar rateLimitEnabled Flag

- [x] 6.1 Modificar `src/lib/rate-limit/rate-limit.ts` para aceitar `rateLimitEnabled` — quando false, `checkRateLimit()` retorna `{ allowed: true }` sem consultar banco
- [x] 6.2 Garantir que tentativas continuam registradas em `generation_rate_events` para auditoria mesmo com `rateLimitEnabled=false`

## 7. Pipeline Metrics — Funções de Consulta Agregada

- [x] 7.1 Criar `src/lib/metrics/types.ts` com tipos `HealthState`, `TimeRange`, `MetricCard`
- [x] 7.2 Criar `src/lib/metrics/pipeline-metrics.ts` com funções que consultam `generation_events`, `credit_transactions`, `generation_rate_events` via `supabaseAdmin`: `getSuccessRate()`, `getErrorRate()`, `getAvgCost()`, `getAvgDuration()`, `getCreditsGranted()`, `getRefundRate()`, `getActiveUsers()` — cada uma aceita `hours: number` (1, 24, 168)
- [x] 7.3 Criar `src/lib/metrics/health.ts` com função `computeHealthState(metrics)` que retorna "healthy" | "attention" | "pause" com base nos thresholds definidos no design
- [x] 7.4 Criar `src/lib/metrics/index.ts` com barrel export
- [x] 7.5 Criar `src/lib/metrics/__tests__/pipeline-metrics.test.ts` com 5+ testes: cada métrica com dados de exemplo, getErrorRate sem dados → 0, getAvgCost sem custos → null
- [x] 7.6 Criar `src/lib/metrics/__tests__/health.test.ts` com 3+ testes: todas saudáveis → healthy, uma em attention → attention, uma em pause → pause

## 8. Admin Metrics Dashboard — Página /admin/metrics

- [x] 8.1 Criar `src/app/(app)/admin/metrics/page.tsx` como Server Component SSR que consulta métricas para 1h, 24h, 7d via `supabaseAdmin`
- [x] 8.2 Criar `src/app/(app)/admin/metrics/health-banner.tsx` — Client Component que recebe `healthState` e renderiza banner colorido (verde/amarelo/vermelho) com indicador "●"
- [x] 8.3 Criar `src/app/(app)/admin/metrics/metrics-cards.tsx` — Client Component que renderiza grid de cards com label, valor e período
- [x] 8.4 Modificar `src/app/(app)/admin/layout.tsx` (navegação admin da F26) para adicionar link para `/admin/metrics`
- [x] 8.5 Adicionar conversão USD→BRL usando `VENDEO_USD_BRL_RATE` (default 5.50) nos cards de custo
- [x] 8.6 Implementar tratamento de estados: "N/D" para métricas sem dados, banner de health state no topo

## 9. Documentação Operacional — docs/operations/

- [x] 9.1 Criar `docs/operations/deploy-checklist.md`: pré-requisitos (env vars, migrations pendentes, testes), passos de deploy Vercel, verificação pós-deploy (smoke tests), rollback de código (Vercel rollback), rollback de banco (migrations reversíveis), quem pode executar cada passo
- [x] 9.2 Criar `docs/operations/support-runbook.md`: conceder créditos manualmente (admin UI F26), estornar transação (procedimento + SQL), verificar saldo/extrato de loja, investigar campanha com erro, executar cleanup manual de generation_events (90d), pausar geração (ativar `VENDEO_GENERATION_PAUSED`), procedimentos para cada health state
- [x] 9.3 Criar `docs/operations/environment-variables.md`: catálogo completo de todas as env vars do projeto com descrição, obrigatoriedade, default e exemplo — incluindo as 5 novas flags de launch config, OPENAI_API_KEY, GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPPORT_EMAIL, VENDEO_USD_BRL_RATE

## 10. Testes — Concorrência no Pipeline

- [x] 10.1 Criar teste de concorrência em `src/__tests__/`: dois requests simultâneos para `POST /api/campaign/generate-image` com mocks de IA, mesma loja, saldo=1 → apenas um vence (200), outro falha (402)
- [x] 10.2 Verificar saldo final = 0, `credit_transactions` consistente (1 deduction, 0 refund), apenas 1 campanha criada

## 11. Testes — Telemetria generation_events

- [x] 11.1 Testar INSERT `campaign_copy` com tokens → registro completo no schema expandido
- [x] 11.2 Testar INSERT sem `campaign_id` → nullable funciona (sem erro de constraint)
- [x] 11.3 Testar falha de INSERT → pipeline continua (best-effort, não propaga erro)

## 12. Testes — Regressão (Master Switch + Emergency Brake)

- [x] 12.1 Testar geração com `v15Enabled=false` → pipeline v1.4 (sem crédito, sem Copy Director, sem rate limit) — fluxo completo funciona
- [x] 12.2 Testar geração com `generationPaused=true` → HTTP 503 antes de qualquer operação

## 13. Verificação Final

- [x] 13.1 Executar `npx vitest run` — 28+ novos + ~852 existentes passando
- [x] 13.2 Executar `npm run typecheck` — zero erros
- [x] 13.3 Executar `npm run lint` — zero erros
- [x] 13.4 Executar `npm run build` — build bem-sucedido
- [x] 13.5 UAT local: geração com todas as flags ativas funciona como antes (regressão zero)
- [x] 13.6 UAT local: `VENDEO_GENERATION_PAUSED=true` → 503
- [x] 13.7 UAT local: `VENDEO_V15_ENABLED=false` → pipeline v1.4
- [x] 13.8 UAT local: `/admin/metrics` acessível apenas via admin, cards com valores, health state coerente
