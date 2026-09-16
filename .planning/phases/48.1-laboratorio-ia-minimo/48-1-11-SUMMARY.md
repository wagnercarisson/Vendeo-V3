---
phase: 48.1-laboratorio-ia-minimo
plan: 48-1-11
subsystem: testing
tags: [vitest, lab, environment-guard, isolation, financial-safety, scenarios, experiments, contrato]

requires:
  - phase: 48-1-02
    provides: environment-guard fail-closed (5 motivos) + 7 constantes de limite travadas
  - phase: 48-1-03
    provides: cenarios versionados (schema/hash/bootstrap/mapper) + fixtures controladas
  - phase: 48-1-04
    provides: dominio de experimentos prompt-only (schemas, variantes, transicoes, congelamento)
  - phase: 48-1-05
    provides: harness de gateway isolado + LabTelemetrySink (custo em leitura)
  - phase: 48-1-06
    provides: bucket lab-artifacts + persistencia de artefatos
  - phase: 48-1-07
    provides: run-service (reserva atomica, snapshot, reconciliacao) + technical-validation
  - phase: 48-1-08
    provides: API admin + LabRunExecuteRequestSchema (confirmed literal) + run-execution

provides:
  - "Matriz exaustiva dos 5 motivos da guarda de ambiente + precedencia do bloqueio de producao sobre a allowlist"
  - "Client gravador (Proxy) com allowlist lab_* + lab-artifacts que faz o teste falhar em qualquer alvo produtivo"
  - "Prova executavel de isolamento: sem creditos, sem generation_events, sem escrita em ai_model_catalog/campaign-images e sem secrets persistidos"
  - "Contrato de seguranca financeira: confirmacao, reserva antes do gasto, budget, concorrencia global e idempotencia sem chamada paga"
  - "Contrato de cenarios: hash canonico, bootstrap idempotente/versionado e recusas antes do run"
  - "Contrato do dominio de experimentos: dimensao prompt unica, alvo fixo validado em leitura, congelamento e limites"
  - "Higiene da suite do laboratorio (sem SDK/wire de provider e sem leitura de imagem gerada)"

affects:
  - 48-1-12
  - 48-1-13
  - 48-1-14

tech-stack:
  added: []
  patterns:
    - "Client gravador: Proxy sobre client fake em memoria com allowlist e forbidden_production_access:<alvo>"
    - "RPC fake espelhando a semantica real (reserva, concorrencia global, budget, idempotencia vinculada ao payload)"
    - "Varredura de higiene de testes por fs + stripComments com carve-out da propria assercao negativa"

key-files:
  created:
    - src/lib/lab/__tests__/lab-environment-guard.contract.test.ts
    - src/lib/lab/__tests__/lab-isolation.contract.test.ts
    - src/lib/lab/__tests__/lab-financial-safety.contract.test.ts
    - src/lib/lab/scenarios/__tests__/lab-scenarios.contract.test.ts
    - src/lib/lab/domain/__tests__/lab-experiments.contract.test.ts
  modified: []

key-decisions:
  - "A mensagem de LabEnvironmentError nao contem o literal do `reason`; a assercao usa um marcador textual distintivo por motivo (VENDEO_LAB_ENABLED/NEXT_PUBLIC_SUPABASE_URL/host/producao) mantendo `.reason` exato"
  - "A matriz da guarda exercita a allowlist como host de desenvolvimento (db.exemplo.com) e nunca como caminho para producao — o bloqueio *.supabase.* e avaliado antes"
  - "O client gravador lanca em `from(table)`/`rpc`/`storage.from(bucket)` (nao em cada metodo do builder) e no write de ai_model_catalog, o que mantem o detector simples e cobre os alvos reais"
  - "A idempotencia da suite financeira e provada com executeLabRun (composicao real): reserva idempotente devolve `pending` sem tocar o gateway"
  - "A varredura de higiene exclui o proprio arquivo detector (SELF) — o literal da assercao negativa nao pode contar como violacao"
  - "Nenhum teste novo toca producao: persistOutputArtifact real com storage fake, resolveAiCost e AiCostTracker mockados e AiInvoker fake"

patterns-established:
  - "Contrato transversal em vez de caso felizes unitario: matrizes, precedencias e invariantes que falham se a fronteira for cruzada"
  - "Assercao negativa que valida o proprio detector (o teste falha se o detector nao falhar)"

requirements-completed: [lab-isolation, lab-scenarios, lab-experiments]

duration: 16 min
completed: 2026-09-16
---

# Phase 48.1 Plan 48-1-11: Suite de Contrato nº 1 do Laboratorio de IA Summary

