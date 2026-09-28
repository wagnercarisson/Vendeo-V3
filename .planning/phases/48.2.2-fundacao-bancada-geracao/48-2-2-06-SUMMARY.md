---
phase: 48.2.2
plan: 48-2-2-06
subsystem: lab-bench
tags: [nextjs, typescript, vitest, lab, bench, api, guards, ndjson, multipart, signed-url, cost-estimate]

# Dependency graph
requires:
  - phase: 48.2.2
    plan: 48-2-2-02
    provides: `bench-run-service` (`reserveBenchRun`/`getBenchRunByOperationId`/`setBenchRunInput`/`confirmBenchRun`/`finalizeBenchRun`/`getBenchRun`) e `bench-artifact-service` (`persistBenchArtifact`/`listBenchArtifacts`/`createBenchArtifactSignedUrl`)
  - phase: 48.2.2
    plan: 48-2-2-03
    provides: `listBenchTestStores`/`assertBenchTestStore`, `loadBenchBranding`/`toBenchBrandingSnapshot`, `createBenchBrandingSignedUrlForStore`
  - phase: 48.2.2
    plan: 48-2-2-04
    provides: `listBenchPresets`/`resolveBenchPreset` (4 presets `images` habilitados), `BENCH_REGISTRY_DIMENSIONS`/`DEFAULT_BENCH_CONFIG`/`resolveBenchConfig`
  - phase: 48.2.2
    plan: 48-2-2-05
    provides: `resolveBenchCost`, `createBenchGateway`/`createBenchAdapterRegistry`, `executeBenchRun`
provides:
  - "src/app/api/admin/laboratorio/bancada/stores/route.ts: `GET /stores` (manifesto local + `stores`, somente leitura)"
  - "src/app/api/admin/laboratorio/bancada/branding/route.ts: `GET /branding` (contrato completo, `assertBenchTestStore` antes de ler, assets pelo signer restrito)"
  - "src/app/api/admin/laboratorio/bancada/presets/route.ts: `GET /presets` (habilitados + desabilitados com motivo + dimensões do registry)"
  - "src/app/api/admin/laboratorio/bancada/estimate/route.ts: `GET /estimate` (custo e cobertura pelo resolvedor local da bancada)"
  - "src/app/api/admin/laboratorio/bancada/inputs/route.ts: `POST /inputs` (multipart; cria `draft` idempotente sem slot e persiste entradas com metadados/checksum)"
  - "src/app/api/admin/laboratorio/bancada/runs/route.ts: `POST /runs` (confirmação 422, CAS `draft → pending`, 409/400, stream NDJSON com um terminal)"
  - "src/app/api/admin/laboratorio/bancada/runs/[id]/route.ts: `GET /runs/[id]` (detalhe com evidência e artefatos por URL assinada)"
  - "src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts: 58 testes de contrato da API"
affects: [48.2.2 planos 07-08, 48.2.3]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ordem obrigatória de guards em toda rota da bancada: `await requireAdmin()` → `assertLabEnvironment()` (403 `labEnvironmentDeniedBody`) → acesso; rotas com `storeId` chamam `assertBenchTestStore` antes de qualquer leitura"
    - "Upload ponta a ponta resolvendo a ordem `runId`-antes-do-upload: `POST /inputs` cria o run em `draft` (sem slot), persiste entradas sob `bench/{runId}/inputs/...` e devolve `runId` + metadados; `POST /runs` faz o CAS `draft → pending`"
    - "Stream NDJSON com exatamente um evento terminal, rota como única emissora do terminal (`done`/`error` sanitizado)"
    - "Signers separados: `createBenchBrandingSignedUrl(ForStore)` para branding e `createBenchArtifactSignedUrl` para artefatos — nenhum aceita bucket/path do cliente"

key-files:
  created:
    - src/app/api/admin/laboratorio/bancada/stores/route.ts
    - src/app/api/admin/laboratorio/bancada/branding/route.ts
    - src/app/api/admin/laboratorio/bancada/presets/route.ts
    - src/app/api/admin/laboratorio/bancada/estimate/route.ts
    - src/app/api/admin/laboratorio/bancada/inputs/route.ts
    - src/app/api/admin/laboratorio/bancada/runs/route.ts
    - src/app/api/admin/laboratorio/bancada/runs/[id]/route.ts
    - src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts
  modified: []

