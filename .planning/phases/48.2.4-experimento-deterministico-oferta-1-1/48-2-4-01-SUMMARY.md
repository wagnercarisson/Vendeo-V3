---
phase: 48.2.4-experimento-deterministico-oferta-1-1
plan: 48-2-4-01
subsystem: database
tags: [supabase, postgres, ddl, zod, vitest, lab-bench, isolation, architecture-guard]

# Dependency graph
requires:
  - phase: 48.2.3-fidelidade-experimental-bancada
    provides: compositor mínimo + preflight (prompt_base/prompt_compiled/prompt_approved/prompt_blocks/composer_version) e bootstrap local idempotente
  - phase: 48.2.2-fundacao-bancada-geracao
    provides: lab_bench_runs/lab_bench_artifacts, bench-run-service (reserve/setInput/confirm/finalize), runtime da bancada e test doubles gravadores
provides:
  - DDL local aditivo (fora de supabase/migrations) com policy_versions/prompt_base_version/identity_reference/attempt_of_run_id + REVERT + imutabilidade estendida
  - BenchPreflightEvidenceSchema com policyVersions/promptBaseVersion/identityReference/presetId/config
  - BenchRunRecord/mapBenchRunRow/setBenchRunInput/reserveBenchRun carregando as novas colunas nullable
  - contratos de isolamento e gate de fronteira arquitetural da bancada estendidos (sem afrouxar regras)
affects: [48.2.4 planos 02-09, plano 09 (gate base..HEAD), futuros planos da bancada]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DDL local-first aditivo idempotente com bloco REVERT (fora de supabase/migrations)"
    - "Linhagem explícita por coluna nullable attempt_of_run_id (sem nova tabela)"
    - "Evidência persistida sem URL assinada (apenas { kind, variantType, storagePath })"
    - "Gate estático de fronteira arquitetural (imports/uso) sobre src/lib/lab/bench/** e scripts/lab/**"

key-files:
  created: []
  modified:
    - supabase/lab/bench-schema.sql
    - src/lib/lab/bench/domain/schemas.ts
    - src/lib/lab/bench/persistence/bench-run-service.ts
    - src/lib/lab/__tests__/recording-supabase-client.ts
    - src/lib/lab/__tests__/lab-isolation.contract.test.ts
    - src/lib/ai/__tests__/architecture-guard.test.ts

key-decisions:
  - "Campos novos de BenchPreflightEvidenceSchema entram como OPCIONAIS para preservar o comportamento de BenchRunInputSchema (compatibilidade dos consumidores atuais) e manter .strict()"
  - "attempt_of_run_id é escrito no INSERT de reserveBenchRun apenas quando informado (ausente ⇒ NULL por default do banco), preservando o contrato exato do insert existente"
  - "FORBIDDEN_TARGETS foi ampliado (campaign_images/credit_) sem remover nenhum alvo — nenhuma regra afrouxada"

patterns-established:
  - "DDL aditivo: cada coluna nova tem ADD COLUMN IF NOT EXISTS + DROP COLUMN IF EXISTS no bloco REVERT"
  - "Imutabilidade: attempt_of_run_id imutável desde a criação; evidências (policy_versions/prompt_base_version/identity_reference) imutáveis a partir de running"

requirements-completed:
  - "cap: lab-isolation"
  - "cap: lab-bench-run-history"
  - "cap: lab-bench-prompt-preflight"
  - "cap: lab-generation-bench"
  - "spec: lab-isolation"
  - "spec: lab-bench-run-history"
  - "spec: lab-bench-prompt-preflight"
  - "spec: lab-generation-bench"
  - "D13"
  - "D14"
  - "D17"
  - "tasks: 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.3, 2.4"

# Metrics
duration: ~25min
completed: 2026-09-30
---

# Phase 48.2.4 Plan 01: Fundação — DDL local de evidências/linhagem, schemas/persistência e isolamento

**Base SHA: f5a7fe9a27e823b64b355ec8c431d4e514d5ab99**

DDL local aditivo (policy_versions/prompt_base_version/identity_reference/attempt_of_run_id) com REVERT e imutabilidade estendida, alinhamento de `BenchPreflightEvidenceSchema`/`BenchRunRecord`/`mapBenchRunRow`/`setBenchRunInput`/`reserveBenchRun` às novas colunas e reforço dos contratos de isolamento/gate de fronteira arquitetural — sem tocar produção e sem criar tabela nova.

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-30 (execução sequencial, working tree principal)
- **Completed:** 2026-09-30
- **Tasks:** 3/3
- **Files modified:** 6

## Base SHA

