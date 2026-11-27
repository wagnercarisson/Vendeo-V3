---
phase: 63-base-versionada-de-ofertas-2a
plan: 05
subsystem: database / credit / trial-offer
tags: [postgres, homolog, rls, triggers, calendar, concurrency, preservation, vitest]

# Dependency graph
requires:
  - phase: 63-base-versionada-de-ofertas-2a
    plan: 02
    provides: "Migration A aplicada (tabela, guardas, funções, current_version_id)"
  - phase: 63-base-versionada-de-ofertas-2a
    plan: 03
    provides: "v1 publicada/vigente e Migration C (publisher)"
  - phase: 63-base-versionada-de-ofertas-2a
    plan: 04
    provides: "offer-contract.ts e leitura server-only fail-closed"
provides:
  - "Perfil/categoria/gate `integration.f63` dedicado e script test:integration:f63"
  - "Suíte real de schema/trigger/RLS/grants/imutabilidade/vigência/publisher"
  - "Suíte real de calendário, independência de timezone e contratos SQL↔TS"
  - "Suíte real de concorrência com duas conexões e lock observado, sem stores/users"
  - "Evidência post-tests com preservação idêntica ao baseline e fixtures inertes listadas"
  - "Reconciliação documental de 'cópia' para 'referência à versão imutável'"