key-decisions:
  - "`config` é derivada do registry travado (`DEFAULT_BENCH_CONFIG`) + `modelo`/`qualidade` do preset — `resolveBenchConfig` exige as 8 dimensões, então o objeto é composto explicitamente; `preset.config` nunca é lido"
  - "A confirmação (`POST /runs`) resolve o `draft` por `getBenchRunByOperationId` e **não** cria run; valida `runId`/autoria/estado antes de `setBenchRunInput` + `confirmBenchRun` (CAS adquire o slot)"
  - "As referências de entrada persistidas são convertidas em data URLs (`readBenchInputDataUrls`) restritas ao bucket `lab-artifacts` antes da invocação do modelo — única ponte entre o upload e `executeBenchRun`"
  - "`POST /inputs` rejeita upload sem arquivos antes de reservar (nenhum draft inutilizável) e finaliza o draft como `failed`/`artifact_persistence_failed` em qualquer falha do loop"

patterns-established:
  - "Testes de contrato da API com todos os serviços da bancada mockados: nenhuma chamada de rede e nenhuma chamada paga (`executeBenchRun` é mock)"

requirements-completed: [lab-admin-api, lab-generation-bench, lab-artifacts]

# Metrics
duration: ~40min
completed: 2026-09-28
---

# Phase 48.2.2 Plan 06: API administrativa da bancada Summary

**API administrativa da bancada sob `/api/admin/laboratorio/bancada` com guards na ordem correta (admin → ambiente → manifesto), upload multipart que cria a geração em `draft` e persiste entradas com metadados/checksum sob `bench/{runId}/inputs/...`, execução por CAS `draft → pending` com stream NDJSON de um único terminal, estimativa pelo resolvedor local e detalhe com artefatos por URL assinada — 58 testes de contrato verdes e nenhuma chamada paga.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-09-28T20:20:00Z
- **Completed:** 2026-09-28T21:00:00Z
- **Tasks:** 3/3
- **Files modified:** 8 (8 criados; 0 arquivos produtivos alterados)

## Accomplishments

- **Rotas de leitura** (`stores`, `branding`, `presets`, `estimate`): todas admin-only + fail-closed; `branding`/`estimate` validam o manifesto (`assertBenchTestStore`) **antes** de qualquer leitura; branding serve assets pelo signer restrito (`createBenchBrandingSignedUrlForStore`), nunca pelo signer de artefatos; estimativa usa `resolveBenchCost` (preset completo) e devolve `coverage`/`estimatedUsd` sem bloquear quando o pricing é parcial/ausente.
- **`POST /inputs` (multipart)**: resolve a ordem `runId`-antes-do-upload criando o run em `draft` (`reserveBenchRun`, idempotente por `operationId`, **sem** ocupar o slot global); persiste cada imagem em `lab-artifacts` sob `bench/{runId}/inputs/{index}.{ext}` com MIME validado, dimensões, bytes e checksum; devolve `{ runId, inputs: [{ path, mimeType, width, height, bytes, checksum }] }`. Em falha de persistência, o objeto é removido (rollback do serviço) e o run (draft) é finalizado como `failed`/`artifact_persistence_failed` — sem draft órfão.
- **`POST /runs`**: exige `confirmed: true` (422 `confirmation_required`, antes do parse), valida por `BenchRunInputSchema` (400 com issues), resolve o `draft` existente por `getBenchRunByOperationId` **sem criar run** (400 se ausente/divergente, 403 se autor incorreto, 200 idempotente se terminal, 409 se `pending`/`running`), recusa preset desabilitado (400 `preset_not_enabled`), chama `assertBenchTestStore` antes de ler branding, deriva e fixa a configuração (`setBenchRunInput` em `draft`) e faz o **compare-and-set `draft → pending`** (`confirmBenchRun`, adquire o slot; conflito ⇒ 409). Responde em stream NDJSON com **exatamente um** evento terminal (`done`/`error` sanitizado).
- **`GET /runs/[id]`**: detalhe com configuração, prompt enviado, referências, provider/modelo/protocolo, formato/qualidade, latência, usage, custo com `cost_source`/`cost_rule_version` e `cost_detail` (distinguindo estimado), `technical_validation` e `artifacts[].signedUrl` geradas server-side por `createBenchArtifactSignedUrl`; nenhum secret exposto.
- **Testes**: 58 testes de contrato (403 não-admin/ambiente, 400/409/422, idempotência, stream com um terminal, upload com metadados/checksum, draft sem órfão, `storeId` fora do manifesto, preset desabilitado, ausência de secrets e varredura de fonte da ordem de guards).

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Rotas de leitura (`stores`/`branding`/`presets`/`estimate`)** — `5c3ddb49` (feat)
2. **Task 2: `POST /inputs` (multipart) + `POST /runs` (stream NDJSON)** — `8de4120f` (feat)
3. **Task 3: `GET /runs/[id]` (detalhe + artefatos assinados)** — `e8c2ac44` (feat)
4. **Contrato da API (teste compartilhado das três tasks)** — `ac0b04a4` (test)

