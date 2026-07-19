# Alinhamento Fase 28 — Observabilidade + Operação + Launch Controls (v1.5)

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)
  ├── F23 — TextProvider + Copy Director (fundação IA de texto)                    ✓
  ├── F24 — Wallet + Ledger + Idempotência (fundação financeira)                   ✓
  ├── F25 — Integração Transacional do Pipeline (créditos + copy + rate limit)      ✓
  ├── F26 — Admin Operacional + Convites + Créditos Manuais                        ✓
  ├── F27 — Conta + Saldo Visível + Extrato                                        ✓
  ├── F28 — Observabilidade + Operação + Launch Controls                            ← esta fase
  ├── F29 — Refinamento Visual + UAT + Launch Readiness
  └── F30/v1.6 — Stripe / Monetização Pública (adiado para pós-beta)
```

A v1.5 está com 6/7 fases concluídas. O motor de campanha com créditos, copy IA, admin operacional e saldo visível está implementado e testado (~852 testes).

**O que falta para o lançamento externo controlado:**

- O pipeline de geração não tem observabilidade — logs são ad-hoc, sem formato estruturado, sem telemetria de IA persistida
- Não há feature flag para rollout seguro — créditos, Copy Director e rate limit estão sempre ativos
- Não existe documentação operacional — deploy, rollback, runbook de suporte, variáveis de ambiente
- O time não tem visibilidade agregada da saúde do sistema (taxa de sucesso, custo médio, erro rate)
- Dados de telemetria não têm política de retenção implementada
- Não há testes de concorrência no pipeline real (saldo consistente sob carga paralela)

**Esta fase instala os instrumentos para operar o produto com confiança.** Não melhora o produto — prepara a operação para abrir para usuários reais.

---

## Realinhamento de Escopo (vs. alinhamento milestone original)

O alinhamento original da milestone (v1.5) descrevia a F28 com escopo amplo incluindo dashboard operacional com gráficos, alertas configurados (Slack/Datadog), testes de concorrência e cleanup automático de retenção. Após discussão, o escopo foi ajustado para entregar o **mínimo viável operacional** que desbloqueia o lançamento controlado sem virar um projeto de infraestrutura.

### O que muda

| Item | Original (milestone) | Realinhado (F28) |
|------|---------------------|------------------|
| **Feature flag** | Flag conceitual única `v1.5-credits-enabled` com 3 comportamentos implícitos | Módulo central `launch-config` com flags explícitas: `VENDEO_V15_ENABLED`, `VENDEO_CREDITS_CHARGING_ENABLED`, `VENDEO_COPY_DIRECTOR_ENABLED`, `VENDEO_RATE_LIMIT_ENABLED`, `VENDEO_GENERATION_PAUSED` |
| **Dashboard operacional** | Dashboard com gráficos, séries temporais, tendências | Página `/admin/metrics` com cards e tabelas: taxa de sucesso, erro rate, custo médio, tempo médio, créditos concedidos, estorno rate, users ativos — sem gráficos sofisticados |
| **Alertas** | Alertas configurados (Slack, webhook, email) | Health states (healthy / attention / pause) no dashboard + runbook com consulta manual. AlertKind opcional em logs. Sem integração externa de alerta |
| **Telemetria IA** | Sem definição clara de destino | Expandir `generation_events` com novos tipos `campaign_pipeline`, `campaign_copy`, `campaign_image` — não criar tabela nova |
| **Rate limit storage** | Sem definição clara | `generation_rate_events` mantida separada para enforcement/quota. `generation_events` para observabilidade/IA/custo/diagnóstico |
| **Retenção 90d** | Cleanup documentado + job automático | Função SQL versionada + runbook executável. Job automático adiado para D+30 ou F29 |
| **Concorrência** | Testes de concorrência no pipeline | Testes de pipeline concorrente com mocks (sem IA real): dois requests simultâneos, mesma loja, saldo 1, apenas um vence |

### Justificativa

1. **Feature flag única esconde complexidade perigosa** — "desligar a flag" deveria significar coisas diferentes para charging (não cobrar), copy director (voltar ao determinístico) e rate limit (não bloquear). Uma única flag torna o comportamento ambíguo. Flags explícitas eliminam essa ambiguidade.

2. **Dashboard operacional não precisa ser BI** — o beta controlado tem 3-5 lojistas. Cards com valores agregados (última hora / 24h / 7d) são suficientes para o time decidir se o sistema está saudável. Gráficos elaborados podem vir depois.

3. **Alertas reais (Slack, PagerDuty) são overkill para o beta** — o time acompanha manualmente. Health states no dashboard + runbook de verificação são o suficiente. Se o volume crescer, alertas reais entram como evolução.

4. **Criar tabela nova de telemetria agora é premature optimization** — `generation_events` já existe com a estrutura que precisamos (provider, model, duration_ms, estimated_cost_usd, status, metadata, created_at) e política de retenção de 90 dias definida. Expandir com novos tipos e colunas mínimas é mais rápido que criar schema novo.

5. **Cleanup automático não bloqueia o lançamento** — o volume esperado é baixo (dezenas a centenas). Script versionado + runbook manual desbloqueia o ship. O job automático entra nos 30 dias seguintes sem pressão de milestone.

---

## Propósito

1. **Logging estruturado no pipeline** — toda etapa do pipeline de geração loga com `campaignId`, `traceId`, `phase`, `duration_ms`, `status`. Formato JSON consistente, sem dados sensíveis
2. **Telemetria de IA persistida** — tokens (prompt/completion/total), custo estimado, modelo, provedor registrados em `generation_events`
3. **Launch config centralizado** — módulo `launch-config` com 5 flags explícitas, lido via helper único, sem `process.env` espalhado
4. **Dashboard operacional MVP** — página `/admin/metrics` com cards de saúde (taxa de sucesso, erro rate, custo médio, tempo médio, créditos concedidos, estorno rate, users ativos)
5. **Health states** — dashboard indica healthy / attention / pause com base em limites documentados
6. **Deploy checklist documentado** — passos, verificação pós-deploy, rollback de código e banco
7. **Runbook de suporte** — procedimentos documentados para grant manual, estorno, verificação de saldo
8. **Variáveis de ambiente documentadas** — todas as env vars do projeto catalogadas com descrição, obrigatoriedade e exemplo
9. **Retenção 90d implementável** — função SQL versionada de cleanup + runbook executável
10. **Testes de concorrência no pipeline** — dois requests simultâneos com saldo insuficiente para ambos, apenas um vence
11. **Regressão geral** — build, typecheck, lint, ~852 testes existentes + novos passando

---

## Estado Atual (pós-F27)

```
                                    ANTES (F27)                         DEPOIS (F28)