- **Base SHA:** `f5a7fe9a27e823b64b355ec8c431d4e514d5ab99`
- Capturada com `git rev-parse HEAD` **antes** de qualquer edição da fase (working tree limpo no início).
- Uso: o Plano 09 (gate de produção intocada) prova `git diff $BASE..HEAD` vazio nos caminhos produtivos (base ausente ⇒ falha).

## Fases anteriores / OpenSpec

- **F48.2.2** (fundação da bancada) — concluída e **arquivada** (`openspec/changes/archive/2026-09-28-fase-48-2-2-fundacao-bancada-geracao`).
- **F48.2.3** (fidelidade experimental da bancada) — concluída e **arquivada** (`openspec/changes/archive/2026-09-29-fase-48-2-3-fidelidade-experimental-bancada`).
- **Change OpenSpec ativa conflitante:** nenhuma. O único change ativo é o desta fase (`openspec/changes/fase-48-2-4-experimento-deterministico-oferta-1-1`). (Item 1.1.)

## Accomplishments

- **DDL local aditivo** em `supabase/lab/bench-schema.sql` (fora de `supabase/migrations/`): `policy_versions JSONB`, `prompt_base_version TEXT`, `identity_reference JSONB` e `attempt_of_run_id UUID REFERENCES public.lab_bench_runs(id)` — todos NULLABLE, com `ADD COLUMN IF NOT EXISTS` e `DROP COLUMN IF EXISTS` correspondente no bloco REVERT.
- **Imutabilidade estendida** em `trg_lab_bench_runs_snapshot_immutable_fn`: `attempt_of_run_id` imutável desde a criação (junto de `operation_id`/`created_by`/`created_at`); `policy_versions`/`prompt_base_version`/`identity_reference` imutáveis a partir de `running` (mesmo bloco de `campaign_snapshot`/`branding_snapshot`/`config`/`prompt_sent`). Índice `uq_lab_bench_runs_one_active_global` e trigger no-delete **inalterados**.
- **Sem tabela nova** e **sem `supabase db push`**: `git status --porcelain supabase/migrations` permanece vazio.
- **Schemas**: `BenchPreflightEvidenceSchema` aceita `policyVersions` (mapa dimensão→versão), `promptBaseVersion`, `identityReference` (`BenchIdentityReferenceSchema.nullable()`, sem URL assinada), `presetId` e `config` (`BenchConfigSchema` — modelo/qualidade + dimensões do recorte), mantendo `.strict()`.
- **Persistência**: `BenchRunRecord`/`mapBenchRunRow` expõem `policyVersions`/`promptBaseVersion`/`identityReference`/`attemptOfRunId`; `setBenchRunInput` persiste `policy_versions`/`prompt_base_version`/`identity_reference` no `draft`; `reserveBenchRun` aceita `attemptOfRunId` opcional e o grava no `INSERT`. CAS `draft → pending`, CAS terminal de `finalizeBenchRun`, `markBenchRunRunning`, `reconcileStaleBenchRuns` e a regra `promptApproved ⇒ prompt_sent` permanecem inalterados.
- **Isolamento reforçado**: `lab-isolation.contract.test.ts` prova (a) ausência de acesso remoto, (b) ausência de URL assinada persistida (descritor e snapshot `.strict()`), (c) ausência de escrita em tabelas produtivas e (d) que `campaign-images` nunca é lido/reutilizado. `architecture-guard.test.ts` estende o gate de fronteira (imports/uso) a `scripts/lab/**` e comprova que o `ImagesAdapter` produtivo não é importado/instanciado e que `images` não é resolvido pelo `defaultAdapterRegistry` no runtime da bancada.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: DDL local (evidências/linhagem) + Base SHA** — `f392e5dd` (feat)
2. **Task 2: schemas + persistência** — `8494655d` (feat)
3. **Task 3: isolamento + gate de fronteira** — `bcbdf7f8` (test)

**Plan metadata:** (commit docs do SUMMARY por este executor)

## Files Created/Modified

- `supabase/lab/bench-schema.sql` — bloco 1c (colunas aditivas + comentário), trigger de imutabilidade estendido, bloco REVERT ampliado e cabeçalho de escopo.
- `src/lib/lab/bench/domain/schemas.ts` — `BenchPreflightEvidenceSchema` com os 5 campos novos (opcionais, `.strict()` preservado).
- `src/lib/lab/bench/persistence/bench-run-service.ts` — `BenchRunRecord`/`mapBenchRunRow`/`setBenchRunInput`/`reserveBenchRun` com as novas colunas nullable.
- `src/lib/lab/__tests__/recording-supabase-client.ts` — nota de que as novas colunas não criam tabelas; `FORBIDDEN_TARGETS` ampliado.
- `src/lib/lab/__tests__/lab-isolation.contract.test.ts` — novos casos de identidade sem URL assinada, local-only e produção intocada.
- `src/lib/ai/__tests__/architecture-guard.test.ts` — gates aditivos de fronteira (scripts/lab + registry padrão/ImagesAdapter).