**Plan metadata:** `[pending]` (docs: complete plan)

_Nota: o arquivo de teste é compartilhado pelas três tasks (o plano o lista em Task 1/2/3); por isso foi commitado ao final, quando todas as rotas existem e o contrato completo passa. Ver "Deviations"._

## Files Created/Modified

- `src/app/api/admin/laboratorio/bancada/stores/route.ts` — `GET /stores` (manifesto + `stores` local, somente leitura).
- `src/app/api/admin/laboratorio/bancada/branding/route.ts` — `GET /branding` (contrato completo; `assertBenchTestStore` antes de ler; assets pelo signer restrito).
- `src/app/api/admin/laboratorio/bancada/presets/route.ts` — `GET /presets` (presets habilitados/desabilitados com motivo + dimensões do registry).
- `src/app/api/admin/laboratorio/bancada/estimate/route.ts` — `GET /estimate` (custo/cobertura pelo resolvedor local).
- `src/app/api/admin/laboratorio/bancada/inputs/route.ts` — `POST /inputs` (multipart; `draft` idempotente sem slot; entradas com metadados/checksum; finalização em falha).
- `src/app/api/admin/laboratorio/bancada/runs/route.ts` — `POST /runs` (confirmação, resolução do draft, derivação da config, CAS, stream NDJSON).
- `src/app/api/admin/laboratorio/bancada/runs/[id]/route.ts` — `GET /runs/[id]` (detalhe + artefatos assinados).
- `src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts` — 58 testes de contrato.

## Verificação (plan-level)

Reexecutada no encerramento (executor sequencial, árvore principal):

- `npm run typecheck` → **exit 0** (`tsc -p tsconfig.typecheck.json --noEmit`).
- `npm test -- --run src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts` → **1 arquivo / 58 testes verdes**, exit 0.
- Regressão: `npm test -- --run src/lib/lab/__tests__/lab-isolation.contract.test.ts src/lib/ai/__tests__/architecture-guard.test.ts` → **2 arquivos / 31 testes verdes**; `npm test -- --run src/lib/lab/bench src/app/api/admin/laboratorio` → **18 arquivos / 335 testes verdes**.
- `rg -c "requireAdmin" src/app/api/admin/laboratorio/bancada -g "route.ts"` → **2 ocorrências em cada uma das 7 rotas** (import + chamada), com `assertLabEnvironment` sempre depois.
- `rg -c "assertBenchTestStore" .../{branding,estimate,runs}/route.ts` → **3 cada**.
- `rg -c "createBenchBrandingSignedUrl" .../branding/route.ts` → **3** (≥ 1) e `createArtifactSignedUrl` **ausente** da rota de branding (exit 1).

> **Nenhuma chamada paga** foi executada: `executeBenchRun` é mockado e todas as dependências (admin, ambiente, Supabase, serviços da bancada) são fakes/mocks. Nenhum provider foi instanciado, nenhum crédito consumido e nada foi promovido ao remoto.

## Decisions Made

- **Config derivada explicitamente:** `config = resolveBenchConfig({ ...DEFAULT_BENCH_CONFIG, modelo: preset.model, qualidade: preset.quality })` — o registry travado fornece as seis dimensões do primeiro recorte e o preset fornece `modelo`/`qualidade`; `preset.config` nunca é lido.
- **Sem criação de run na confirmação:** `POST /runs` só resolve/valida o `draft` existente (`getBenchRunByOperationId`), fixa a configuração e confirma o CAS — a criação acontece exclusivamente em `POST /inputs`.
- **Signers separados por finalidade:** branding via `createBenchBrandingSignedUrlForStore`, artefatos via `createBenchArtifactSignedUrl`; nenhum aceita bucket/path do cliente.
- **Terminal único no stream:** a rota é a única emissora de `done`/`error`; o erro do serviço é encaminhado já sanitizado e o `catch` emite mensagem fixa ("Execução falhou").

## Deviations from Plan

### Auto-fixed / sequencing adjustments