═══════════════════════════════════════════════════════════════════════════════════════════

Logging no pipeline:
  Formato                       ad-hoc (console.log/console.error          JSON estruturado via helper
                                 com tags [generate-image]*)               logPipelineEvent()
  Campos obrigatórios           variados por trecho do código              consistentes: traceId, campaignId,
                                                                           storeId, userId, phase, status,
                                                                           durationMs, errorCode?
  Dados sensíveis               sem sanificação explícita                  sem base64, sem prompt completo,
                                                                           sem dados sensíveis

Telemetria IA:
  generation_events             tabela existe com CHECK constraint         constraint expandida para aceitar
                                 limitada a visual_signature/               campaign_pipeline, campaign_copy,
                                 brand_profile                             campaign_image
  Persistência de tokens        não existe                                 prompt_tokens, completion_tokens,
                                                                           total_tokens em colunas ou metadata
  Custo estimado                não existe                                 estimated_cost_usd populado
  request_id / trace_id         não existe                                 opcional em metadata

Feature flags:
  Mecanismo                     inexistente                                módulo launch-config com helper
  Flags                         0                                          5: VENDEO_V15_ENABLED,
                                                                           VENDEO_CREDITS_CHARGING_ENABLED,
                                                                           VENDEO_COPY_DIRECTOR_ENABLED,
                                                                           VENDEO_RATE_LIMIT_ENABLED,
                                                                           VENDEO_GENERATION_PAUSED
  Centralização                 process.env espalhado                      único ponto de leitura +
                                                                           defaults documentados

Dashboard operacional:
  Métricas agregadas            inexistente (F26 é item-a-item)            /admin/metrics com cards
  Taxa de sucesso               não visível                                visível (última hora / 24h / 7d)
  Erro rate                     não visível                                visível
  Custo médio                   não visível                                visível
  Tempo médio                   não visível                                visível
  Créditos concedidos           não visível                                visível
  Estorno rate                  não visível                                visível
  Users ativos                  não visível                                visível
  Health state                  inexistente                                healthy / attention / pause

Documentação operacional:
  Deploy checklist              inexistente                                documentado
  Rollback processo             inexistente                                documentado
  Runbook suporte               inexistente                                documentado
  Variáveis de ambiente         inexistente                                catalogadas

Retenção 90d:
  Script cleanup                inexistente                                SQL versionado
  Runbook                       inexistente                                documentado
  Job automático                inexistente                                adiado (D+30 ou F29)

Testes:
  Concorrência pipeline         inexistente                                pipeline concorrente com mocks
  Regressão                     ~852 testes                                852 + novos passando
```

---

## Decisões de Arquitetura

### D1 — Launch config centralizado (feature flags explícitas)

`DECIDIDO`

Modelar um módulo `src/lib/launch-config/` com flags explícitas lidas de environment variables via helper único:

```typescript
// src/lib/launch-config/config.ts
// Único ponto de leitura de flags de lançamento. Toda feature flag passa por aqui.
// No futuro, pode migrar de env vars para tabela `feature_flags` sem mudar callers.

export type LaunchConfig = {
  /** Master switch: when disabled, all v1.5 features are inactive */
  v15Enabled: boolean;
  /** Deduct credits in the pipeline */
  creditsChargingEnabled: boolean;
  /** Use Copy Director as source of publication_copy_snapshot */
  copyDirectorEnabled: boolean;
  /** Apply hourly/daily rate limits */
  rateLimitEnabled: boolean;
  /** Emergency brake: block all new generation requests */
  generationPaused: boolean;
};