**Cinco suites de contrato do laboratorio provando por teste — e nao por inspecao — que a superficie e local-only, que um run toca somente `lab_*` + `lab-artifacts`, que cenarios e experimentos sao deterministicos/congelados e que nenhuma chamada paga ocorre sem confirmacao, reserva atomica e budget disponivel.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-09-16T23:30:00Z
- **Completed:** 2026-09-16T23:46:00Z
- **Tasks:** 3
- **Files modified:** 5 (todos criados; nenhum fonte de producao alterado)

## Accomplishments

- **Guarda de ambiente exaustiva** (53 testes): matriz unica cobrindo os 5 `reason`, comparacao estrita da flag (`"1"`/`"TRUE"`/`" true "` recusam), URL ausente/vazia/nao parseavel/relativa, 4 hosts locais, `*.supabase.co|.in|.com` bloqueados **mesmo com allowlist**, allowlist CSV com espacos/vazios, superficie exposta apenas como hostname (lowercase, sem colchetes), mensagem sem `sk-`/`AIza`/`apikey`/query/fragmento e decisao sem `NODE_ENV`/`VERCEL_ENV`.
- **Isolamento absoluto da producao** (7 testes): client gravador que registra `from(table)`/`storage.from(bucket)`/`rpc(name)` e **lanca** `forbidden_production_access:<alvo>`; criacao real via RPC `lab_create_experiment` + preparacao + run completo com gateway/sink fake provam que so `lab_*` + `lab-artifacts` sao tocados, que nao ha credito, `generation_events`, escrita em `ai_model_catalog`, `campaign-images` nem secret persistido — e o proprio detector tem assercao negativa.
- **Seguranca financeira** (25 testes): `confirmed: true` literal no contrato; recusa de reserva (`budget_exceeded`/`run_already_active`/`experiment_not_ready`/`invalid_supersedes_run`) sem nenhuma invocacao; budget no teto (incl. `MAX_RUNS_PER_EXPERIMENT`) sem ultrapassar o limite; concorrencia **global** (`pending`/`running` em outro experimento); idempotencia vinculada ao payload (`idempotent: true` sem executar vs `idempotency_conflict`); exatamente **uma** invocacao `campaign_image` por run, com fallback desabilitado.
- **Contrato de cenarios** (24 testes): corpus exato de 3 slugs (offer/1:1/pt-BR, ficticios, 1 primary), hash SHA-256 canonico/deterministico (ordem de chaves irrelevante), bootstrap idempotente com nova versao apenas quando o hash muda e acesso confinado a `lab_scenarios`/`lab_scenario_versions`, modalidade nao suportada e imagem ausente recusadas antes de qualquer run, `invalid_scenario_path` para slug que escapa e mapeamento para brief/contexto sem `storeId` de producao.
- **Contrato do dominio de experimentos** (33 testes): 2 variantes (baseline `official` × candidata `override`), dimensao `prompt` unica (model/configuration recusados sem escrita), alvo/params fixos no experimento e ausentes nas variantes, alvo validado em **leitura** no catalogo ativo (zero escrita em `ai_model_catalog`), baseline byte a byte igual ao arquivo oficial sem escrever em `prompts/`, maquina de estados, prontidao/limites, congelamento apos o primeiro run, nenhum run automatico e nenhuma avaliacao automatica no schema.
- **Higiene da suite**: varredura por `fs` prova que nenhum teste do laboratorio instancia SDK/wire de provider, chama endpoint de provider, le imagem gerada do disco ou usa fixture fora de `fixtures/lab/scenarios`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Matriz exaustiva da guarda de ambiente + invariantes das constantes de limite** - `2641f7c3` (test)
2. **Task 2: Isolamento da producao e seguranca financeira com fakes** - `1d33c28a` (test)
3. **Task 3: Contrato de cenarios controlados + contrato do dominio de experimentos** - `87d5452a` (test)

**Plan metadata:** `docs(48-1-11): complete suite de contrato nº 1 do laboratorio plan`

## Files Created/Modified