## Decisions Made

- **Campos novos do preflight como opcionais.** O plano pede que `BenchPreflightEvidenceSchema` "aceite" os campos e que `BenchRunInputSchema` permaneça "inalterado em comportamento". Torno-os opcionais para não invalidar payloads existentes (consumidores e testes atuais) — o preenchimento efetivo ocorre nos Planos 06/07/08. `.strict()` mantido.
- **`attempt_of_run_id` gravado apenas quando informado.** `reserveBenchRun` inclui `attempt_of_run_id` no `INSERT` somente quando `attemptOfRunId` é passado; ausente ⇒ coluna permanece NULL pelo default do banco. Preserva o contrato exato do insert já coberto por teste.
- **`FORBIDDEN_TARGETS` ampliado, nunca reduzido.** Adicionados `campaign_images` e `credit_` (a critério de aceitação do plano), sem remover `campaigns`/`campaign_art_versions`/`generation_events`/`ai_model_selection`/`admin_audit_log`/`credit_transactions`/`campaign-images`.

## Deviations from Plan

Nenhum desvio que altere o escopo. Notas de fidelidade:

- **`FORBIDDEN_TARGETS`**: o critério de aceitação lista `campaign_images` e `credit_*`, mas a constante real usava `campaign_art_versions`/`credit_transactions`. Em vez de apenas documentar, **ampliei** a constante (aditivo, sem afrouxar) para satisfazer o critério literalmente. Nenhum alvo foi removido.
- **`scripts/lab/48-2-2-bench-bootstrap.mjs`**: permaneceu **inalterado** (comportamento correto confirmado) — `applyBenchSchema` executa o arquivo SQL inteiro e `extractRevertStatements` coleta automaticamente as novas linhas REVERT. O arquivo consta de `files_modified` do plano como potencial no-op; nenhum código precisou mudar.
- **Gate de fronteira e `defaultAdapterRegistry`**: o runtime da bancada (`gateway/runtime.ts`) importa `defaultAdapterRegistry` legitimamente como **fallback** para protocolos ≠ `images` (não registra o `ImagesAdapter` produtivo). O gate foi desenhado para refletir essa realidade: proíbe importar/instanciar o `ImagesAdapter` produtivo e proíbe resolver `images` pelo registry padrão — sem afrouxar as regras existentes.

## Issues Encountered

- O primeiro comando combinado de verificação da Task 2 reportou `typecheck falhou` por um artefato de `$LASTEXITCODE` do `npm` no PowerShell; reexecutando com `npm.cmd`, `npm run typecheck` retorna exit 0 e a suíte passa. Nenhuma alteração de código necessária.

## Verification

- `npm run typecheck` → exit 0.
- `npm test -- --run src/lib/lab/__tests__/lab-isolation.contract.test.ts src/lib/ai/__tests__/architecture-guard.test.ts src/lib/lab/bench/__tests__/bench-run-service.test.ts` → 3 arquivos, 66 testes, todos verdes.
- Verificação da Task 1 (colunas + REVERT + ausência de tabela nova + `supabase/migrations` vazio) → OK.
- `git status --porcelain supabase/migrations` → vazio.
- Nenhuma dependência nova; nenhuma chamada de rede/paga nos testes; nenhuma tabela nova.

## Threat Surface Scan

- `supabase/lab/bench-schema.sql` — novas colunas aditivas fora da cadeia de migrations (T-48-2-4-01 mitigado; REVERT por coluna). `identity_reference` guarda apenas `{ kind, variantType, storagePath }` — sem URL assinada (T-48-2-4-03). Nenhuma superfície nova além das previstas no `<threat_model>` do plano.

## Known Stubs

Nenhum. Os campos novos do preflight são opcionais por compatibilidade, mas o preenchimento é responsabilidade explícita dos Planos 06/07/08 (não são stubs que impeçam o objetivo deste plano, que é a fundação de persistência/isolamento).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DDL local pronto para aplicação/reversão idempotente pelo bootstrap local (`48-2-2-bench-bootstrap.mjs`), sem promoção ao remoto.
- Schemas/persistência prontos para os Planos 02–08 (compositor/políticas, prompt-base, identidade, tentativas, API/UI) consumirem as novas colunas.
- Gate de produção por Base SHA (`f5a7fe9a27e823b64b355ec8c431d4e514d5ab99`) disponível para o Plano 09.

---
*Phase: 48.2.4-experimento-deterministico-oferta-1-1*
*Completed: 2026-09-30*

## Self-Check: PASSED