export function getLaunchConfig(): LaunchConfig {
  return {
    v15Enabled: process.env.VENDEO_V15_ENABLED !== "false",
    creditsChargingEnabled: process.env.VENDEO_CREDITS_CHARGING_ENABLED !== "false",
    copyDirectorEnabled: process.env.VENDEO_COPY_DIRECTOR_ENABLED !== "false",
    rateLimitEnabled: process.env.VENDEO_RATE_LIMIT_ENABLED !== "false",
    generationPaused: process.env.VENDEO_GENERATION_PAUSED === "true",
  };
}
```

**Contrato com o pipeline:**

| Flag | Efeito quando `false` |
|------|----------------------|
| `v15Enabled` | Desliga todas as outras (exceto `generationPaused`). Pipeline roda como v1.4: sem crédito, sem Copy Director, sem rate limit |
| `creditsChargingEnabled` | Pipeline **não chama** `getBalance()`/`reserveCredit()` — toda geração prossegue sem verificação de saldo. Útil para testes, onboarding gratuito estendido. Se quiser rastrear quantas gerações ocorreriam sem charging, usa-se log/telemetria, não pseudo-reserva |
| `copyDirectorEnabled` | Pipeline **não chama** `CopyDirectorService` — `publication_copy_snapshot` volta a ser populado via `buildPublicationCopySnapshot()` determinístico. Sem shadow mode, sem custo de IA |
| `rateLimitEnabled` | `checkRateLimit()` sempre retorna `allowed: true`. Tentativas continuam registradas em `generation_rate_events` para auditoria |
| `generationPaused` | `POST /api/campaign/generate-image` retorna 503 antes de qualquer operação. **Sobrescreve todas as outras flags** |

**Por que env vars na F28:**
- Zero dependência externa (sem tabela, sem Redis)
- Toggle via Vercel Environment Variables (re-deploy ou instant se Vercel Environment Variables)
- Migração futura para tabela `feature_flags` é segura: o helper `getLaunchConfig()` encapsula a fonte

**Onde as flags são verificadas (apenas na orquestração do pipeline):**
- `generate-image/route.ts` — `generationPaused`, `v15Enabled`, `creditsChargingEnabled`, `rateLimitEnabled`, `copyDirectorEnabled`
- `rate-limit.ts` — `rateLimitEnabled`
- `CreditService` — **não verifica flags**. Serviço financeiro sempre faz o que o nome promete. A flag pertence ao pipeline, não ao serviço
- `CopyDirectorService` — **não verifica flags**. Quem decide chamar ou não é o pipeline

---

### D2 — Logging estruturado como helper central

`DECIDIDO`

Criar `src/lib/logging/pipeline-logger.ts` com helper `logPipelineEvent()` que sempre emite JSON estruturado:

```typescript
interface PipelineEvent {
  event: string;           // "pipeline.stage.start" | "pipeline.stage.complete" | "pipeline.stage.error"
  traceId: string;         // gerado por request, propagado em todo o pipeline
  campaignId?: string;
  storeId?: string;
  userId?: string;
  phase: string;           // "rate_limit" | "balance_check" | "copy_generation" | "image_generation" | "merge" | "upload" | "update"
  status: "running" | "complete" | "failed";
  durationMs?: number;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;  // sem base64, sem prompt completo, sem dados sensíveis
}
```

**Contrato:**
- `console.log(JSON.stringify(event))` — formato bruto consumível pelo Vercel Logs
- Sem lib externa de logging (Pino, Winston) — mantém dependência zero
- Sempre sem base64, sem prompt completo, sem dados sensíveis
- `traceId` gerado no início do request e propagado em todas as etapas
- Todas as etapas do pipeline emitem pelo menos 2 eventos: `running` e `complete|failed`
- O helper NÃO bloqueia o pipeline (fire-and-forget)
- O helper NÃO substitui os eventos NDJSON para o cliente — são canais diferentes

**Pipeline stages que emitem eventos:**

```
PRÉ-STREAM:
  rate_limit_check     → running / complete | failed
  balance_check        → running / complete | failed (saldo insuficiente)
  campaign_create      → running / complete | failed
  credit_reserve       → running / complete | failed

PARALELO (cada ramo):
  copy_generation      → running / complete | failed
  image_generation     → running / complete | failed

PÓS-PARALELO:
  merge                → running / complete | failed
  upload               → running / complete | failed
  update_ready         → running / complete | failed
  credit_confirm       → running / complete | failed
  credit_refund        → running / complete | failed
```

---

### D3 — Telemetria de IA via expansão de `generation_events`

`DECIDIDO`

Expandir a tabela `generation_events` para suportar telemetria de campanha. A tabela existente tem a estrutura base que precisamos; o que muda é o CHECK constraint e a adição de colunas mínimas.

**Migration necessária:**

```sql
-- 1. Remover CHECK constraint existente
ALTER TABLE public.generation_events
  DROP CONSTRAINT IF EXISTS chk_generation_events_type;

-- 2. Adicionar nova CHECK constraint com tipos de campanha
ALTER TABLE public.generation_events
  ADD CONSTRAINT chk_generation_events_type
  CHECK (generation_type IN (
    'visual_signature', 'brand_profile_without_logo', 'brand_profile_with_logo',
    'campaign_pipeline', 'campaign_copy', 'campaign_image'
  ));

-- 3. Adicionar colunas de telemetria de campanha (opcionais, sem quebrar registros existentes)
ALTER TABLE public.generation_events
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_id UUID,  -- diagnóstico apenas, sem FK para auth.users.
                                          -- Motivo: auth.users é schema gerenciado pelo Supabase Auth.
                                          -- Adicionar FK criaria dependência de schema que pode ser
                                          -- recriado em migrações de auth. Como o dado é apenas
                                          -- para telemetria e diagnóstico (não crítico), nullable
                                          -- sem FK é seguro e evitamos acoplamento desnecessário.
  ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS completion_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS total_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS trace_id TEXT,
  ADD COLUMN IF NOT EXISTS phase TEXT;
```

**Separação de responsabilidades:**

```
generation_rate_events → enforcement / quota (ONLY generation_attempt event_type)
generation_events      → observabilidade / IA / custo / diagnóstico (todos os tipos de geração)
credit_transactions    → financeiro / ledger (append-only, fiscal)
admin_audit_log        → operação humana (append-only, imutável)
```

**Quando persistir telemetria:**

| Evento | Timestamp | Dados |
|--------|-----------|-------|
| Copy Director completa | `generation_type = 'campaign_copy'` | provider, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, duration_ms, status='success', campaign_id, store_id, user_id, trace_id |
| Copy Director falha | `generation_type = 'campaign_copy'` | provider, model, duration_ms, status='failed', error_type, campaign_id, store_id, trace_id |
| Image Director completa | `generation_type = 'campaign_image'` | provider, model, estimated_cost_usd, duration_ms, status='success', campaign_id, store_id, trace_id |
| Image Director falha | `generation_type = 'campaign_image'` | provider, model, duration_ms, status='failed', error_type, campaign_id, store_id, trace_id |
| Pipeline completo (result final) | `generation_type = 'campaign_pipeline'` | provider, model, total_cost_usd, total_duration_ms, status='success'|'failed', campaign_id, store_id, user_id, trace_id, metadata = { hadCopyRetry, hadImageRetry, phases: [...] } |

**Custo estimado:** Usa helper `estimateAiCost({ provider, model, usage })` em `src/lib/ai-cost/cost-estimator.ts` que retorna `{ estimatedCostUsd, source }` ou `null` (se provider/model não for reconhecido). A fonte primária é o `usage` retornado pelo provider (prompt_tokens + completion_tokens) combinado com uma tabela de preços versionada dos provedores (OpenAI, Gemini). Os valores na tabela são **aproximações baseadas em preços públicos — verificar valores exatos na implementação**. Fallback para `null` registra telemetria sem custo — o dashboard mostra "N/D" para essa geração.

**Regra de inserção:** best-effort, nunca bloqueia o pipeline. INSERT via `supabaseAdmin`, sem RLS (default-deny mantido). Se a inserção falhar, o pipeline continua — telemetria não é crítica.

---

### D4 — Dashboard operacional MVP

`DECIDIDO`

Nova página `/admin/metrics` com cards de métricas agregadas. **Não substitui o admin operacional (F26)** — complementa com visão de saúde que o F26 não tem.

```
F26 (Admin Operacional)               F28 (Dashboard Métricas)
─────────────────────────             ───────────────────────────
Listar usuários/lojas                 Taxa de sucesso (agregado)
Ver saldo individual                  Custo médio por geração
Conceder créditos manual              Erro rate (série temporal)
Ver extrato individual                Tempo médio de geração
Ver erros individuais                 Créditos concedidos (total)
Audit log                             Estorno rate
                                      Users ativos (período)
                                      Health state geral
