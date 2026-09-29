Base SHA: 73ece00fd54d72af1bd48c23a8458694ed1bd636

---
phase: 48.2.3-fidelidade-experimental-bancada
plan: 48-2-3-01
subsystem: lab-bench (laboratório/bancada de geração)
tags: [supabase, ddl, local-first, zod, vitest, architecture-guard, lab-isolation]

# Dependency graph
requires:
  - phase: 48.2.2-fundacao-bancada-geracao
    provides: "DDL local-first (lab_bench_runs/lab_bench_artifacts), bootstrap idempotente com REVERT, bench-run-service, contratos de isolamento (recording-supabase-client, lab-isolation.contract, architecture-guard)"
provides:
  - "DDL local aditivo: tabela lab_bench_store_imports (auditoria da importação) + colunas de evidência do preflight em lab_bench_runs, com REVERT"
  - "BenchRunInputSchema/BenchRunRecord fiéis (nome 60/descrição 120/informações 200, preserveImageContext, selo/intenção/validade/aviso) + evidência do preflight"
  - "Allowlist aditiva do runtime (lab_bench_store_imports) e gate estático de fronteira arquitetural da bancada/scripts/lab/**"
affects: [48-2-3-02, 48-2-3-03, 48-2-3-04, 48-2-3-05, 48-2-3-06, 48-2-3-07, 48-2-3-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DDL local-first aditivo com ALTER TABLE ... ADD COLUMN IF NOT EXISTS + bloco REVERT (idempotente sobre base existente)"
    - "Gate estático de fronteira arquitetural por imports/uso (sem congelar conteúdo produtivo)"

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
  - "Colunas de evidência do preflight em lab_bench_runs aplicadas via ALTER TABLE ... ADD COLUMN IF NOT EXISTS (idempotência sobre base já existente)"
  - "prompt_sent gravado idêntico ao prompt final aprovado (promptApproved é autoritativo em setBenchRunInput)"
  - "Gate de fronteira cobre src/lib/lab/bench/** e scripts/lab/**; a prova temporal de produção intocada (base..HEAD) pertence ao Plano 08"

patterns-established:
  - "Evidência mínima do preflight reusa lab_bench_runs/prompt_sent/campaign_snapshot (sem tabela de versões/histórico)"

requirements-completed:
  - "cap: lab-isolation"
  - "cap: lab-generation-bench"
  - "D11"
  - "D20"
  - "spec: lab-isolation"
  - "spec: lab-generation-bench"
  - "tasks: 1.1, 1.2, 1.3 (fronteira runtime), 1.5, 2.1, 2.2, 2.3"

# Metrics
duration: ~10min
completed: 2026-09-29
---

# Phase 48.2.3 Plan 48-2-3-01: Fundação (DDL aditivo, schemas fiéis e isolamento)

**DDL local-first aditivo (`lab_bench_store_imports` + evidência do preflight com REVERT), contrato fiel `BenchRunInputSchema`/`BenchRunRecord` com `preserveImageContext` e evidência, e gate estático de fronteira arquitetural da bancada — sem tocar produção.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-09-29
- **Tasks:** 3/3
- **Files modified:** 6

## Accomplishments

- `supabase/lab/bench-schema.sql` ganhou `public.lab_bench_store_imports` (auditoria local da importação, D11) com RLS/grants service-role, e `lab_bench_runs` ganhou as colunas NULLABLE de evidência do preflight (`prompt_base`, `prompt_compiled`, `prompt_approved`, `prompt_blocks`, `composer_version`), todas com linhas REVERT — aplicáveis/revertíveis pelo bootstrap idempotente. O DDL permanece fora de `supabase/migrations/`.
- `BenchRunInputSchema`/`BenchRunRecord` alinhados ao payload fiel (nome 60, descrição 120, informações obrigatórias 200, `preserveImageContext`, selo/intenção/validade/aviso) e à evidência mínima do preflight; `setBenchRunInput` persiste a evidência no `draft` com `prompt_sent` idêntico ao prompt aprovado. CAS/imutabilidade/índice global inalterados.
- Contratos de isolamento estendidos: `lab_bench_store_imports` na allowlist aditiva do runtime (único destino de escrita), loja/branding permanecem somente leitura, e um gate estático de fronteira (imports/uso) da bancada + `scripts/lab/**` — sem congelar conteúdo produtivo e sem afrouxar nenhuma regra global nem os gates F48.1/F48.2.1.

## Task Commits

Each task was committed atomically:

1. **Task 1: DDL local aditivo (auditoria + evidência do preflight)** - `41e77945` (feat)
2. **Task 2: Payload fiel e evidência mínima do preflight** - `dc91845f` (feat)
3. **Task 3: Allowlist aditiva da importação e gate de fronteira arquitetural** - `a9533e5c` (test)

## Files Created/Modified

- `supabase/lab/bench-schema.sql` - tabela `lab_bench_store_imports` + colunas de evidência do preflight em `lab_bench_runs`, com REVERT (fora de `supabase/migrations/`).
- `src/lib/lab/bench/domain/schemas.ts` - limites produtivos (60/120/200), `preserveImageContext`, selo/intenção/validade/aviso e `BenchPreflightEvidenceSchema`.
- `src/lib/lab/bench/persistence/bench-run-service.ts` - `BenchRunRecord`/`mapBenchRunRow` com a evidência; `setBenchRunInput` persiste no `draft` com `prompt_sent = prompt aprovado`.
- `src/lib/lab/__tests__/recording-supabase-client.ts` - `lab_bench_store_imports` em `ALLOWED_TABLES` e `ALLOWED_ENTRY_RE`.
- `src/lib/lab/__tests__/lab-isolation.contract.test.ts` - runtime sem conexão remota, loja/branding somente leitura e única escrita aditiva na auditoria local.
- `src/lib/ai/__tests__/architecture-guard.test.ts` - gate estático de fronteira (imports/uso) da bancada e `scripts/lab/**`.

## Decisions Made

- **Colunas de evidência via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`:** garante idempotência real sobre uma base local já existente (o `CREATE TABLE IF NOT EXISTS` seria no-op nesse caso). REVERT correspondente com `DROP COLUMN IF EXISTS`, como especificado.
- **`prompt_sent` = prompt aprovado:** em `setBenchRunInput`, quando `promptApproved` é fornecido ele é autoritativo e grava `prompt_sent` idêntico; caso contrário mantém o `promptSent` legado (compatível com chamadas atuais).
- **Gate de fronteira por imports/uso:** nenhuma checagem de conteúdo congelado de arquivos produtivos; a prova temporal de produção intocada (`base..HEAD`) fica no Plano 08.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `types` incluído na allowlist de módulos puros de campanha do gate de fronteira**
- **Found during:** Task 3 (gate de fronteira arquitetural)
- **Issue:** o plano lista como exceção apenas `src/lib/campaign/brief.ts`/`brief-schema.ts`, mas o código existente `src/lib/lab/bench/domain/campaign-snapshot.ts` importa legitimamente `@/lib/campaign/types` (módulo puro, apenas tipos). O gate literal falharia em código pré-existente legítimo.
- **Fix:** a allowlist do gate inclui `brief`, `brief-schema` e `types` (módulos puros genuinamente reutilizados), preservando o objetivo (impedir importar o pipeline/rotas produtivas de campanha) sem falso positivo.
- **Files modified:** `src/lib/ai/__tests__/architecture-guard.test.ts`
- **Verification:** `architecture-guard.test.ts` verde; o gate continua reprovando qualquer import de `src/lib/campaign/<módulo não-puro>` e de `src/app/api/campaign/**`.
- **Committed in:** `a9533e5c` (Task 3 commit)

**2. [Rule 3 - Blocking] Colunas de evidência aplicadas com `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`**
- **Found during:** Task 1 (DDL local)
- **Issue:** `CREATE TABLE IF NOT EXISTS public.lab_bench_runs` é no-op quando a tabela já existe localmente (F48.2.2), de modo que colunas declaradas inline nunca seriam adicionadas numa base existente — quebrando a idempotência exigida pelo bootstrap.
- **Fix:** colunas adicionadas por `ALTER TABLE public.lab_bench_runs ADD COLUMN IF NOT EXISTS ...` após o `CREATE TABLE`, com REVERT via `DROP COLUMN IF EXISTS`.
- **Files modified:** `supabase/lab/bench-schema.sql`
- **Verification:** verificação automatizada da Task 1 e `extractRevertStatements` do bootstrap (22 instruções REVERT coletadas, incluindo a tabela e as colunas novas).
- **Committed in:** `41e77945` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Ambos os auto-fixes são necessários para correção/idempotência; nenhum amplia produto nem afrouxa regras.

## Registros exigidos pelo plano

- **Item 1.1 — F48.2.2 concluída/arquivada:** a F48.2.2 está **CONCLUÍDA** e seu OpenSpec **verificado, sincronizado e arquivado** em `openspec/changes/archive/2026-09-28-fase-48-2-2-fundacao-bancada-geracao/`. Não há changes ativas pendentes da F48.2.2; a única change ativa é esta (`fase-48-2-3-fidelidade-experimental-bancada`).
- **Item 1.2 — comando de importação delimitado:** o comando de importação permanece delimitado em `scripts/lab/**` (ESM, `main(argv, env)`, sem efeitos de import) e **não** afeta o runtime da bancada. O gate estático de fronteira (Task 3) cobre `scripts/lab/**` e prova que o comando não importa o pipeline/rotas produtivas nem referencia tabelas/buckets proibidos.

## Issues Encountered

- Nenhum. `npm run typecheck` exit 0; suítes de isolamento/regressão verdes. Nenhuma dependência nova, nenhuma chamada de rede/paga.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Fundação pronta para os planos 02–08: DDL aditivo disponível para o comando de importação (02/03) e para a persistência do preflight; schemas/record fiéis para paridade (04), briefing (05) e compositor/preflight (06); allowlist e gate de fronteira reforçados.
- A prova temporal de produção intocada (`base..HEAD`) e o CHECKPOINT B (UAT manual sem provider) permanecem no Plano 08.

## Self-Check: PASSED

- `supabase/lab/bench-schema.sql` contém `CREATE TABLE IF NOT EXISTS public.lab_bench_store_imports` e as colunas `prompt_approved`/`prompt_base`/`prompt_compiled`/`prompt_blocks`/`composer_version`, com REVERT; `git status --porcelain supabase/migrations` vazio.
- `src/lib/lab/bench/domain/schemas.ts` contém `preserveImageContext`.
- `src/lib/lab/__tests__/lab-isolation.contract.test.ts` contém `forbidden_production_access`.
- `src/lib/ai/__tests__/architecture-guard.test.ts` contém `benchFiles`.
- Commits `41e77945`, `dc91845f`, `a9533e5c` existem no histórico.

---
*Phase: 48.2.3-fidelidade-experimental-bancada*
*Completed: 2026-09-29*
