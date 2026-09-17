---
phase: 48.1-laboratorio-ia-minimo
plan: 48-1-12
subsystem: testing
tags: [vitest, lab, gateway-harness, snapshots, artifacts, admin-api, admin-ui, contrato, determinismo]

requires:
  - phase: 48-1-05
    provides: harness de gateway (LabModelResolver/LabPromptLoader/runtime) + LabTelemetrySink (custo em leitura)
  - phase: 48-1-06
    provides: bucket lab-artifacts + persistOutputArtifact (rollback/checksum) + cleanup manual opt-in
  - phase: 48-1-07
    provides: run-service (reserva atomica, snapshot imutavel, reconciliacao) + technical-validation
  - phase: 48-1-08
    provides: API admin sob /api/admin/laboratorio (403/400/409/422, NDJSON, avaliacao)
  - phase: 48-1-09
    provides: UI do laboratorio (inicial, criacao, detalhe, execucao, cenarios)
  - phase: 48-1-10
    provides: comparacao lado a lado + modo cego + avaliacao humana append-only

provides:
  - "Contrato do harness: precedencia absoluta do alvo fixo, delegacao read-only fora do escopo e ausencia de ai_model_selection"
  - "Contrato do harness: override de prompt apenas em memoria (prompts/ byte a byte identico) e sink sem generation_events"
  - "Contrato do harness: exatamente 1 envelope campaign_image por run, sem OpenAIImageProvider e sem campaign_image_edit"
  - "Contrato de execucao: snapshot completo/imutavel, terminal em finally, idempotencia vinculada ao payload, reexecucao com run_sequence derivado e orfaos pending/running"
  - "Contrato de custo e validacao tecnica: origem completa (complete/partial/missing) e nenhuma nota de qualidade"
  - "Contrato de artefatos: bucket/path proprios, metadados + checksum SHA-256, rollback sem orfao, URL assinada 3600s e cleanup manual protegendo run em andamento"
  - "Contrato HTTP da API admin: 403/400/409/422/404 mapeados, execucao NDJSON confirmada, idempotencia sem stream e nenhum secret na resposta"
  - "Contrato de UI: inicial/vazio, estado desabilitado sem acesso a dados, criacao prompt-only, confirmacao com estimativa, comparacao com modo cego, avaliacao/reavaliacao append-only, acessibilidade basica"
  - "Ponte D17: snapshot congelado convertido em caso deterministico com fakes, sem chamada paga e sem depender de imagem gerada"

affects:
  - 48-1-13
  - 48-1-14

tech-stack:
  added: []
  patterns:
    - "Client fake com regras de banco: RPC de reserva simulada (idempotencia por payload, run_sequence derivado, supersedes) + trigger de imutabilidade de snapshot no update"
    - "Acesso registrado (accessLog) para provar ausencia de escrita produtiva (generation_events, ai_model_catalog, lab_artifacts)"
    - "Regra de vocabulario proibido escrita apenas dentro da propria assercao negativa (not.toMatch) para o criterio grep-based"
    - "Snapshot congelado como fixture inline: prompt montado pelo caminho real + envelope simulado por AiInvoker fake"

key-files:
  created:
    - src/lib/lab/gateway/__tests__/lab-gateway-harness.contract.test.ts
    - src/lib/lab/__tests__/lab-runs.contract.test.ts
    - src/lib/lab/persistence/__tests__/lab-artifacts.contract.test.ts
    - src/app/api/admin/laboratorio/__tests__/lab-admin-api.contract.test.ts
    - src/app/(app)/admin/laboratorio/_components/__tests__/lab-admin-ui.contract.test.tsx
    - src/lib/lab/__tests__/snapshot-fixtures.contract.test.ts
  modified: []

key-decisions:
  - "LAB_RUN_STALE_MS e importado de `src/lib/lab/limits.ts` (fonte unica) — `run-service` nao reexporta a constante"
  - "A RPC fake do client de execucao espelha a semantica real (idempotencia apos o lock, unique_violation tratado como idempotente quando o payload coincide) em vez de reimplementar o servico"
  - "O caso de validacao tecnica sem alerta usa buffer raw com variacao de pixels (uma cor solida e legitimamente uniform_image)"
  - "A pagina inicial (server component async) e renderizada com `render(await LaboratorioPage())` e os modulos de leitura/guarda mockados"
  - "A conversao do snapshot em caso deterministico nao le nenhum artefato de lab-artifacts/output.*: a fixture e inline e o ambiente roda sem OPENAI_API_KEY/GEMINI_API_KEY"

patterns-established:
  - "Suites de contrato do laboratorio cobrem o transversal (precedencia, 1 envelope, terminal, rollback, mapeamento HTTP) enquanto as unitarias dos planos 48-1-05..48-1-10 cobrem o detalhe"
  - "Nenhuma chamada paga/rede: in-memory fakes, AiInvoker fake, resolveAiCost/AiCostTracker mockados e sharp gerando buffers localmente"