```

**Estrutura da página:**

```
/admin/metrics
  ├── Health State Banner: ● Healthy | ● Attention | ● Pause
  ├── Cards (última hora / 24h / 7d):
  │   ├── Taxa de Sucesso       — 92% | 95% | 93%
  │   ├── Erro Rate             — 3% | 2% | 4%
  │   ├── Custo Médio/Geração   — USD 0,03 | USD 0,02 | USD 0,04
  │   ├── Tempo Médio           — 18s | 22s | 20s
  │   ├── Créditos Concedidos   — 15 | 45 | 120
  │   ├── Estorno Rate          — 5% | 3% | 4%
  │   └── Users Ativos          — 3 | 5 | 7
  └── (opcional) Tabela de falhas recentes (últimas 10)
```

**Como as métricas são obtidas:**
- `src/lib/metrics/` — novo módulo com funções que consultam `generation_events`, `credit_transactions` e `generation_rate_events` via `supabaseAdmin`
- Server Component SSR — dados frescos a cada navegação
- Sem cache, sem agregação prévia (volume é baixo)
- Se latência for problema, otimizações futuras (tabela de agregação hourly)

**Health state calculation:**

> ⚠️ **Nota sobre os thresholds:** Os limites abaixo são **mais conservadores** que os definidos na milestone v1.5 (Critérios de Lançamento Externo Controlado). A milestone define atenção a partir de R$ 1,00 de custo médio e pausa a partir de R$ 2,00. Para o beta inicial, adotamos limites mais rigorosos para acionar cedo. Se a operação amadurecer, os thresholds podem ser relaxados para alinhar com a milestone — o cálculo é parametrizável.

| Métrica | Healthy | Attention | Pause |
|---------|---------|-----------|-------|
| Taxa de sucesso | ≥ 85% | ≥ 70% e < 85% | < 70% |
| Erro rate | < 5% | ≥ 5% e < 10% | ≥ 10% |
| Custo médio | < USD 0,02 | ≥ USD 0,02 e < USD 0,05 | ≥ USD 0,05 |
| Tempo médio | < 30s | ≥ 30s e < 45s | ≥ 45s |
| Estorno rate | < 10% | ≥ 10% e < 15% | ≥ 15% |

Os custos são armazenados em USD (`estimated_cost_usd`) no banco (fonte primária: usage retornado pelo provider + tabela de preços versionada). O dashboard pode exibir em BRL usando a taxa documentada no env var `VENDEO_USD_BRL_RATE` (default: 5,50). **A exibição em BRL é uma conversão no frontend, não um valor armazenado.**

O health state geral é o **pior** entre todos os indicadores. Se qualquer métrica estiver em "pause", o banner mostra pause. Se qualquer métrica estiver em "attention" (e nenhuma em pause), mostra attention. Só mostra healthy se todas estiverem healthy.

---

### D5 — Alertas como health states + runbook, não sistema real

`DECIDIDO`

"Alertas configurados" na F28 significa:

1. **Dashboard de métricas** mostra health state (healthy / attention / pause) com base nos limites documentados
2. **Logs estruturados** podem incluir `alertKind` quando uma métrica cruza o limite (opcional, não obrigatório para o MVP)
3. **Runbook operacional** documenta: "Se health state for 'attention', verificar X. Se for 'pause', seguir procedimento de pausa."
4. **Sem integração externa** — sem Slack, Datadog, PagerDuty, email automático. Se o time precisar, pode ser adicionado depois sem refatoração.

**Fora do escopo da F28:**
- Alertas push (Slack, webhook, email)
- Notificações automáticas
- Integração com Datadog, Grafana ou qualquer ferramenta externa
- Página de alertas com histórico

---

### D6 — Deploy checklist e runbook como documentação versionada

`DECIDIDO`

Criar `docs/operations/` com três documentos:

**`docs/operations/deploy-checklist.md`:**
- Pré-requisitos (env vars, migrations pendentes, testes)
- Passos de deploy (Vercel)
- Verificação pós-deploy (smoke tests: login, geração, admin)
- Rollback de código (Vercel rollback)
- Rollback de banco (migrations reversíveis — REVERSE sections existentes)
- Quem pode executar cada passo

**`docs/operations/support-runbook.md`:**
- Conceder créditos manualmente (via admin UI F26)
- Estornar transação (procedimento + comando SQL se necessário)
- Verificar saldo de uma loja
- Verificar extrato de uma loja
- Investigar campanha com erro
- Executar cleanup manual de generation_events (90 dias)
- Pausar geração (ativar `VENDEO_GENERATION_PAUSED`)
- Lista de alertas manuais e o que fazer em cada um

**`docs/operations/environment-variables.md`:**
Catálogo completo de env vars:

```
VENDEO_V15_ENABLED                  | true     | Master switch v1.5
VENDEO_CREDITS_CHARGING_ENABLED     | true     | Dedução de créditos
VENDEO_COPY_DIRECTOR_ENABLED        | true     | Copy Director como fonte
VENDEO_RATE_LIMIT_ENABLED           | true     | Rate limit
VENDEO_GENERATION_PAUSED            | false    | Emergency brake
OPENAI_API_KEY                      | —        | Obrigatória
OPENAI_TEXT_MODEL                   | gpt-4o   | Modelo de texto
GEMINI_API_KEY                      | —        | Obrigatória para fallback
GEMINI_TEXT_MODEL                   | —        | Modelo de texto Gemini
SUPABASE_URL                        | —        | Obrigatória
SUPABASE_SERVICE_ROLE_KEY           | —        | Obrigatória
SUPPORT_EMAIL                       | —        | Email de suporte (F27)
VENDEO_USD_BRL_RATE                 | 5.50     | Taxa de conversão USD→BRL para dashboard
```

---

### D7 — Retenção 90d: função SQL + runbook; job automático adiado

`DECIDIDO`

O cleanup de 90 dias para `generation_events` é entregue na F28 como:

1. **Função SQL versionada** em `supabase/migrations/20260718000003_cleanup_generation_events_90d.sql`:

```sql
-- Cria função reutilizável de cleanup. Chamada manualmente via runbook.
-- Scheduling automático: D+30 pós-lançamento ou F29.
-- NOTA: migration NÃO executa a função — apenas a define.
CREATE OR REPLACE FUNCTION public.cleanup_generation_events_90d()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count bigint;
BEGIN
  DELETE FROM public.generation_events
  WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
