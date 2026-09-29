---
phase: 48.2.3-fidelidade-experimental-bancada
plan: 48-2-3-03
status: complete
subsystem: lab-bench (importação local de identidade das lojas de teste)
tags: [cli, esm, supabase, content-addressed, transacao, auditoria, manifesto, lab-isolation, checkpoint-a]

# Dependency graph
requires:
  - phase: 48.2.3-fidelidade-experimental-bancada
    provides: "CLI parte 1/2 (clientes, allowlist, confirmação is_test_store, estado atual, proprietário sintético) do plano 02; DDL local aditivo (lab_bench_store_imports) e schemas fiéis do plano 01"
provides:
  - "Cópia de assets em paths versionados/content-addressed (sha256) nos buckets locais de branding, sem sobrescrever referenciados"
  - "Transação SQL única de substituição integral (apaga linhas-filhas + upsert da loja + novo conjunto + auditoria); remoção dos antigos sem referência só após o commit; falha antes do commit remove apenas os novos"
  - "Auditoria local em lab_bench_store_imports (source_host canonicalizado sem credenciais, detail saneado)"
  - "Upsert idempotente { id, label } em fixtures/lab/bench/stores.json (createFileManifestStore + upsertManifestEntry)"
  - "Testes de fronteira/negativos/idempotência/falha-antes-do-commit (a)–(k) verdes, sem rede e sem banco real"