affects: ["revisão do 63-05", "fatias 4/6 (consumidores, Admin)", "produção (pendente)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Perfil Vitest serial dedicado (fileParallelism/sequence false) para suíte de banco"
    - "Gate fail-closed por TEST_DATABASE_URL + fingerprint all_rows derivado do post-c"
    - "Negativos SQL em savepoint/rollback com asserts de SQLSTATE e mensagem"
    - "Concorrência com dois pg.Client, BEGIN explícito e pg_stat_activity.wait_event_type='Lock'"
    - "Fixtures publicadas inertes por prefixo `f63test-`, rascunhos removidos e vigência restaurada"

key-files:
  created:
    - vitest.integration-f63.config.ts
    - src/lib/credit/__tests__/f63-offer-catalog-schema.postgres.test.ts
    - src/lib/credit/__tests__/f63-offer-catalog-calendar.postgres.test.ts
    - src/lib/credit/__tests__/f63-offer-catalog-concurrency.postgres.test.ts
    - .planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-05-preservation-post-tests.json
    - .planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-05-preservation-post-tests.md
    - .planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-05-verification.md
  modified:
    - scripts/testing/test-categories.json
    - scripts/testing/test-status.mjs
    - scripts/testing/run-integration.mjs
    - vitest.shared.ts
    - package.json
    - docs/alinhamento-onboarding-responsavel-cnpj-opcional.md

key-decisions:
  - "Perfil F63 é puramente aditivo; F57.2 não é executado e o re-baseline (+3 all-rows) fica fora de escopo"
  - "Vigência é provada por INSERT com 23503 (FK composta), sem ALTER DROP NOT NULL/DROP COLUMN/TRUNCATE"
  - "Schema negativos usam savepoint/rollback; publisher e autoria rodam em transação com rollback"
  - "Concorrência não cria/apaga stores/users; publicadas f63test-conc-% permanecem inertes e são listadas"
  - "F63_EXPECTED_LEDGER_* derivados silenciosamente de 63-03-preservation-post-c.json (ledger.count/sha256), sem echo"
  - "Falhas F60.4/F60.7 e HEAD-comparative da suíte global são achados aceitos, não corrigidos"
  - "Lint é reportado como NÃO VALIDADO para TypeScript (ESLint ignora .ts neste repo)"
  - "Sem commit/push/deploy e sem atualização de STATE/ROADMAP: execução para no Review Stop"

patterns-established:
  - "Evidência post-tests sempre capturada depois da última execução da suíte F63"
  - "Classificação separada entre efeitos de migration e dados criados pelos testes"
  - "Adapter pg→RPC para provar o contrato SQL↔TS sem Supabase client real"

requirements-completed: [REQ-63-06, REQ-63-07]

# Metrics
duration: ~20min
completed: 2026-11-26
---

# Phase 63 Plan 05: Validação real da base versionada de ofertas

**Suíte F63 de 33 testes no homolog (schema/RLS/triggers/imutabilidade/vigência/publisher, calendário com timezone e concorrência com lock real), perfil/gate dedicado e preservação post-tests idêntica ao baseline com 15 versões de teste inertes, zero rascunhos e `current_version_id` restaurado à v1**

## Performance

- **Duration:** ~20 min (inclui três execuções da suíte F63 e correção de tipagem)
- **Tasks:** 4/4
- **Files created:** 7 (3 testes, 1 config, 3 evidências) + este SUMMARY
- **Files modified:** 5 existentes + 1 documento

## Accomplishments

- **Perfil/gate F63 aditivo:** `integration.f63` em `vitest.shared.ts`/`test-categories.json`,
  `f63GateStatus` em `test-status.mjs`, perfil `f63` em `run-integration.mjs` e script
  `test:integration:f63`. F57.2/F60/F60.1 preservados; gate falha fechado sem env.
- **Schema real (19 testes):** 13 colunas/tipos/defaults; constraints nomeadas e FKs
  (`RESTRICT`/`SET NULL`); três triggers; RLS + policy única `service_role`; volatilidade/
  `SECURITY DEFINER`/`search_path=""`/`TimeZone=UTC`; EXECUTE só `service_role`; domínio
  23514/23505/23503/23502; imutabilidade e DELETE de publicada; autoria SET NULL; publisher
  (C) em 8 casos; vigência sem DDL; guardas do baseline (5 hashes, enrollments sem
  `offer_version_id`, settings +`current_version_id` NOT NULL).
- **Calendário/contratos (10 testes):** v1 0/7/14/21 (5 cada, total 20, +28d); mensal
  31/01→28/02→31/03→30/04; semanal 7,7,6; `once`; `daily`; bordas do helper; rejeição de
  calendário insuficiente; timezone UTC/São Paulo/Tóquio com payload idêntico; leitura pura
  (sem reserva); `conditions`/`public_offer` sem campos proibidos; adapter pg→TS coincide
  com o SQL; seed v1 == `constants.ts`.
- **Concorrência (4 testes):** duas publicações simultâneas → uma vence, a outra P0001, com
  espera de lock observada; edição segura lock e publicação congela 10/5/weekly/28;
  publicação commitada rejeita edição (P0001); troca simultânea de vigência serializa,
  mantém X/Y publicadas e condições intactas. **Nenhum store/user criado ou apagado.**
- **Preservação post-tests:** `preservation-report --stage post-tests` exit 0, 10/10 checks;
  quatro tabelas 1/41/265/1 iguais ao baseline; `settings_guard` igual (8 campos);
  `current_version_id` = v1; ledger 161 (delta 3); 15 publicadas inertes, 0 rascunhos,
  0 referenciadas.
- **Documentação:** “cópia das condições” → “referência à versão imutável” em três pontos,
  mais frase curta na 2A (leitura pura, homolog ≠ produção, pendências das fatias seguintes).

## Task Commits

**Nenhum commit foi criado** — a autorização explícita (`approved: 63-05`) proíbe
commit/push/deploy nesta execução.

1. **Task 1: perfil/gate F63 + smoke de ledger** — sem commit (proibido)
2. **Task 2: suíte de schema/triggers/RLS/vigência** — sem commit (proibido)
3. **Task 3: calendário/contratos/concorrência** — sem commit (proibido)
4. **Task 4: preservação, docs, gates e evidência** — sem commit (proibido)

**Plan metadata:** não commitado; SUMMARY/verificação gravados apenas no working tree.

## Files Created/Modified

- `vitest.integration-f63.config.ts` — config serial do perfil F63.
- `src/lib/credit/__tests__/f63-offer-catalog-schema.postgres.test.ts` — 19 testes reais.
- `src/lib/credit/__tests__/f63-offer-catalog-calendar.postgres.test.ts` — 10 testes reais.
- `src/lib/credit/__tests__/f63-offer-catalog-concurrency.postgres.test.ts` — 4 testes reais.
- `scripts/testing/test-categories.json`, `scripts/testing/test-status.mjs`,
  `scripts/testing/run-integration.mjs`, `vitest.shared.ts`, `package.json` — perfil/gate/script.
- `docs/alinhamento-onboarding-responsavel-cnpj-opcional.md` — reconciliação editorial.
- `.planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-05-preservation-post-tests.{json,md}`
  — preservação pós-suíte.
- `.planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-05-verification.md` — relatório final.

## Verification Results

| Gate | Comando | Resultado |
|---|---|---|
| F63 (schema) | `vitest run …/f63-offer-catalog-schema…` | **19/19 PASS** |
| F63 (calendário) | `vitest run …/f63-offer-catalog-calendar…` | **10/10 PASS** |
| F63 (concorrência) | `vitest run …/f63-offer-catalog-concurrency…` | **4/4 PASS** |
| F63 completo | `npm run test:integration:f63` | **3 arquivos / 33 testes PASS**, exit 0 |
| Inventário | `node scripts/testing/test-status.mjs` | exit 0; F63 presente |
| Gate fail-closed | `f63GateStatus({})` | `ready=false` com reasons; exit 0 |
| Preservação | `preservation-report --stage post-tests` | exit 0; 10/10 checks |
| OpenSpec | `openspec validate … --strict` | exit 0 |
| Lint | `npm run lint` | exit 0; 1 warning introduzido nesta entrega (63-03), corrigido na quick `261126-tmn`; **TS NÃO VALIDADO** |
| Typecheck | `npm run typecheck` | exit 0 |
| Build | `npm run build` | exit 0 (102/102) |
| Global | `npm test` | exit 1; 3 falhas aceitas (F60.4/F60.4-HEAD/F60.7) |
| Scripts | `npm run test:scripts` | exit 0 (119/119) |
| Gates | `npm run test:gates` | exit 0 |
| Diff check | `git diff --check` | exit 0 (aviso LF→CRLF pré-existente) |

### Falhas aceitas da suíte global (não corrigidas)

1. `boundaries.contract.test.ts` (F60.4): três migrations F63 untracked.
2. `joint-boundaries.contract.test.ts` (F60.7-10): mesma causa.
3. `regression.contract.test.ts` (F60.4): comparação HEAD (`expected 1 to be +0`; HEAD `3f2daa50`).

Nenhuma envolve `src/lib/credit/**`. Os guardas não foram alterados.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tipagem dos novos testes**
- **Found during:** verificação de `npm run typecheck` na Task 4.
- **Issue:** `result.rows[0].result` sobre `client.query` sem generic em `makeAdapter`
  (TS2571) e `deleted.rowCount` em query sem generic tipado (TS2339).
- **Fix:** generics explícitos (`client.query<{result: unknown}>`) e DELETE com
  `returning id` + assert de `rows`.
- **Files modified:** os dois arquivos de teste F63.
- **Verification:** `npm run typecheck` exit 0; suíte F63 reexecutada 33/33.
- **Committed in:** não commitado (proibido).

### Implementation notes

**2. [Execução] Suíte F63 rodou três vezes (manual, oficial e pós-correção).**
Cada execução da concorrência deixa 5 versões publicadas inertes (imutáveis por desenho),
totalizando 15. O relatório post-tests foi o **último** a rodar e cobre todas as 15;
rascunhos = 0 e nenhuma referenciada pela vigência. Não é efeito de migration. Nenhum
guard/teste foi alterado para reduzir a contagem.

**3. [Escopo] Sem atualização de `STATE.md`/`ROADMAP.md`/`REQUIREMENTS.md`.**
A execução para no Review Stop; o aceite/atualização de fase pertence à revisão. Nenhum
commit/push/deploy.

## Issues Encountered

- ESLint não cobre `.ts` neste repositório (limitação pré-existente): **lint NÃO VALIDADO
  para TypeScript**. Exit 0 e nenhum erro; o único warning foi **introduzido nesta entrega**
  em `scripts/f63/preservation-report.mjs` (Task 63-03) — não é anterior à F63 — e foi
  corrigido na quick `261126-tmn`.
- `npm test` global permanece com 3 falhas aceitas (acima), sem correção de guardas.
- `git diff --check` emite apenas aviso de LF→CRLF em `.planning/REQUIREMENTS.md`
  (pré-existente), exit 0.

## Known Stubs

Nenhum. A suíte valida dados reais (v1 publicada/vigente); as fixtures publicadas são
identificadas e inertes por desenho. Não há placeholder, valor vazio fluindo para UI ou
componente sem fonte de dados.

## Threat Flags

Nenhuma superfície nova além do `<threat_model>` do plano. As suítes são de teste, não
criam rotas/endpoints, não alteram auth/acesso a arquivos e não mudam schema em fronteira
de confiança. RLS/grants foram provados, não alterados nesta execução.

## User Setup Required

Nenhum. O homolog já estava provisionado; `TEST_DATABASE_URL` e `F63_EXPECTED_*` foram
derivados/exportados **em silêncio** no processo e nunca impressos ou persistidos.

## Next Phase Readiness

- **63-05 concluído e parado no Review Stop.** Base versionada validada no homolog local:
  preservação intacta, fixtures inertes listadas, vigência restaurada à v1.
- **Não existe 63-06.** Próximo passo é a revisão do 63-05; sem consumidores/backfill/Admin.
- **Pendente para produção:** conferência remota de estruturas/migrations/permissões,
  integração de `offer_version_id`, RPC/painel Admin, troca de fonte dos consumidores e
  roteiro de publicação/ativação (fatias 4/6 e posteriores). Homolog ≠ produção.
- F57.2 pós-F63 não executado; re-baseline fora de escopo (+3 all-rows).

---

## Self-Check: PASSED

- `vitest.integration-f63.config.ts` — existe.
- `src/lib/credit/__tests__/f63-offer-catalog-schema.postgres.test.ts` — existe (19 testes).
- `src/lib/credit/__tests__/f63-offer-catalog-calendar.postgres.test.ts` — existe (10 testes).
- `src/lib/credit/__tests__/f63-offer-catalog-concurrency.postgres.test.ts` — existe (4 testes).
- `evidence/63-05-preservation-post-tests.json` — existe; 10/10 checks true.
- `evidence/63-05-preservation-post-tests.md` — existe.
- `evidence/63-05-verification.md` — existe.
- Commits — **N/A por design** (commit proibido); HEAD permanece `3f2daa50`.
- DB final — current v1; 0 rascunhos `f63test-%`; 15 publicadas inertes; 4 tabelas iguais.

## Review Stop

**PARADO NO REVIEW STOP DO 63-05.** Execução autorizada por `approved: 63-05`.
Checklist do revisor coberto pela evidência:

- [x] Perfil F63 aditivo; F57.2 não reexecutado; re-baseline fora de escopo.
- [x] Nenhum teste com DDL destrutivo; FK composta provada por INSERT 23503.
- [x] Publisher (C) provado nos 8 casos; A intocada (hash inalterado).
- [x] Concorrência sem stores/users, com duas conexões e lock real observado.
- [x] Fixtures `f63test-%` cobertas; efeitos de migration separados dos dados de teste.
- [x] `settings_guard` inclui `individual_launch_at`; contrato pinado usado.
- [x] Documentação troca “cópia” por “referência à versão imutável” sem antecipar a fatia 4.
- [x] Gates finais sem F57.2 pós-F63; “pendente para produção” explícito.

**Sinal de retomada:** `approved: 63-05` (revisão) ou a lista de ajustes obrigatórios.

---
*Phase: 63-base-versionada-de-ofertas-2a*
*Completed: 2026-11-26*