**1. [Rule 3 - Blocking] `resolveBenchConfig(DEFAULT_BENCH_CONFIG)` é incompatível de tipos**
- **Found during:** Task 2 (`POST /runs`).
- **Issue:** `resolveBenchConfig` exige `BenchDimensions` com as **8** dimensões, mas `DEFAULT_BENCH_CONFIG` (`BenchRecorteConfig`) fornece apenas as **6** governadas pelo registry — a chamada literal `resolveBenchConfig(DEFAULT_BENCH_CONFIG)` não compila.
- **Fix:** composição explícita `{ ...DEFAULT_BENCH_CONFIG, modelo: preset.model, qualidade: preset.quality }`, preservando a intenção do plano (dimensões travadas do primeiro recorte + `modelo`/`qualidade` do preset; `preset.config` nunca é lido).
- **Files modified:** `src/app/api/admin/laboratorio/bancada/runs/route.ts`.
- **Verification:** typecheck exit 0; teste de contrato assere a config derivada e a ausência de leitura de `preset.config`.
- **Committed in:** `8de4120f`.

**2. [Rule 2 - Missing Critical] Ponte entre as referências persistidas e `productImagesDataUrls`**
- **Found during:** Task 2 (`POST /runs`).
- **Issue:** o plano exige registrar `references` como paths `bench/{runId}/inputs/...`, mas `executeBenchRun` (plano 05) recebe `productImagesDataUrls` (data URLs) — sem a conversão, o adapter dedicado falha por ausência da imagem primária.
- **Fix:** `readBenchInputDataUrls(client, references)` baixa cada referência do bucket `lab-artifacts` (paths já validados por `parseBenchRunInput`) e monta data URLs; a leitura é restrita ao bucket do laboratório e nunca ao de campanha.
- **Files modified:** `src/app/api/admin/laboratorio/bancada/runs/route.ts`.
- **Verification:** typecheck exit 0; testes de execução verdes (o download é exercitado no caminho de sucesso).
- **Committed in:** `8de4120f`.

**3. [Rule 2 - Missing Critical] Dimensões das entradas calculadas na rota**
- **Found during:** Task 2 (`POST /inputs`).
- **Issue:** o bloco `<interfaces>` descreve `persistBenchArtifact` calculando dimensões via `sharp`, mas a assinatura real do serviço (plano 02) aceita `width?`/`height?` e **não** as calcula.
- **Fix:** a rota calcula dimensões reutilizando `validateArtifactTechnically` (módulo do laboratório, baseado em `sharp`) e as passa a `persistBenchArtifact`.
- **Files modified:** `src/app/api/admin/laboratorio/bancada/inputs/route.ts`.
- **Verification:** typecheck exit 0; teste de upload assere `width`/`height` no metadado persistido.
- **Committed in:** `8de4120f`.

**4. [Rule 2 - Missing Critical] Upload sem arquivos é recusado antes de reservar**
- **Found during:** Task 2 (`POST /inputs`).
- **Issue:** o plano descreve a reserva antes do loop de arquivos; um upload sem arquivos criaria um `draft` inutilizável (sem referências para executar).
- **Fix:** `POST /inputs` valida `files.length > 0` **antes** de `reserveBenchRun` e responde 400 `invalid_payload` — nenhum draft órfão é criado.
- **Files modified:** `src/app/api/admin/laboratorio/bancada/inputs/route.ts`.
- **Verification:** typecheck exit 0; teste de `operationId` inválido assere ausência de reserva.
- **Committed in:** `8de4120f`.

**5. [Rule 3 - Sequencing] Teste de contrato compartilhado commitado ao final**
- **Found during:** commits atômicos.
- **Issue:** o plano lista o mesmo `bench-api.contract.test.ts` em Task 1/2/3; ele importa dinamicamente as 7 rotas, então não compila/passa antes de todas existirem.
- **Fix:** as rotas foram commitadas por task (4→2→1 arquivo) e o teste compartilhado no commit seguinte, quando o contrato completo passa.
- **Files modified:** n/a (sequência de commits).
- **Verification:** cada commit com typecheck exit 0; o commit do teste com 58 testes verdes.
- **Committed in:** `ac0b04a4`.

**6. [Rule 2 - Missing Critical] Re-assinatura explícita dos assets de branding na rota**
- **Found during:** Task 1 (`GET /branding`).
- **Issue:** a verificação do plano exige `createBenchBrandingSignedUrl` na rota de branding; `loadBenchBranding` já assina internamente, mas o requisito pede o uso explícito do signer restrito no arquivo da rota.
- **Fix:** a rota re-assina cada asset via `createBenchBrandingSignedUrlForStore` (bucket `store-brand-assets`), degradando para a URL do loader em falha — garantindo que nenhum asset seja servido pelo signer de artefatos.
- **Files modified:** `src/app/api/admin/laboratorio/bancada/branding/route.ts`.
- **Verification:** `rg -c "createBenchBrandingSignedUrl"` ≥ 1; `createArtifactSignedUrl` ausente; teste assere a URL do signer restrito.
- **Committed in:** `5c3ddb49`.