- `src/lib/lab/__tests__/lab-environment-guard.contract.test.ts` (criado) — 53 testes: matriz dos 5 `reason`, precedencia producao × allowlist, fail-closed, superficie minima, mensagem sanitizada, 4 corpos 403, invariantes das 7 constantes e ausencia de `NODE_ENV`/`VERCEL_ENV`.
- `src/lib/lab/__tests__/lab-isolation.contract.test.ts` (criado) — 7 testes: client gravador (Proxy + allowlist + `forbidden_production_access`), run real com fakes, zero credito, zero `generation_events`, zero secret, `prompts/` intacto.
- `src/lib/lab/__tests__/lab-financial-safety.contract.test.ts` (criado) — 25 testes: confirmacao, reserva antes do gasto, budget, concorrencia global, idempotencia, uma unica invocacao e higiene da suite.
- `src/lib/lab/scenarios/__tests__/lab-scenarios.contract.test.ts` (criado) — 24 testes: corpus, hash canonico, bootstrap idempotente/versionado, modalidade/imagem recusadas antes do run, mapeamento ficticio.
- `src/lib/lab/domain/__tests__/lab-experiments.contract.test.ts` (criado) — 33 testes: variantes, dimensao unica, alvo fixo/catalogo em leitura, snapshots de prompt, transicoes, prontidao/limites, congelamento, nenhum run automatico, avaliacao.

## Decisions Made

- A mensagem de `LabEnvironmentError` nao contem o literal do `reason` (ex.: `"disabled_flag"`); a assercao usa um marcador textual distintivo por motivo (`VENDEO_LAB_ENABLED`, `NEXT_PUBLIC_SUPABASE_URL`, o hostname, "producao") mantendo `.reason` exato e a mensagem sem vazamento. Decisao registrada para nao alterar o fonte do 48-1-02 (somente leitura).
- O client gravador lanca em `from(table)`/`rpc`/`storage.from(bucket)` (e no write de `ai_model_catalog`), e nao em cada metodo do builder: mantem o detector simples, cobre os alvos reais e nao interfere no encadeamento.
- A idempotencia e provada com `executeLabRun` (composicao real): a reserva idempotente devolve `pending` sem tocar o gateway (`calls === 0`).
- A varredura de higiene exclui o proprio arquivo detector (`SELF`), pois o literal da assercao negativa nao pode contar como violacao — o mesmo carve-out usado pelo `architecture-guard`.
- Os testes usam o caminho real de `persistOutputArtifact` (com storage fake) e o `LabTelemetrySink` real com `resolveAiCost` mockado, garantindo que a prova de isolamento nao seja mascarada por mocks.

## Deviations from Plan

None - plan executed exactly as written.

Observacao de interpretacao (sem desvio de escopo): o plano pedia "a mensagem contem o `reason`"; como o fonte do 48-1-02 (somente leitura neste plano) nao inclui o literal do motivo, a assercao usa marcadores textuais distintivos por motivo, preservando a verificacao de `.reason` exato e a ausencia de vazamento.

## Issues Encountered

- Na primeira execucao da suite de seguranca financeira, dois testes falharam porque o snapshot do prompt candidato usava um hash sintetico (`"b".repeat(64)`) em vez do SHA-256 real do conteudo, disparando `prompt_snapshot_mismatch` no `runReservedLabRun`. Corrigido usando `computePromptContentHash` no fixture (comportamento correto do harness, nao bug do fonte).
- `tsc` acusou `this.deletes` dentro do handler `then` do builder fake (o `this` ali e o objeto literal). Corrigido capturando a instancia (`const fake = this`) no escopo de `from(table)`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Contrato nº 1 fechado: guarda de ambiente, isolamento da producao, seguranca financeira, cenarios e dominio de experimentos exercitados com fakes (nenhuma chamada de rede ou paga).
- Pronto para **48-1-12** (Testes 2: harness, execucao, artefatos, API, UI e avaliacao) e, na sequencia, **48-1-13** (regressao e co-migracao de fixtures) e **48-1-14** (UAT local + migration remota deliberada).
- Gates: `npx vitest run src/lib/lab` → 26 arquivos / 505 testes passando (1 skipped); `npx tsc -p tsconfig.typecheck.json --noEmit` → exit 0; `npm.cmd run lint` → exit 0.
- Nenhum arquivo de producao alterado (`git status --porcelain src/lib/ai src/lib/ai-cost src/lib/campaign src/lib/image-generation prompts/ fixtures/ supabase/` vazio).

## Self-Check: PASSED

- 5 arquivos de contrato existem no disco (4 sob `src/lib/lab` + 1 sob `src/lib/lab/domain`).
- 3 commits do plano existem: `2641f7c3`, `1d33c28a`, `87d5452a`.
- `npx vitest run src/lib/lab` executado 4x com resultado identico (26 arquivos / 505 testes passando, 1 skipped) — estabilidade confirmada.
- Nenhuma fonte de producao modificada.

---
*Phase: 48.1-laboratorio-ia-minimo*
*Completed: 2026-09-16*