requirements-completed: [lab-gateway-harness, lab-runs, lab-artifacts, lab-admin-api, lab-admin-ui, lab-human-evaluation]

duration: 12min
completed: 2026-09-17
---

# Phase 48.1 Plan 48-1-12: Suíte de Contrato nº 2 — Harness, Execução, Artefatos, API, UI e Snapshots como Fixtures Summary

**6 suítes de contrato (142 testes novos) travando alvo fixo com precedência e exatamente 1 envelope por run, snapshot imutável com terminal em `finally` e reconciliação de órfãos, rollback de artefato sem órfão com URL assinada de 3600s, mapeamento HTTP 403/400/409/422/404 e a conversão de snapshot congelado em caso determinístico sem chamada paga.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-16T23:57:48Z
- **Completed:** 2026-09-17T00:10:12Z
- **Tasks:** 4
- **Files modified:** 6 (todos criados; nenhum arquivo de produção alterado)

## Accomplishments

- **Harness de gateway (16 testes):** alvo fixo com precedência sobre o resolver padrão, delegação read-only fora do escopo, ausência de `ai_model_selection`, override de prompt só em memória (arquivo oficial idêntico por hash), `LabTelemetrySink` calculando custo em leitura sem `generation_events`/tracker, exatamente 1 invocação de `campaign_image` e 0 de `campaign_image_edit` (sucesso e falha), pipeline de produção intacto e catálogo usado apenas como allowlist de leitura.
- **Execução e snapshot (37 testes):** `p_snapshot` completo e nunca vazio; transição terminal garantida em falha, desconexão do consumidor e CAS-miss do `catch` (fallback no `finally`); idempotência vinculada ao payload (incluindo a corrida de `unique_violation`); reexecução com `run_sequence` derivado e run anterior intacto; reconciliação preguiçosa de `pending` **e** `running` após `LAB_RUN_STALE_MS`; custo com origem completa e validação técnica apenas objetiva.
- **Artefatos + API (11 + 50 testes):** bucket/path próprios, metadados + checksum SHA-256 de 64 hex, rollback sem órfão, URL assinada com TTL exato de 3600s, cleanup manual que nunca remove run em andamento e reporta path incoerente como `invalid`; API com 403 (não-admin e ambiente bloqueado), 400, 409, 422 e 404 mapeados, execução NDJSON confirmada com 1 terminal, idempotência em JSON sem stream, avaliação validada e nenhum secret nos corpos.
- **UI + D17 (20 + 8 testes):** página inicial com estado vazio, estado desabilitado sem acesso a dados, criação prompt-only com modelo fixo e limites travados, confirmação com estimativa por componente e progresso NDJSON, comparação com modo cego e troca de repetição, avaliação/reavaliação append-only, alvos ≥44px, ausência de emoji e **zero nota automática**; snapshot congelado convertido em caso determinístico com fakes, sem chave de provider e sem artefato gerado.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Contrato do harness de gateway** - `d1992610` (test)
2. **Task 2: Contrato de execução e snapshot imutável** - `34fadf8f` (test)
3. **Task 3: Contrato de artefatos + contrato HTTP da API** - `9df9fb05` (test)
4. **Task 4: Contrato de UI + snapshots como fixture determinística** - `c79a700b` (test)

**Plan metadata:** `(este commit)` (docs: complete plan)

## Files Created/Modified

- `src/lib/lab/gateway/__tests__/lab-gateway-harness.contract.test.ts` — alvo fixo/delegação, override em memória, sink sem eventos, 1 envelope, pipeline intacto, catálogo read-only
- `src/lib/lab/__tests__/lab-runs.contract.test.ts` — snapshot imutável, terminal em `finally`, idempotência/reexecução, órfãos, custo e validação técnica
- `src/lib/lab/persistence/__tests__/lab-artifacts.contract.test.ts` — bucket/path, checksum, rollback, URL assinada 3600s e cleanup manual
- `src/app/api/admin/laboratorio/__tests__/lab-admin-api.contract.test.ts` — contrato HTTP completo das 7 rotas (8 call sites)
- `src/app/(app)/admin/laboratorio/_components/__tests__/lab-admin-ui.contract.test.tsx` — página inicial, desabilitado, criação, execução, comparação, avaliação, a11y
- `src/lib/lab/__tests__/snapshot-fixtures.contract.test.ts` — snapshot congelado → caso determinístico com fakes (D17)

## Decisions Made