```

2. **Runbook documentado** em `docs/operations/support-runbook.md` com o comando exato:

```sql
-- Executar cleanup manualmente (runbook)
SELECT public.cleanup_generation_events_90d();
```

3. **Nota explícita** no runbook: "Job automático agendado para [DATA] — enquanto não houver scheduling, executar manualmente 1x/semana ou conforme necessidade"

**Por que função SQL em vez de migration com DELETE:** Migrations que executam DELETE podem rodar automaticamente em deploy, com risco de deletar dados acidentalmente. Uma função é versionada, segura (só executa quando chamada), e o runbook referencia o comando exato.

---

### D8 — Concorrência: teste de pipeline com mocks

`DECIDIDO`

F24 já testou atomicidade das funções SQL (`reserve_credit`, `refund_credit`) com transações simultâneas simuladas. F28 testa a concorrência no pipeline real onde o risco reaparece:

**Cenário a testar:**
- Dois requests simultâneos para `POST /api/campaign/generate-image`
- Mesma loja (`storeId`)
- Saldo disponível: 1 crédito
- Ambos passam no rate limit guard
- Ambos passam no input validation

**Resultado esperado:**
- Apenas um request consegue reservar o crédito → pipeline prossegue
- O segundo request falha na reserva → retorna 402 Payment Required
- Nenhuma chamada de IA paga acontece para o request rejeitado
- Saldo final = 0 (1 reservado + 0 do rejeitado)
- `credit_transactions` consistente: 1 deduction + 0 refund (apenas o vencedor)
- Ledger consistente: balance_after = 0

**Implementação do teste:**
- Mock dos providers de IA (TextProvider, ImageProvider) para evitar chamadas HTTP reais
- Usar `Promise.all` para disparar ambos os requests simultaneamente
- Verificar status HTTP de cada resposta
- Verificar saldo final via `CreditService.getBalance()`

---

### D9 — Nenhuma nova tabela (apenas alter CHECK constraint)

`DECIDIDO`

A F28 não cria novas tabelas. As alterações de schema são mínimas:

| Tabela | Alteração |
|--------|-----------|
| `generation_events` | ALTER CHECK constraint para aceitar `campaign_pipeline`, `campaign_copy`, `campaign_image`. ADD COLUMN campaign_id, user_id, prompt_tokens, completion_tokens, total_tokens, trace_id, phase |
| `generation_rate_events` | Nenhuma (já está separada desde F25) |
| `credit_transactions` | Nenhuma |
| `admin_audit_log` | Nenhuma |

As novas colunas em `generation_events` são todas opcionais (nullable ou com default). Nenhuma quebra retroativa.

---

## Estrutura de Código

```
ARQUIVOS NOVOS:
════════════════

src/lib/
  launch-config/
    config.ts                          ← getLaunchConfig(), LaunchConfig type
    __tests__/
      config.test.ts                   ← 5+ testes (cada flag, defaults, edge cases)

  logging/
    pipeline-logger.ts                 ← logPipelineEvent(), PipelineEvent type
    __tests__/
      pipeline-logger.test.ts          ← 3+ testes (formato, sanificação, completeness)

  metrics/
    index.ts                           ← barrel export
    pipeline-metrics.ts                ← getSuccessRate(), getErrorRate(), getAvgCost(), getAvgDuration(),
                                          getCreditsGranted(), getRefundRate(), getActiveUsers()
    health.ts                          ← getHealthState(): "healthy" | "attention" | "pause"
    types.ts                           ← MetricCard, HealthState, TimeRange
      ai-cost/
    cost-estimator.ts                  ← estimateAiCost()
    __tests__/
      cost-estimator.test.ts           ← 3+ testes (OpenAI, Gemini, unknown provider)

__tests__/
      pipeline-metrics.test.ts         ← 5+ testes (cada métrica, períodos)
      health.test.ts                   ← 3+ testes (estados, limites)

src/app/
  (app)/
    admin/
      metrics/
        page.tsx                       ← Server Component com cards de métricas
        metrics-cards.tsx              ← Client Component para exibição dos cards
        health-banner.tsx              ← Banner de health state

supabase/
  migrations/
    20260718000002_expand_generation_events.sql    ← ALTER CHECK + ADD COLUMNS
    20260718000003_cleanup_generation_events_90d.sql ← Função SQL cleanup_generation_events_90d()

src/lib/
  ai-cost/
    index.ts                           ← barrel export
    cost-estimator.ts                  ← estimateAiCost({ provider, model, usage }): AiCostEstimate | null