---

**Total deviations:** 6 auto-fixed (3 de criticidade/ponte, 1 bloqueio de tipos, 1 sequenciamento de commit, 1 uso explícito do signer).
**Impact on plan:** Sem mudança de escopo de produto; nenhuma dependência nova, nenhum arquivo produtivo alterado e nenhuma chamada paga. As adições tornam a superfície executável ponta a ponta (upload → execução) e verificável.

## Issues Encountered

- **`resolveBenchConfig` x `DEFAULT_BENCH_CONFIG`:** incompatibilidade de tipos entre o registry travado (6 dimensões) e o contrato de resolução (8 dimensões) — resolvida compondo o objeto com `modelo`/`qualidade` do preset (ver Deviation 1).
- **Ponte upload → execução:** o plano não nomeia a conversão de `references` em `productImagesDataUrls`; resolvida com `readBenchInputDataUrls` restrito ao bucket `lab-artifacts` (ver Deviation 2).
- **`persistBenchArtifact` não calcula dimensões:** contrariando a descrição do bloco `<interfaces>`, a rota calcula via `validateArtifactTechnically` (ver Deviation 3).
- **Lint:** `npm run lint` (`eslint .`) não linta arquivos `.ts` neste projeto (flat config sem extensões `.ts`); a validação do plano exige apenas `typecheck` + testes, ambos verdes.
- **Tracking (SDK parcialmente incompatível com o STATE.md compacto):** `state.update-progress` e `roadmap.update-plan-progress 48.2.2` funcionam; os demais handlers `state.*` retornam erro/skip neste projeto. As seções de prosa do `STATE.md` foram atualizadas manualmente (ver SUMMARY de `48-2-2-05`). `requirements.mark-complete` não se aplica (`.planning/REQUIREMENTS.md` é índice operacional sem os REQ-IDs).

## Declaração de custo

**Nenhuma chamada paga a provedor foi executada neste plano.** Nenhum `usage` real, nenhum run em `lab_bench_runs` e nenhuma geração de imagem real. `executeBenchRun` é mockado nos testes e todos os clients/serviços são fakes/mocks em memória. Nenhum crédito de lojista foi consumido e nada foi promovido ao remoto.

## User Setup Required

None — nenhuma configuração de serviço externo. O fluxo efetivo de geração depende da UI (plano 07) e do UAT autorizado (plano 08).

## Next Phase Readiness

- **Plano 07 (UI):** pode consumir as 7 rotas — `GET /stores`, `GET /branding?storeId`, `GET /presets`, `GET /estimate?storeId&presetId`, `POST /inputs` (multipart; campo `files` + `operationId`), `POST /runs` (JSON com `confirmed`/`operationId`/`runId`/`references`) e `GET /runs/[id]`.
- **Plano 08 (UAT):** o caminho upload → confirmação → execução → detalhe está completo na API; o UAT real (chamada paga) permanece condicionado à autorização humana (CP3).
- Produção intocada: nenhum arquivo em `src/lib/ai/adapters/**`, `src/lib/lab/**` produtivo, `prompts/` ou `supabase/migrations/**` foi alterado por este plano.
- Tracking: `requirements.mark-complete` **não** aplicável (índice operacional sem os REQ-IDs `lab-admin-api`/`lab-generation-bench`/`lab-artifacts`); os IDs ficam registrados neste frontmatter.

---

*Phase: 48.2.2-fundacao-bancada-geracao*
*Completed: 2026-09-28*

## Self-Check: PASSED

- Arquivos criados: `stores/route.ts`, `branding/route.ts`, `presets/route.ts`, `estimate/route.ts`, `inputs/route.ts`, `runs/route.ts`, `runs/[id]/route.ts`, `__tests__/bench-api.contract.test.ts` — todos FOUND.
- Commits verificados: `5c3ddb49`, `8de4120f`, `e8c2ac44`, `ac0b04a4` — todos FOUND.
- Verificação: `typecheck` exit 0; 58 testes de contrato verdes; 335 testes de regressão da bancada/API verdes; greps de `requireAdmin`/`assertBenchTestStore`/`createBenchBrandingSignedUrl` conforme o plano.