- `LAB_RUN_STALE_MS` é importado de `src/lib/lab/limits.ts` (fonte única do limite) — `run-service` não reexporta a constante, e o import via `run-service` resolve `undefined` no transform do vitest.
- A RPC fake espelha a semântica real do banco (idempotência após o lock; `unique_violation` devolvendo idempotente quando o payload coincide) em vez de reimplementar o serviço — o contrato exercita o serviço, não o fake.
- A página inicial é um server component async e é exercitada com `render(await LaboratorioPage())` e módulos de leitura/guarda mockados.
- O caso "PNG válido sem alerta" usa buffer raw com variação de pixels, pois uma cor sólida é legitimamente `uniform_image`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `LAB_RUN_STALE_MS` importado de `../limits` em vez de `../run-service`**
- **Found during:** Task 2 (contrato de execução)
- **Issue:** `run-service.ts` importa `LAB_RUN_STALE_MS` de `./limits` para uso interno e **não** o reexporta; o import nomeado a partir de `../run-service` resolvia `undefined` (a suíte falhava na coleta com `RangeError: Invalid time value`).
- **Fix:** importar a constante de `src/lib/lab/limits.ts` — a fonte única já indicada no `<read_first>` do plano.
- **Files modified:** `src/lib/lab/__tests__/lab-runs.contract.test.ts`
- **Verification:** suíte verde (37 testes) e `npx vitest run src/lib/lab` verde.
- **Committed in:** `34fadf8f`

**2. [Rule 1 - Bug] Fixture de validação técnica usava PNG de cor sólida**
- **Found during:** Task 2 (validação técnica objetiva)
- **Issue:** o caso "PNG válido sem alerta" gerava um PNG de cor única, que o `sharp` corretamente classifica como `uniform_image` — a asserção de `alerts: []` era falsa por mérito do código de produção.
- **Fix:** gerar um buffer raw 8×8 com variação de pixels (PNG não uniforme).
- **Files modified:** `src/lib/lab/__tests__/lab-runs.contract.test.ts`
- **Verification:** `decodable: true`, `uniform: false`, `alerts: []`.
- **Committed in:** `34fadf8f`

**3. [Rule 3 - Blocking] Critério grep-based do vocabulário proibido na UI**
- **Found during:** Task 4 (contrato de UI)
- **Issue:** a primeira versão declarava uma constante com o vocabulário proibido em linha própria, o que violaria literalmente o critério "aparece **apenas** em asserção negativa".
- **Fix:** o regex passou a ser escrito inline na própria linha do `not.toMatch(...)`, de modo que toda linha que casa o grep é uma asserção negativa.
- **Files modified:** `src/app/(app)/admin/laboratorio/_components/__tests__/lab-admin-ui.contract.test.tsx`
- **Verification:** `Select-String` para `score|rating|publicável|ranking|percentual` retorna 3 linhas, todas com `not.toMatch`.
- **Committed in:** `c79a700b`

---

**Total deviations:** 3 auto-fixed (2 bloqueantes de teste, 1 correção de fixture)
**Impact on plan:** Todas as correções são de autoria de teste (nenhuma alteração em produção). Sem scope creep.

## Issues Encountered

- O import do script de cleanup (`.mjs`) a partir de um teste `.ts` funciona porque o projeto tem `allowJs: true`; nenhuma declaração de tipo nova foi necessária.
- Estabilidade: as 6 suítes novas foram executadas 3 vezes consecutivas — 142/142 verdes em todas as execuções (sem flakiness observada).

## User Setup Required

None - no external service configuration required. Nenhuma chamada paga ou de rede: fakes em memória, `resolveAiCost`/`AiCostTracker` mockados e `sharp` gerando buffers localmente.

## Next Phase Readiness

- Suíte de contrato nº 2 concluída: os contratos transversais do laboratório (harness, execução/snapshot, artefatos, API, UI e D17) estão travados por teste.
- 4 gates verdes: `vitest` (lab/api/ui — 42 arquivos / 750 testes; image-generation-service 47 testes), `tsc --noEmit` e `eslint`.
- 8 arquivos `lab-*.contract.test.ts` sob `src/lib/lab` (3 deste plano + 5 do 48-1-11); `snapshot-fixtures.contract.test.ts` e as suítes de API/UI vivem fora desse filtro.
- Nenhuma superfície produtiva alterada (`git status --porcelain` vazio para `src/lib/ai/gateway.ts`, `src/lib/ai-cost`, `src/lib/campaign`, `src/lib/image-generation/providers`, `prompts/`, `supabase/`).
- Pronto para o 48-1-13 (regressão e co-migração de fixtures).

---
*Phase: 48.1-laboratorio-ia-minimo*
*Completed: 2026-09-17*

## Self-Check: PASSED

- Todos os 6 arquivos criados existem em disco.
- Todos os 4 commits de task existem no histórico (`d1992610`, `34fadf8f`, `9df9fb05`, `c79a700b`).
- 4 gates verdes: `vitest` (42 arquivos / 750 testes; image-generation-service 47 testes), `tsc -p tsconfig.typecheck.json --noEmit`, `npm.cmd run lint`.
- 8 arquivos `lab-*.contract.test.ts` sob `src/lib/lab`; nenhuma superfície produtiva alterada.