docs/
  operations/
    deploy-checklist.md                ← Checklist de deploy, rollback, verificação
    support-runbook.md                 ← Procedimentos operacionais
    environment-variables.md           ← Catálogo de env vars


ARQUIVOS MODIFICADOS:
══════════════════════

src/app/api/campaign/generate-image/route.ts
  ← Adicionar logPipelineEvent() em cada etapa
  ← Adicionar verificação de launch config (generationPaused, v15Enabled)
  ← Adicionar telemetria em generation_events (campaign_pipeline, campaign_copy, campaign_image)
  ← Adicionar geração de traceId por request

src/lib/rate-limit/rate-limit.ts
  ← Adicionar verificação de rateLimitEnabled
  ← Logging estruturado

src/lib/credit/credit-service.ts
  ← Sem alterações. Flags pertencem à orquestração do pipeline

src/lib/copy/copy-director-service.ts
  ← Nenhuma alteração (quem decide chamar ou não é o pipeline, não o serviço)

src/app/api/admin/layout.tsx (se existir)
  ← Adicionar link para /admin/metrics na navegação admin
```

---

## Contratos de Integração

### Launch config — uso no pipeline

```typescript
// generate-image/route.ts — verificação no início do handler
import { getLaunchConfig } from "@/lib/launch-config/config";

const config = getLaunchConfig();

// Emergency brake
if (config.generationPaused) {
  return Response.json(
    { error: { message: "Geração temporariamente indisponível." } },
    { status: 503 }
  );
}

// Master switch
if (!config.v15Enabled) {
  // Ignorar creditsChargingEnabled, copyDirectorEnabled, rateLimitEnabled
  // Pipeline roda como v1.4
}

// Rate limit guard (antes de qualquer operação paga)
if (config.rateLimitEnabled) {
  const rateLimitResult = await checkRateLimit(storeId);
  if (!rateLimitResult.allowed) {
    return Response.json({ error: "rate_limit_exceeded", ... }, { status: 429 });
  }
}

// Saldo check (antes da IA)
if (config.creditsChargingEnabled) {
  const balance = await creditService.getBalance(storeId);
  if (balance < COST_PER_GENERATION) {
    return Response.json({ error: { message: "Saldo insuficiente." } }, { status: 402 });
  }
}
```

### Logging — uso no pipeline

```typescript
// generate-image/route.ts — dentro do handler
import { logPipelineEvent } from "@/lib/logging/pipeline-logger";
import { randomUUID } from "crypto";

const traceId = randomUUID();

// Antes de cada etapa:
logPipelineEvent({
  event: "pipeline.stage.start",
  traceId,
  campaignId,
  storeId,
  userId,
  phase: "rate_limit_check",
  status: "running",
});

// Após cada etapa (sucesso):
logPipelineEvent({
  event: "pipeline.stage.complete",
  traceId,
  campaignId,
  storeId,
  userId,
  phase: "rate_limit_check",
  status: "complete",
  durationMs: elapsed,
});

// Após cada etapa (falha):
logPipelineEvent({
  event: "pipeline.stage.error",
  traceId,
  campaignId,
  storeId,
  userId,
  phase: "rate_limit_check",
  status: "failed",
  durationMs: elapsed,
  errorCode: "rate_limit_exceeded",
  errorMessage: "Usuário excedeu limite de 10 gerações por hora",
});
```

### Custo estimado

```typescript
// src/lib/ai-cost/cost-estimator.ts
import type { AiCostEstimate } from "./types";

const OPENAI_PRICING: Record<string, { inputPer1K: number; outputPer1K: number }> = {
  "gpt-4o":            { inputPer1K: 0.0025, outputPer1K: 0.01 },
  "gpt-4o-mini":       { inputPer1K: 0.00015, outputPer1K: 0.0006 },
  "dall-e-3":          { inputPer1K: 0, outputPer1K: 0 }, // fixed per-image cost
};

export function estimateAiCost(params: {
  provider: string;
  model: string;
  usage?: { promptTokens?: number; completionTokens?: number };
}): AiCostEstimate | null {
  const pricing = OPENAI_PRICING[params.model];
  if (!pricing || !params.usage) return null;

  const inputCost = ((params.usage.promptTokens ?? 0) / 1000) * pricing.inputPer1K;
  const outputCost = ((params.usage.completionTokens ?? 0) / 1000) * pricing.outputPer1K;
  const total = Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;

  return { estimatedCostUsd: total, source: "openai_published_pricing" };
}
```

### Telemetria — inserção em generation_events

```typescript
// generate-image/route.ts — após Copy Director completar
import { supabaseAdmin } from "@/lib/supabase/server";
import { estimateAiCost } from "@/lib/ai-cost/cost-estimator";

// Best-effort, nunca bloqueia o pipeline
try {
  const costEstimate = estimateAiCost({
    provider: "openai",
    model: copyModel,
    usage: { promptTokens: copyUsage.promptTokens, completionTokens: copyUsage.completionTokens },
  });

  await supabaseAdmin.from("generation_events").insert({
    store_id: storeId,
    user_id: userId,
    campaign_id: campaignId,
    generation_type: "campaign_copy",
    provider: "openai",
    model: copyModel,
    duration_ms: copyDurationMs,
    estimated_cost_usd: costEstimate?.estimatedCostUsd ?? null,
    status: "success",
    prompt_tokens: copyUsage.promptTokens,
    completion_tokens: copyUsage.completionTokens,
    total_tokens: copyUsage.totalTokens,
    trace_id: traceId,
    phase: "copy_generation",
    metadata: {},
  });
} catch {
  // Non-blocking — telemetria não crítica
}
```

### Health state

```typescript
// src/lib/metrics/health.ts

export type HealthState = "healthy" | "attention" | "pause";

export interface HealthMetrics {
  successRate24h: number;
  errorRate24h: number;
  avgCost24h: number;
  avgDuration24h: number;
  refundRate24h: number;
}

// Thresholds conservadores para beta. Parametrizáveis no futuro.
// Alinhamento com milestone v1.5 (limites mais relaxados) pode ser feito
// ajustando estas constantes — sem mudança de lógica.
const ATTENTION_COST_USD = 0.02;
const PAUSE_COST_USD = 0.05;

