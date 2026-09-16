---
phase: 48.1-laboratorio-ia-minimo
plan: 48-1-07
subsystem: lab-ai
tags: [supabase, sharp, rpc, idempotency, snapshot, telemetry, vitest]

# Dependency graph
requires:
  - phase: 48.1-laboratorio-ia-minimo
    provides: cenários controlados com hash canônico (48-1-03), domínio de experimentos prompt-only (48-1-04), harness de gateway isolado com alvo fixo e sink próprio (48-1-05) e persistência de artefatos com rollback (48-1-06)
provides:
  - validação técnica objetiva com sharp (decode, MIME real, dimensões, proporção, bytes, vazia/corrompida/uniforme) sem nota de qualidade
  - snapshot imutável do run montado ANTES da reserva e nunca vazio
  - reserva atômica lab_reserve_run com os 11 códigos de erro e run_sequence derivado no banco
  - transições do run com estado terminal garantido em finally
  - idempotência por operationId e reexecução explícita por supersedes_run_id
  - execução single-shot (exatamente 1 campaign_image por run) com custo de origem completa
  - reconciliação preguiçosa de runs órfãos cobrindo pending E running
affects: [48-1-08, 48-1-09, 48-1-10, 48-1-11, 48-1-12, 48-1-13, 48-1-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reserva atômica antes de qualquer chamada paga: snapshot → lab_reserve_run → markRunRunning → gateway"
    - "Barreira local assertSnapshotComplete impede p_snapshot vazio antes do I/O"
    - "Estado terminal do run garantido em finally (run_aborted) mesmo com falha do catch"
    - "Reconciliação preguiçosa sem scheduler: pending e running órfãos viram failed na leitura"
    - "Falha técnica vira alerta (nunca exceção) na validação objetiva do artefato"
    - "Client Supabase sempre por parâmetro — fakes em memória, nenhuma chamada de rede/paga em testes"

key-files:
  created:
    - src/lib/lab/technical-validation.ts
    - src/lib/lab/run-snapshot.ts
    - src/lib/lab/run-service.ts
    - src/lib/lab/__tests__/technical-validation.test.ts
    - src/lib/lab/__tests__/run-snapshot.test.ts
    - src/lib/lab/__tests__/run-service.test.ts
  modified:
    - src/lib/lab/run-service.ts
    - src/lib/lab/__tests__/run-service.test.ts
    - openspec/changes/fase-48-1-laboratorio-ia-minimo/design.md
    - openspec/changes/fase-48-1-laboratorio-ia-minimo/specs/lab-runs/spec.md
    - .planning/phases/48.1-laboratorio-ia-minimo/48-1-07-PLAN.md

key-decisions:
  - "Validação técnica devolve apenas fatos objetivos e converte toda falha em alerta; structuredOutputValid/ocrAlert permanecem campos reservados null (D9)"
  - "O snapshot entra em p_snapshot na mesma transação da reserva; o serviço nunca grava a coluna snapshot em update (o trigger do banco é o reforço)"
  - "run_sequence é sempre o valor devolvido pela RPC — nenhum cálculo max+1 no cliente (T-48-1-51)"
  - "runReservedLabRun recebe promptLoader e confere que o conteúdo servido bate com o hash do snapshot congelado antes de qualquer chamada paga"
  - "prepareLabRun e runReservedLabRun são separados para a rota 48-1-08 mapear erro de reserva em HTTP antes de abrir o stream NDJSON"
  - "reconcileStaleRuns cobre pending e running (o pending preso também bloqueia o experimento pelo índice único parcial global)"
  - "Correções pós-revisão: mensagem sanitizada uma única vez (banco + evento NDJSON); collectSinkEvidence aplicada também na falha (calls/custo/usage/provider/attempts preservados); transições compare-and-set (pending→running e →terminal exigem exatamente 1 linha afetada); reconciliação conta apenas as linhas alteradas; MIME real derivado dos bytes antes da persistência, com MIME+dimensões numa única operação"

patterns-established:
  - "Caminho de execução em duas fases (reserva → execução) com a chamada paga sempre depois do sucesso da RPC"
  - "Erro de reserva como LabReservationError(code) — a rota decide o status HTTP pelo código"
  - "Persistência de resultado apenas em colunas de resultado do run; erro sempre sanitizado por sanitizeAiErrorMessage"

requirements-completed: [lab-runs]

# Metrics
duration: 10min
completed: 2026-09-16
---

# Phase 48.1 Plan 48-1-07: Execução e Snapshots Imutáveis Summary

**Execução real single-shot do laboratório: validação técnica com `sharp` sem nota de qualidade, snapshot imutável gravado na reserva atômica `lab_reserve_run` (11 códigos de erro, `run_sequence` derivado no banco), exatamente 1 chamada `campaign_image` por run com estado terminal garantido em `finally` e reconciliação preguiçosa de órfãos em `pending` e `running`.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-16T16:09:13Z
- **Completed:** 2026-09-16T16:19:38Z
- **Tasks:** 3
- **Files modified:** 6 (todos criados)

## Accomplishments

- **Validação técnica objetiva (`sharp`)** com decodificação, MIME real, dimensões, proporção, bytes e detecção de imagem vazia/corrompida/uniforme (desvio-padrão por canal abaixo do limiar documentado). Nenhuma nota de qualidade: `structuredOutputValid`/`ocrAlert` são sempre `null` e o módulo não tem nenhum caminho que lance exceção.
- **Snapshot imutável antes da reserva**: `buildLabRunSnapshot` congela cenário (id/versão/hash), prompt (nome/conteúdo/hash/origem), capability, alvo de modelo, params, `changedDimension: "prompt"`, papel da variante, `codeVersion` e `runType: "lab"`; `assertSnapshotComplete` bloqueia qualquer snapshot incompleto antes do I/O e nenhum base64/imagem entra no objeto.
- **Reserva atômica antes de qualquer chamada paga**: `reserveLabRun` chama `lab_reserve_run` com os 8 parâmetros `p_*`, mapeia os 11 códigos de erro para `LabReservationError(code)` e usa exclusivamente o `run_sequence` devolvido pela RPC.
- **Transições e terminal garantido**: `markRunRunning`/`finalizeLabRun` gravam apenas colunas de resultado (nunca `snapshot`), com `errorMessage` sempre sanitizado; o `finally` de `runReservedLabRun` fecha o run como `failed`/`run_aborted` quando o caminho de erro não conseguiu finalizar.
- **Exatamente 1 chamada paga por run**: `runReservedLabRun` invoca `runLabCampaignImage` uma única vez (sem alvo alternativo, sem fallback), persiste o artefato com rollback do 48-1-06, roda a validação técnica, atualiza as dimensões do artefato e congela custo (`estimatedCostUsd` + `cost_detail` com a `CostResolution` real completa) e `calls[]` sanitizado.
- **Idempotência e reexecução**: reserva idempotente devolve o run existente e `executeLabRun` retorna `pending` sem executar nada; a reexecução explícita passa `supersedes_run_id` validado pelo banco.
- **Reconciliação de órfãos**: `reconcileStaleRuns` marca `pending` **e** `running` anteriores a `LAB_RUN_STALE_MS` como `failed`/`orphan_run_timeout`, sem scheduler, ignorando runs recentes e terminais.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Validação técnica objetiva com sharp** - `b627c3a5` (feat)
2. **Task 2: Snapshot imutável + reserva atômica + transições + reconciliação** - `c797164a` (feat)
3. **Task 3: executeLabRun — reserva antes da chamada paga, 1 envelope por run e terminal em finally** - `4a29b053` (feat)

**Plan metadata:** `docs(48-1-07)` (SUMMARY + STATE + ROADMAP)

## Files Created/Modified

- `src/lib/lab/technical-validation.ts` - Validação objetiva com `sharp` (decode, MIME real, dimensões, proporção, bytes, uniformidade) e alertas em vez de exceções
- `src/lib/lab/run-snapshot.ts` - `buildLabRunSnapshot`, `assertSnapshotComplete`, `readCodeVersion`
- `src/lib/lab/run-service.ts` - `LabReservationError`, `reserveLabRun`, `markRunRunning`, `finalizeLabRun`, `reconcileStaleRuns`, `isRunTerminal`, `prepareLabRun`, `runReservedLabRun`, `executeLabRun`, `LabRunEvent`
- `src/lib/lab/__tests__/technical-validation.test.ts` - 11 testes (válida, uniforme, ruidosa, corrompida, vazia, proporção, MIME, campos reservados, ausência de chave de nota)
- `src/lib/lab/__tests__/run-snapshot.test.ts` - 15 testes (congelamento, barreira, ausência de base64, `readCodeVersion`)
- `src/lib/lab/__tests__/run-service.test.ts` - 41 testes (reserva, 11 códigos, transições, reconciliação, caminho feliz, 5 caminhos de falha, composição)

## Decisions Made

- **Validação técnica só com fatos objetivos**: toda falha vira alerta e o módulo não interrompe o run; `structuredOutputValid`/`ocrAlert` ficam reservados como `null` (D9).
- **Snapshot antes da reserva, `update` nunca toca `snapshot`**: a coluna é definida exclusivamente por `p_snapshot` na transação da reserva; o trigger de banco é o reforço.
- **`run_sequence` sempre do banco**: nenhum cálculo de sequência no cliente (T-48-1-51).
- **`promptLoader` verificado contra o snapshot**: `runReservedLabRun` confere que o conteúdo servido em memória tem o mesmo hash do snapshot congelado (`prompt_snapshot_mismatch`) antes de qualquer chamada paga — fecha o ciclo do T-48-1-57.
- **`prepareLabRun` separado de `runReservedLabRun`**: permite à rota 48-1-08 mapear erro de reserva em HTTP antes de abrir o stream NDJSON.
- **Reconciliação cobre `pending` e `running`**: um `pending` preso também bloqueia o experimento pelo índice único parcial global (D14).

## Deviations from Plan

### Ajustes menores (sem mudança de escopo)

**1. [Rule 3 - Blocking] Guarda de coerência entre `scenario.id` e `scenarioVersionId` em `prepareLabRun`**
- **Found during:** Task 3 (`prepareLabRun`)
- **Issue:** o plano especifica simultaneamente `scenarioVersionId` (usado na RPC) e `scenario.id` (usado no snapshot). Se divergissem, o snapshot congelaria um cenário diferente do reservado.
- **Fix:** comparação explícita dos dois valores, recusando com `lab_run_scenario_mismatch` antes do I/O (nenhum campo do plano foi removido).
- **Files modified:** `src/lib/lab/run-service.ts`
- **Verification:** teste "recusa cenário divergente do reservado antes de qualquer I/O" (0 chamadas de RPC)
- **Committed in:** `4a29b053`

**2. [Rule 3 - Blocking] MIME do artefato normalizado para a allowlist do bucket**
- **Found during:** Task 3 (`runReservedLabRun`)
- **Issue:** `AiInvocationResult.mimeType` é `string | undefined`, mas `persistOutputArtifact` exige `"image/png" | "image/jpeg" | "image/webp"` (allowlist do bucket `lab-artifacts`).
- **Fix:** `resolveArtifactMimeType` usa o MIME declarado quando ele está na allowlist e cai para `image/png` caso contrário; a divergência real continua registrada pela validação técnica (alerta `mime_mismatch`).
- **Files modified:** `src/lib/lab/run-service.ts`
- **Verification:** teste do caminho feliz (`mimeType: "image/png"` → `technical_validation.mimeType === "image/png"`)
- **Committed in:** `4a29b053`

**3. [Rule 1 - Bug] Assinatura de `sanitizeAiErrorMessage` com `errorMessage` possivelmente `null`**
- **Found during:** Task 2 (`finalizeLabRun`)
- **Issue:** o typecheck reprovou a passagem de `string | null` para uma função que exige `string`.
- **Fix:** guarda adicional `params.errorMessage !== null` antes de sanitizar.
- **Files modified:** `src/lib/lab/run-service.ts`
- **Verification:** `npx tsc -p tsconfig.typecheck.json --noEmit` → exit 0
- **Committed in:** `c797164a`

---

**Total de desvios:** 3 auto-corrigidos (2 bloqueios de tipo/coerência, 1 bug de tipo) + 1 ajuste de teste (expectativa de janela do `staleMs`).
**Impacto no plano:** nenhum escopo adicional; os três ajustes são necessários para correção/segurança e mantêm o contrato externo intacto.

## Corrections Applied After Review (1 CRITICAL + 2 HIGH + 1 WARNING)

### CRITICAL — segredo podia vazar no stream NDJSON

`normalizeExecutionError` devolvia a mensagem bruta; ela era sanitizada ao persistir, mas o evento `error` era emitido com a mensagem **original**. Um erro com `Bearer sk-…` não entrava no banco, porém apareceria no stream administrativo do 48-1-08. **Fix:** sanitização **única na origem** (`safeMessage = sanitizeAiErrorMessage(message)`) — a mesma string segura vai para o banco e para o evento.

### HIGH — falhas perdiam custo e envelopes reais

O `catch` gravava apenas status/erro; `calls=[]`, custo ausente e sem provider/modelo, mesmo quando houve chamada paga. **Fix:** helper `collectSinkEvidence(sink)` aplicado **tanto no sucesso quanto na falha** — `calls`, `usage`, `cost_detail`, `estimated_cost_usd`, `provider`/`model`/`protocol` e `attempts` (e `technical_validation` quando já calculada). `attempts` só é sobrescrito quando houve chamada real.

### HIGH — transições não eram atômicas

`markRunRunning`/`finalizeLabRun` filtravam só por `id` e a reconciliação fazia select-then-update sem CAS. **Fix:** transições **compare-and-set** (`markRunRunning`: `id` + `status='pending'`; `finalizeLabRun`: `id` + `status IN ('pending','running')`) com `.select("id")` exigindo exatamente 1 linha afetada; a reconciliação reaplica `status IN ('pending','running')` no próprio update e conta **apenas as linhas alteradas** (`reconciled = retorno.length`).

### WARNING — MIME e dimensões podiam ficar incorretos

`resolveArtifactMimeType` defaultava para PNG e o erro do update de dimensões era ignorado. **Fix:** a validação técnica roda **antes** da persistência; o MIME é derivado dos **bytes** (`resolveArtifactMimeType(validation)`) e restrito à allowlist — fora dela/indecodificável → `unsupported_artifact_mime_type` sem persistir; MIME + dimensões entram numa **única** operação de persistência (sem update separado). A ordem das fases passou a ser `validation → artifact`.

**Testes adicionados (+8):** evento `error` sanitizado (sem token/URL); evidência preservada nas 3 falhas (provider, imagem ausente, artefato) com `calls`/custo/usage/provider/attempts; MIME real fora da allowlist → `unsupported_artifact_mime_type` com zero `persistOutputArtifact`; CAS de `markRunRunning` e `finalizeLabRun` (0 linhas → `lab_run_transition_failed`); reconciliação contando apenas as linhas alteradas; persistência com MIME+dimensões numa única chamada (sem update de `lab_artifacts`).

**Source-of-truth sincronizada:** `design.md` (D14 — CAS, evidência na falha, MIME real, stream sanitizado), `specs/lab-runs/spec.md` (+4 cenários) e `48-1-07-PLAN.md` (Task 2/3, testes, T-48-1-58..61).

**Verification:** `npx vitest run src/lib/lab src/lib/ai src/lib/image-generation` → exit 0 (**793 testes**, +8); `npx tsc -p tsconfig.typecheck.json --noEmit` → exit 0; `npm.cmd run lint` → exit 0.

## Issues Encountered

- A expectativa inicial do teste de `staleMs` customizado estava invertida (janela menor tornava o run elegível); corrigida para uma janela maior que prova o respeito ao parâmetro.

## User Setup Required

None - nenhuma configuração externa. `sharp` já é dependência existente (nenhum pacote novo) e a migration do laboratório permanece **local** (o push remoto deliberado é a última task do 48-1-14).

## Next Phase Readiness

- Pronto para **48-1-08** (API administrativa sob `/api/admin/laboratorio`): `prepareLabRun`/`runReservedLabRun` já separam reserva de execução para mapear erro em HTTP antes do stream NDJSON, e `LabRunEvent` é o contrato de fase do stream.
- Pronto para **48-1-09/48-1-10** (UI e comparação): `reconcileStaleRuns` é a chamada de leitura para destravar runs órfãos e `finalizeLabRun` já persiste todas as evidências exibidas.
- Nenhum bloqueio. Sem alteração em `src/lib/ai/gateway.ts`, `src/lib/ai-cost/**`, `src/lib/campaign/**`, `prompts/**` ou migrations.

## Verification Evidence

| Gate | Comando | Resultado |
|------|---------|-----------|
| Laboratório | `npx vitest run src/lib/lab` | 17 files / 313 passed + 1 skipped, exit 0 |
| Gateway/pipeline intactos | `npx vitest run src/lib/ai src/lib/image-generation` | 31 files / 472 passed, exit 0 |
| Typecheck | `npx tsc -p tsconfig.typecheck.json --noEmit` | exit 0 |
| Lint | `npm.cmd run lint` | exit 0 |
| Prompts intactos | `git status --porcelain prompts/` | vazio |
| Tokens proibidos | grep em `run-service.ts`/`run-snapshot.ts`/`technical-validation.ts` | 0 ocorrências |
| Nota de qualidade | grep em `technical-validation.ts` (`score\|rating\|beauty\|publishable`) | 0 ocorrências |
| `throw ` em `technical-validation.ts` | grep | 0 ocorrências |
| Chamada única | `runLabCampaignImage\(` em `run-service.ts` | 1 ocorrência |

Invariantes provadas por teste: 0 invocações no caminho idempotente e no erro de reserva (`budget_exceeded`); 1 invocação no caminho feliz e no erro do provider (1 envelope no sink); estado terminal garantido no `finally` quando a transição do `catch` falha; `run_sequence: 7` vem da RPC e nunca é enviado pelo cliente.

## Self-Check: PASSED

- [x] `src/lib/lab/technical-validation.ts` — FOUND
- [x] `src/lib/lab/run-snapshot.ts` — FOUND
- [x] `src/lib/lab/run-service.ts` — FOUND
- [x] `src/lib/lab/__tests__/technical-validation.test.ts` — FOUND
- [x] `src/lib/lab/__tests__/run-snapshot.test.ts` — FOUND
- [x] `src/lib/lab/__tests__/run-service.test.ts` — FOUND
- [x] Commit `b627c3a5` — FOUND
- [x] Commit `c797164a` — FOUND
- [x] Commit `4a29b053` — FOUND

---
*Phase: 48.1-laboratorio-ia-minimo*
*Completed: 2026-09-16*