affects: [48-2-3-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Assets content-addressed por sha256 do conteúdo: mesmo checksum → mesmo path (idempotência); upload com upsert:false (nunca sobrescreve referenciado)"
    - "Transação SQL única via pg.Client (mesmo caminho do bootstrap), com REVERT manual de limpeza dos novos em falha antes do commit"
    - "Orquestração testável com clientes/banco/manifesto injetáveis (deps) — fakes em memória, sem I/O real"
    - "Manifesto versionado como única fonte de elegibilidade, com upsert idempotente e confinamento de caminho"

key-files:
  created:
    - src/lib/lab/bench/__tests__/bench-import.contract.test.ts
  modified:
    - scripts/lab/48-2-3-bench-import-stores.mjs
    - fixtures/lab/bench/stores.json (inalterado em disco — upsert ocorre só na execução real)

key-decisions:
  - "Path content-addressed = <storeId>/<objectId>/<checksum><ext> (mesmos checksums → mesmos paths)"
  - "uploadBrandingObject usa upsert:false e tolera o erro de duplicidade (idempotência sem sobrescrever conteúdo referenciado)"
  - "Auditoria gravada DENTRO da transação única (atômica com a substituição), com detail saneado por sanitizeMetadata"
  - "deps.db/deps.manifestStore injetáveis para testar transação e manifesto sem banco real nem escrita em disco"

patterns-established:
  - "Substituição integral transacional com limpeza dos novos antes do commit e remoção dos antigos só após o commit"
  - "Allowlist de assets estendida com source/version/parent_asset_id (colunas NOT NULL) para reconstrução local válida"

requirements-completed:
  - "cap: lab-bench-store-import"
  - "cap: lab-isolation"
  - "D8"
  - "D9"
  - "D10"
  - "D11"
  - "D12"
  - "spec: lab-bench-store-import"
  - "spec: lab-isolation"
  - "tasks: 3.6, 3.7, 3.8, 3.10, 1.3 (fronteira de importação), 1.4"

# Metrics
duration: ~5min
started: 2026-09-29T15:22:13Z
completed: 2026-09-29T15:27:30Z
---

# Phase 48.2.3 Plan 48-2-3-03: Importação completa (assets versionados, transação, auditoria e manifesto)

**Importação local da identidade das lojas de teste com assets content-addressed (sha256), transação SQL única de substituição integral (remoção dos antigos só após o commit; falha antes do commit remove só os novos), auditoria em `lab_bench_store_imports` e upsert idempotente do manifesto — testes (a)–(k) verdes sem rede/banco; CHECKPOINT A aprovado pelo humano (nenhuma leitura remota executada).**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-09-29T15:22:13Z
- **Completed:** 2026-09-29T15:27:30Z (Tasks 1–2; Task 3 = CHECKPOINT A pendente)
- **Tasks:** 2/3 (a Task 3 é um checkpoint humano — **não** executada)
- **Files modified:** 3 (1 criado, 2 tocados; `fixtures/lab/bench/stores.json` inalterado em disco)

## Accomplishments

- **Assets versionados/content-addressed:** `materializeStoreAssets` baixa os assets atuais (logo/assinatura) da allowlist e grava nos buckets locais `store-logos`/`store-brand-assets`/`visual-signatures` em paths `<storeId>/<objectId>/<sha256><ext>`, com `upsert:false` (nunca sobrescreve objeto referenciado). Mesmos checksums → mesmos paths (idempotência).
- **Transação única de substituição integral:** `runIdentityTransaction` (mesmo `pg.Client` do bootstrap) apaga as linhas-filhas (perfis, assets, assinaturas), faz upsert da loja e insere o novo conjunto com os paths novos + a auditoria. Remoção dos antigos sem referência ocorre **somente após o commit**; falha antes do commit remove **apenas** os objetos novos (`removeBrandingObjectsBestEffort`).
- **Auditoria local (D11):** `buildImportAuditRow` grava em `lab_bench_store_imports` com `source_host` canonicalizado sem credenciais (`source.host`) e `detail` saneado (`sanitizeMetadata`).
- **Manifesto (D10):** `upsertManifestEntry` + `createFileManifestStore` fazem o upsert idempotente de `{ id, label }` em `fixtures/lab/bench/stores.json` com confinamento de caminho; `assertBenchTestStore` permanece inalterado (manifesto = única fonte de elegibilidade).
- **Testes (a)–(k):** 25 testes verdes cobrindo fronteira (wrapper de origem sem mutação + cliente gravador só-leitura da allowlist), loja não-teste, IDs implícitos/`--all`, allowlist, ausência de URL assinada/token persistido, múltiplos synced, ausência de synced preservando `brand_color`/segmento, idempotência, falha antes do commit (só novos removidos), substituição integral, proprietário sintético e ausência de chamada de IA/crédito.

## Task Commits

Each task was committed atomically:

1. **Task 1: Assets versionados, transação de substituição integral, remoção pós-commit, auditoria e manifesto** - `bb18562a` (feat)
2. **Task 2: Testes de fronteira, negativos, idempotência e falha-antes-do-commit (com fakes, sem rede)** - `649a7b42` (test)

**Plan metadata:** (este commit) (docs: SUMMARY parcial do plano 03)

## Files Created/Modified

- `scripts/lab/48-2-3-bench-import-stores.mjs` - parte 2/2: assets content-addressed, `createLocalDatabase` (pg.Client), `runIdentityTransaction`, `buildImportAuditRow`, `readLocalIdentity`, upsert do manifesto e `upload/removeBrandingObject` no destino local.
- `src/lib/lab/bench/__tests__/bench-import.contract.test.ts` - contrato da importação com fakes/fixtures (a)–(k), sem rede e sem banco real.
- `fixtures/lab/bench/stores.json` - inalterado em disco; o upsert `{ id, label }` ocorre apenas na execução real do comando (não houve execução remota).

## Decisions Made

- **Path content-addressed** `<storeId>/<objectId>/<checksum><ext>`: determinístico e idempotente; o checksum é calculado do conteúdo baixado (sha256).
- **`upsert:false` + tolerância a duplicidade:** nunca sobrescreve objeto referenciado; reexecução idempotente.
- **Auditoria dentro da transação:** atômica com a substituição da identidade.
- **Injeção via `deps`:** `deps.db` e `deps.manifestStore` permitem testar a transação e o manifesto sem banco real nem escrita em disco.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Allowlist de assets estendida com `source`/`version`/`parent_asset_id`**
- **Found during:** Task 1 (transação de substituição)
- **Issue:** `store_brand_assets` exige NOT NULL em `source`, `version` e `mime_type`/`width`/`height`/`size_bytes`/`checksum`; a allowlist do plano 02 não lia `source`/`version`/`parent_asset_id`, e a reconstrução saneada também não incluía `store_id`. Sem isso, o INSERT local violaria NOT NULL/CHECK.
- **Fix:** `ASSET_COLUMNS` passou a incluir `source`/`version`/`parent_asset_id`; `buildSanitizedAssetRow`/`buildSanitizedProfileRow`/`buildSanitizedSignatureRow` passaram a incluir `store_id` e os campos NOT NULL necessários, com fallbacks válidos.
- **Files modified:** `scripts/lab/48-2-3-bench-import-stores.mjs`
- **Verification:** smoke offline (import completo com fakes) + suíte de contrato verde; sem literais proibidos (architecture-guard do script OK).
- **Committed in:** `bb18562a` (Task 1) e ajustes em `649a7b42` (Task 2).

**2. [Rule 3 - Blocking] JSDoc nos params exportados para o `tsc` inferir tipos permissivos**
- **Found during:** Task 2 (`npm run typecheck` da task)
- **Issue:** o `tsc` (allowJs) infere os tipos dos parâmetros desestruturados dos exports `.mjs`, tornando `manifestStore` como `null | undefined` e `storedAssets`/`storedSignature` como `never`/`null`, e o `clientFactory` como a assinatura genérica de `createClient` — o que reprovava o typecheck do teste.
- **Fix:** `importOneStore` e `buildSanitizedIdentity` passaram a receber um objeto `params` com JSDoc de forma; `createReadOnlySourceClient` ganhou JSDoc para `clientFactory`/`params`.
- **Files modified:** `scripts/lab/48-2-3-bench-import-stores.mjs`
- **Verification:** `npm.cmd run typecheck` exit 0; suíte verde.
- **Committed in:** `649a7b42` (Task 2).

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Ambos necessários para correção/tipagem; nenhum amplia produto, nenhum afrouxa a allowlist positiva e nenhuma dependência nova foi adicionada.

## Issues Encountered

- **Verificação com o shim `npm` (PowerShell):** o comando `<verify><automated>` da Task 2 (`npm run typecheck ; ... ; npm test ...`) produziu falso-negativo porque o shim `npm` não propagou `$LASTEXITCODE` neste shell. Validação re-executada com `npm.cmd` e exit codes reais: `typecheck` exit 0 e `bench-import.contract.test.ts` = **1 arquivo / 25 testes verdes**.
- **Integração entre planos (RESOLVIDA pelo orquestrador):** `architecture-guard.test.ts` reprovava 1 caso — `form-rules.ts` (Plano 04) importa `@/lib/campaign/constants` (módulo puro de constante única), fora da allowlist do gate (Plano 01). Resolvido em `7e66acc9` adicionando **somente** `constants` a `BENCH_ALLOWED_CAMPAIGN_MODULES` (`{brief, brief-schema, types, constants}`); `architecture-guard.test.ts` + `form-parity.contract.test.ts` = **79 testes verdes**.

## User Setup Required

None - no external service configuration required. Nenhuma credencial remota é necessária para a suíte de testes (fakes/fixtures).

## Next Phase Readiness

- **Pronto para o CHECKPOINT A** (Task 3): o comando está completo e validado apenas com fixtures/fakes/`--dry-run` offline. Nenhuma leitura remota foi executada.
- Pendência de integração entre planos (arquitetura-guard × form-rules) sinalizada ao orquestrador.

## CHECKPOINT A — autorização humana antes de qualquer leitura remota (APROVADO)

**Estado:** ✅ **APROVADO** (2026-09-29) — o plano de importação e a allowlist foram revisados e aprovados pelo humano. **Nenhuma leitura remota foi executada.** Esta aprovação habilita o UAT remoto do CHECKPOINT B (Plano 08), que exigirá autorização adicional explícita.

**O que foi construído (what-built):** o comando de importação completo (`scripts/lab/48-2-3-bench-import-stores.mjs`) com dois clientes separados, allowlist estrita, confirmação `is_test_store`, leitura do único perfil `status='synced'` pelo comportamento produtivo, assets versionados/content-addressed, transação SQL única de substituição integral, remoção pós-commit, auditoria local e upsert do manifesto — **validado apenas com fixtures/fakes/`--dry-run` offline**. Nenhuma conexão remota foi aberta.

**Plano de importação / allowlist (para revisão humana):**
- **Tabelas de origem (somente leitura):** `stores`, `store_brand_profiles`, `store_brand_assets`, `store_visual_signatures`.
- **Buckets de origem (somente download):** `store-logos`, `store-brand-assets`, `visual-signatures`.
- **Proibições explícitas:** campanhas, imagens de campanha, eventos de geração, seleção de modelo, auditoria administrativa, `credit_*`, `prompts/` e o bucket de imagens de campanha. O cliente de origem **não** expõe métodos de mutação (só `select`/`download`).
- **Estado atual:** único perfil `status='synced'` (qualquer `source`, incl. `text_only`); ausência de synced = ausência de perfil (preserva `brand_color`/segmento); **>1 synced = recusa** com erro sanitizado; perfil não sincronizado nunca vira baseline.
- **Ordem transacional D8/D9:** (1) baixar assets; (2) gravar local em paths content-addressed sem sobrescrever referenciados; (3) UMA transação SQL troca as referências; (4) após o commit, remover antigos sem referência (best-effort); (5) falha antes do commit remove **apenas** os novos.
- **`--dry-run` NÃO garante ausência de leitura remota** — impede materialização/escrita local, mas a leitura remota exige aprovação humana prévia. Sem aprovação, o comando opera somente com fixtures/fakes/`--dry-run` **completamente offline**.

**Como verificar (how-to-verify):**
1. Revisar o código do comando e confirmar: cliente de origem somente-leitura; allowlist estrita; confirmação `is_test_store`; único synced; paths versionados; transação + remoção pós-commit; auditoria; upsert do manifesto.
2. Confirmar que os testes foram executados apenas com fakes/fixtures/`--dry-run` offline e que nenhuma conexão remota foi aberta.
3. Confirmar que nenhuma credencial/URL remota é necessária para rodar a suíte de testes.
4. Aprovar explicitamente o plano de importação/allowlist (ou apontar ajustes). A aprovação aqui **não** autoriza, por si só, a execução remota: ela é o gate que permite, depois, o UAT do CHECKPOINT B (Plano 08) com credenciais do operador.

**Resume-signal:** responder **"aprovado"** para autorizar a fronteira de importação (habilitando o UAT remoto posterior), ou descrever ajustes necessários. Sem aprovação, nenhuma execução com URL/credencial remota é permitida.

## Self-Check: PASSED

- `scripts/lab/48-2-3-bench-import-stores.mjs` existe e `node --check` exit 0.
- `src/lib/lab/bench/__tests__/bench-import.contract.test.ts` existe e passa (1 arquivo / 25 testes).
- `fixtures/lab/bench/stores.json` válido com pares `{ id, label }` (inalterado em disco).
- Commits `bb18562a` e `649a7b42` existem no histórico.
- Nenhuma leitura remota executada; nenhum texto entre o Write e o commit do SUMMARY.
- STATE.md/ROADMAP.md **não** modificados (propriedade do orquestrador).

---
*Phase: 48.2.3-fidelidade-experimental-bancada*
*Completed: 2026-09-29 (3/3 tasks; CHECKPOINT A aprovado)*
