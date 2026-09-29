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

## Correção descoberta no UAT (2026-09-29) — chave do destino local

**Sintoma:** a primeira tentativa de importação (autorizada no CHECKPOINT B) falhou em `import_destination_user_lookup_failed: invalid JWT ... signing method HS256 is invalid`, **antes** de materializar assets/transação. Nenhuma importação foi concluída; apenas a leitura remota confirmou os IDs.

**Causa:** `resolveLocalDestination` dava precedência a `SUPABASE_SERVICE_ROLE_KEY` do `.env.local` (JWT/HS256 antigo) e `readSupabaseStatusEnv` ignorava a chave moderna `SECRET_KEY` (`sb_secret_...`) retornada pelo stack local.

**Correção (commit `7193266c`):**
1. `parseSupabaseStatusEnv` (novo, puro) reconhece `SECRET_KEY` **e** `SERVICE_ROLE_KEY` (além de `API_URL`/`DB_URL`).
2. Precedência da chave do destino: `BENCH_LOCAL_SERVICE_ROLE_KEY` (override explícito) → chave atual do stack (`SECRET_KEY`, senão `SERVICE_ROLE_KEY`) → `SUPABASE_SERVICE_ROLE_KEY` (último recurso).
3. `BENCH_IMPORT_SOURCE_SERVICE_ROLE_KEY` **nunca** é usada como chave do destino.
4. `readSupabaseStatusEnv` não é mais fatal quando o stack está ausente (retorna `{}`).

**Testes:** 6 novos casos em `bench-import.contract.test.ts` (SECRET_KEY moderna vence JWT legado; SERVICE_ROLE_KEY do stack; override explícito; source key nunca usada; destino não local recusado). Suíte: `bench-import` + `lab-isolation` = 51 verdes; fase (`src/lib/lab/bench` + isolation + architecture-guard) = 319 verdes; `npm.cmd run typecheck` exit 0.

**Estado:** correção aplicada; **nenhuma** nova leitura remota nem execução da importação após a correção (aguardando revisão humana).

## Descoberta adicional do UAT (2026-09-29) — inconsistência do stack Supabase local

**Diagnóstico confirmado pelo operador:** mesmo com `resolveLocalDestination` selecionando corretamente a `SECRET_KEY` (`sb_secret_...`) do `supabase status -o env`, o smoke local `createLocalDestination().findUserByEmail(...)` (via `auth.admin`) continua falhando com `signing method HS256 is invalid`. Conclusão: **inconsistência interna do stack Supabase local entre gateway/Auth** — não é erro do operador nem da origem remota.

**Procedimento executado (autorizado):** `npx supabase stop` (sem `--no-backup`; dados preservados) → `npx supabase start` (**falhou 2×**) → bootstrap/smoke **não executados**.

**Erro sanitizado:** `container is not ready: unhealthy` para `supabase_analytics`, `supabase_realtime`, `supabase_storage`, `supabase_pg_meta` e `supabase_studio` (na 2ª tentativa); na 1ª, também `failed to prune networks: a prune operation is already running`. `supabase status` → `No such container: supabase_db_Vendeo_V3` (stack parado).

**Versões:**
- Supabase CLI **2.104.0** (atual disponível: 2.118.0).
- Docker **29.6.2** (build `dfc4efb`); Docker Compose **v5.3.1**.
- Imagens presentes (múltiplas versões, indicando possível descasamento CLI/imagem): `postgres:17.6.1.121` e `17.6.1.075`; `gotrue:v2.194.0` e `v2.186.0`; `storage-api:v1.67.23` e `v1.35.3`; `realtime:v2.102.1` e `v2.73.2`; `logflare:1.42.0` e `1.30.5`; `studio:2026.05.25` e `2026.01.27`.
- Volumes preservados: `supabase_db_Vendeo_V3`, `supabase_storage_Vendeo_V3`, `supabase_edge_runtime_Vendeo_V3`.

**Estado:** **bloqueado**. Nenhuma ação destrutiva (`db reset`, `stop --no-backup`, remoção de volumes) executada. O commit `7193266c` (parser) permanece — a compatibilidade com `SECRET_KEY` é correta — mas **não** deve ser apresentado como solução completa enquanto o smoke local não passar. Nenhum novo acesso remoto.

## Correção descoberta no UAT (2026-09-29) — MIME de branding e política de bucket

**Sintoma:** nova tentativa de importação (autorizada) falhou com `import_destination_upload_failed: mime type application/octet-stream is not supported`, antes da transação. Nenhuma identidade foi persistida.

**Causa:** os uploads de branding enviavam `application/octet-stream` quando o `mime_type` estava ausente (assets) e **sempre** para a assinatura (`store_visual_signatures`, que não tem coluna `mime_type`), violando a política real dos buckets.