export function computeHealthState(metrics: HealthMetrics): HealthState {
  if (
    metrics.successRate24h < 70 ||
    metrics.errorRate24h >= 10 ||
    metrics.avgCost24h >= PAUSE_COST_USD ||
    metrics.avgDuration24h >= 45 ||
    metrics.refundRate24h >= 15
  ) {
    return "pause";
  }
  if (
    metrics.successRate24h < 85 ||
    metrics.errorRate24h >= 5 ||
    metrics.avgCost24h >= ATTENTION_COST_USD ||
    metrics.avgDuration24h >= 30 ||
    metrics.refundRate24h >= 10
  ) {
    return "attention";
  }
  return "healthy";
}
```

---

## Testes

25+ testes seguindo padrão do repositório:

### Launch config (5 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 1 | `getLaunchConfig()` com defaults → `v15Enabled: true`, `generationPaused: false` | Defaults corretos |
| 2 | `v15Enabled=false` desliga todas as outras flags | Master switch |
| 3 | `generationPaused=true` → `paused: true` | Emergency brake |
| 4 | Cada flag individual respeita env var | Leitura correta |
| 5 | Env var mal formatada → fallback para default | Tolerância a erro |

### Pipeline logger (4 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 6 | `logPipelineEvent()` emite JSON com todos os campos obrigatórios | Formato correto |
| 7 | `logPipelineEvent()` não inclui base64 em metadata | Sanificação |
| 8 | `logPipelineEvent()` não inclui prompt completo em metadata | Sanificação |
| 9 | Múltiplas chamadas com mesmo traceId → traceId consistente | Propagação |

### Pipeline metrics (5 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 10 | `getSuccessRate()` com dados de sucesso → percentual correto | Cálculo |
| 11 | `getErrorRate()` com dados mistos → percentual correto | Cálculo |
| 12 | `getAvgCost()` com custos variados → média correta | Cálculo |
| 13 | `getActiveUsers()` com 3 usuários distintos → 3 | Contagem |
| 14 | `getRefundRate()` com 2 refunds em 10 transações → 20% | Cálculo |

### Health state (3 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 15 | Todas as métricas saudáveis → "healthy" | Limites |
| 16 | Uma métrica em attention → "attention" | Degradação parcial |
| 17 | Uma métrica em pause → "pause" | Degradação crítica |

### Concorrência no pipeline (3 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 18 | Dois requests simultâneos, saldo=1, mesma loja → apenas um vence | Race condition |
| 19 | Request vencedor → status 200, campanha criada | Pipeline prossegue |
| 20 | Request perdedor → status 402, saldo inalterado | Bloqueio correto |

### Cost estimator (3 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 21 | `estimateAiCost()` com OpenAI gpt-4o + tokens → custo calculado | Pricing conhecido |
| 22 | `estimateAiCost()` com modelo desconhecido → null | Fallback seguro |
| 23 | `estimateAiCost()` sem usage → null | Uso parcial |

### Telemetria generation_events (3 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 24 | INSERT `campaign_copy` com tokens → registro completo | Schema expandido |
| 25 | INSERT sem campaign_id → nullable funciona | Compatibilidade |
| 26 | Falha na inserção → pipeline continua (best-effort) | Non-blocking |

### Regressão (2+ testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 27 | Geração com `v15Enabled=false` → fluxo v1.4 (sem crédito, sem copy director, sem rate limit) | Master switch |
| 28 | Geração com `generationPaused=true` → 503 antes de qualquer operação | Emergency brake |

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **Feature flags confundem a operação** — time não sabe qual flag ligar/desligar | Runbook documenta cenários ("Se X acontecer, desligar Y"). Flags têm defaults seguros (todas ON, exceto generationPaused) |
| **Logging estruturado sem schema** — logs viram ruído sem consulta estruturada | Campos obrigatórios definidos como contrato. Vercel Logs permite filtragem por campo. Sem schema JSON formal (evita dependência) |
| **Health state enganoso** — dashboard mostra green mas pipeline está quebrado | Health state é o **pior** entre todos os indicadores. Runbook instrui verificação cruzada |
| **Race condition no pipeline real** — teste de concorrência passa com mock mas falha em produção | Teste usa mocks realistas. Risco baixo porque `reserve_credit` é função SQL atômica já testada na F24. O teste de concorrência valida o encadeamento pipeline → SQL, não a atomicidade SQL em si |
| **Telemetria bloqueia o pipeline** — INSERT em generation_events falha e propaga erro | Best-effort: try/catch com log de erro local. Nunca propaga. Pipeline continua sem telemetria |
| **Cleanup manual esquecido** — generation_events acumula além de 90 dias | Runbook documenta periodicidade sugerida (1x/semana). Job automático entra em D+30 ou F29 como tarefa separada |
| **Deploy checklist desatualizado** — time segue passos que não refletem o estado real | Checklist versionado no repositório. Atualizado a cada fase que modifica deploy |
| **Env vars mal documentadas** — nova env var adicionada sem atualizar catálogo | Policy: toda PR que adiciona env var deve atualizar `docs/operations/environment-variables.md`. Verificação no code review |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| Alertas push (Slack, email, webhook) | MVP operacional não precisa. Health states + runbook são suficientes para o beta |
| Integração com Datadog, Grafana ou ferramentas externas de observabilidade | Vercel Logs + logs estruturados são suficientes. Ferramental externo é otimização futura |
| Gráficos elaborados / séries temporais com Chart.js ou Recharts | Dashboard MVP usa cards com valores numéricos. Gráficos entram em fase posterior se necessário |
| Cache de métricas / agregação prévia (tabela hourly) | Volume é baixo (3-5 lojistas). SSR sem cache é suficiente |
| Job automático de cleanup (pg_cron ou serverless) | Adiado para D+30 ou F29. Script versionado + runbook manual desbloqueiam o ship |
| Refinamento visual de componentes existentes (loading, error, empty states) | F29 — Refinamento Visual + UAT |
| UAT externo com lojistas reais | F29 — Launch Readiness |
| Feedback channel in-app | F29 — Launch Readiness |
| Revisão mobile com dispositivos reais | F29 — Launch Readiness |
| Critérios de expandir/pausar aprovados pelo time | F29 — Launch Readiness |
| Stripe Checkout / compra de créditos | F30/v1.6 (pós-beta) |
| Múltiplas lojas / 1:N | Relação 1:1 mantida |
| Dashboard administrativo avançado (receita, LTV, cohorts) | Fora do core da v1.5 |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — Launch config centralizado com 5 flags explícitas (não flag única)
- [ ] D2 — Logging estruturado via helper `logPipelineEvent()` sem lib externa
- [ ] D3 — Telemetria IA via expansão de `generation_events` (CHECK constraint + colunas)
- [ ] D4 — Dashboard operacional MVP em `/admin/metrics` (cards, sem gráficos)
- [ ] D5 — Alertas como health states + runbook, sem integração externa
- [ ] D6 — Deploy checklist e runbook como documentação versionada em `docs/operations/`
- [ ] D7 — Retenção 90d: função SQL versionada + runbook manual; job automático adiado
- [ ] D8 — Testes de concorrência no pipeline com mocks (não apenas SQL)
- [ ] D9 — Nenhuma nova tabela (apenas ALTER CHECK + ADD COLUMNS em generation_events)

### Launch config
- [ ] `getLaunchConfig()` retorna defaults corretos sem env vars
- [ ] `VENDEO_GENERATION_PAUSED=true` → 503 antes de qualquer operação
- [ ] `VENDEO_V15_ENABLED=false` → pipeline v1.4 (sem crédito, sem Copy Director, sem rate limit)
- [ ] `VENDEO_RATE_LIMIT_ENABLED=false` → rate limit bypass
- [ ] `VENDEO_CREDITS_CHARGING_ENABLED=false` → pipeline não chama getBalance()/reserveCredit()
- [ ] `VENDEO_COPY_DIRECTOR_ENABLED=false` → fallback determinístico
- [ ] Testes para cada flag + edge cases

### Logging
- [ ] `logPipelineEvent()` emite JSON com todos os campos obrigatórios
- [ ] Sem base64, sem prompt completo, sem dados sensíveis
- [ ] `traceId` gerado por request e propagado em todas as etapas
- [ ] Todas as etapas do pipeline emitem running + complete|failed
- [ ] Logging nunca bloqueia o pipeline
- [ ] Etapas cobertas: rate_limit, balance_check, campaign_create, credit_reserve, copy_generation, image_generation, merge, upload, update_ready, credit_confirm, credit_refund
- [ ] Testes de formato, sanificação e propagação

### Telemetria IA
- [ ] Migration expande CHECK constraint de `generation_events`
- [ ] Migration adiciona colunas: campaign_id, user_id, prompt_tokens, completion_tokens, total_tokens, trace_id, phase
- [ ] Colunas novas são todas opcionais (sem quebra retroativa)
- [ ] INSERT em `generation_events` após Copy Director completar
- [ ] INSERT em `generation_events` após Image Director completar
- [ ] INSERT em `generation_events` ao final do pipeline (campaign_pipeline)
- [ ] Best-effort: try/catch, nunca bloqueia o pipeline
- [ ] Testes de INSERT com e sem campaign_id, e falha de inserção

### Dashboard operacional
- [ ] Página `/admin/metrics` acessível apenas via `requireAdmin()`
- [ ] Cards: taxa de sucesso, erro rate, custo médio, tempo médio, créditos concedidos, estorno rate, users ativos
- [ ] Períodos: última hora / últimas 24h / 7 dias
- [ ] Health state banner: healthy / attention / pause
- [ ] Health state é o pior entre todos os indicadores
- [ ] Métricas consultam `generation_events`, `credit_transactions`, `generation_rate_events`
- [ ] Testes para cada métrica e health state

### Documentação operacional
- [ ] `docs/operations/deploy-checklist.md` — pré-requisitos, passos, verificação, rollback
- [ ] `docs/operations/support-runbook.md` — grant, estorno, saldo, erros, cleanup, pausa
- [ ] `docs/operations/environment-variables.md` — catálogo completo com descrição, obrigatoriedade, exemplo
- [ ] Runbook referencia script de cleanup como comando executável
- [ ] Runbook documenta procedimento de pausa (VENDEO_GENERATION_PAUSED)

### Retenção
- [ ] Função SQL `cleanup_generation_events_90d()` versionada em `supabase/migrations/20260718000003_cleanup_generation_events_90d.sql`
- [ ] Migration NÃO executa a função — apenas a define (segurança contra delete acidental em deploy)
- [ ] Runbook documenta comando `SELECT public.cleanup_generation_events_90d();`, frequência sugerida e nota sobre job automático futuro
- [ ] Função testada manualmente

### Testes de concorrência
- [ ] Dois requests simultâneos com saldo=1, mesma loja → apenas um vence (402)
- [ ] Mocks de IA impedem chamadas HTTP reais
- [ ] Saldo final consistente (0) após teste
- [ ] `credit_transactions` consistente (1 deduction, 0 refund)

### Regressão
- [ ] `npx vitest run` — novos + ~852 existentes passando
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npm run build` — build bem-sucedido
- [ ] Nenhum endpoint existente quebrado
- [ ] UAT local: geração com todas as flags ativas funciona como antes
- [ ] UAT local: `VENDEO_GENERATION_PAUSED=true` → 503
- [ ] UAT local: `VENDEO_V15_ENABLED=false` → pipeline v1.4

---

*Documento criado: 2026-07-18*
*Baseado no alinhamento da milestone v1.5, discussão entre dois agentes com realinhamento de escopo (flags explícitas, generation_events expandida, dashboard MVP, alertas como health states, corte F28/F29).*
*Próximo passo: sua revisão e aprovação — após aprovação, iniciar planejamento da fase via OpenSpec.*