**Correção (commit `b4ecdf74`):**
1. `resolveBrandingMime` (novo, puro): precedência `mime_type` declarado válido → `Blob.type` do download → extensão segura de `storage_path`; suporta PNG/JPEG/WEBP/HEIC/HEIF/SVG.
2. Aplicado a `store_brand_assets` **e** `store_visual_signatures`; a assinatura nunca é enviada como `application/octet-stream`.
3. A extensão do path content-addressed deriva do MIME resolvido.
4. MIME ausente/desconhecido → `import_asset_mime_unresolved` (sanitizado) **antes** do upload, sem ampliar a política do bucket.
5. `buildSanitizedAssetRow` usa o MIME resolvido (não o default octet-stream).
6. Mock do destino reforçado para reproduzir a política real (rejeita `application/octet-stream` e MIME fora do allowlist do bucket): `store-logos`/`store-brand-assets` = PNG/JPEG/WEBP; `visual-signatures` = PNG/SVG.

**Testes:** 9 novos casos (assinatura PNG sem `mime_type`; resolução por `Blob.type`; por extensão; asset com MIME declarado; MIME desconhecido recusado; cleanup de objeto materializado quando um asset posterior falha; mock rejeita octet-stream). Suíte: `bench-import` + `lab-isolation` + `architecture-guard` = 79 verdes; fase (`src/lib/lab/bench` + isolation + architecture-guard) = **329 verdes**; `typecheck` exit 0.

**Smoke local (sem acesso remoto):** upload/download/remoção nos 3 buckets com prefixo temporário `__smoke_uat__/...`; `removed: 3, failed: 0`; confirmação pós-remoção (3× "removido"). Prefixo temporário removido.

**Estado parcial da tentativa:** `lab_bench_store_imports` = 0; lojas/perfis/assets/assinaturas das duas IDs = 0; objetos content-addressed = 0; manifesto = `stores: []`. 1 owner sintético pré-existente (`bench-store+3dc7d274-…@bench.local`) **preservado** (idempotente). Nada a limpar.

**Estado:** correção aplicada e validada localmente; **nenhuma** nova leitura remota nem execução da importação. Aguardando revisão antes de nova tentativa remota. Base OpenSpec **inalterada**.

### Ajuste cirúrgico — validação por bucket (commit `e2d9a0ef`)

- `assertBrandingMimeAllowedForBucket(bucket, mime)`: valida o MIME resolvido contra a política real do bucket **antes** de `uploadBrandingObject`; incompatível → `import_asset_mime_not_allowed_for_bucket` (sanitizado).
- Políticas (inalteradas): `store-logos`/`store-brand-assets` = `image/png`, `image/jpeg`, `image/webp`; `visual-signatures` = `image/png`, `image/svg+xml`.
- Sem ampliação de política e sem conversão/transcodificação.
- **HEIC/HEIF pertencem ao upload de campanha, não ao contrato atual dos buckets de branding** (nenhum dos três buckets os aceita).
- Testes: +6 (HEIC/HEIF recusados nos buckets de branding; SVG só em `visual-signatures`; JPEG/WEBP recusados em `visual-signatures`; PNG nos três; falha antes de qualquer upload; assinatura SVG aceita). `bench-import` + `lab-isolation` + `architecture-guard` = **85 verdes**; `typecheck` exit 0.
- Smoke local: validação 4/4 recusas; PNG permitido nos 3; round-trip + cleanup OK (`removed: 3, failed: 0`).

## Correção descoberta no UAT (2026-09-29) — fronteira JSONB com node-postgres

**Sintoma:** a importação remota autorizada falhou com `[bench-import] invalid input syntax for type json` na transação local; rollback limpo (nada persistido; sem objetos órfãos). A 1ª loja (`3dc7d274-…`) foi lida na origem; a 2ª (`48b212f8-…`) não foi processada (abort na 1ª falha).

**Causa:** `buildSanitizedProfileRow` preserva arrays/objetos em memória (correto por D7), mas `buildInsertStatement` passava arrays JS diretamente ao `pg`, que os serializa como **literal de array Postgres** (`{...}`) — inválido para colunas `jsonb` (`brand_colors_chosen`, `logo_colors_detected`).

**Correção (commit `a2aeb510`):**
1. Allowlist explícita `JSONB_COLUMNS_BY_TABLE`: `store_brand_profiles` (safe_color_tokens, brand_colors_chosen, logo_colors_detected), `store_brand_assets` (metadata), `store_visual_signatures` (metadata), `lab_bench_store_imports` (detail).
2. `buildInsertStatement` usa `$n::jsonb` + `JSON.stringify` apenas nessas colunas; `null` permanece SQL NULL; demais colunas inalteradas.
3. Builders de domínio **não** serializam (conversão só na fronteira com node-postgres).

**Testes:** +5 (arrays, objetos, objeto vazio, null, campos comuns não serializados). `bench-import` + `lab-isolation` + `architecture-guard` = **90 verdes**; `typecheck` exit 0.

**Smoke local (PostgreSQL real, com ROLLBACK):** perfil com `safe_color_tokens` + 2 arrays, `metadata` (asset e assinatura vazio) e `detail` aninhado → todos lidos como JSONB estruturado (objeto/array), **não** strings; `SMOKE_JSONB_OK`; resíduos = 0.

**Estado:** correção aplicada e validada localmente; **nenhuma** nova leitura remota nem importação. Owner sintético `bench-store+3dc7d274-…` preservado. Aguardando revisão.
