---
phase: 48.2.2
plan: 48-2-2-03
subsystem: lab-bench
tags: [nextjs, typescript, zod, vitest, supabase, lab, bench, branding, isolation, read-only, storage]

# Dependency graph
requires:
  - phase: 48.2.2
    plan: 48-2-2-01
    provides: bounded context `src/lib/lab/bench/**`, schemas (`BenchBrandingSnapshotSchema`) e contratos de isolamento read-only (tabelas de branding + buckets `store-logos`/`store-brand-assets`/`visual-signatures`)
  - phase: 48.2.2
    plan: 48-2-2-02
    provides: persistência local-first da bancada (`lab_bench_runs`/`lab_bench_artifacts`) e serviços de run/artefato
provides:
  - Manifesto/allowlist local de lojas de teste `fixtures/lab/bench/stores.json` (D4)
  - `src/lib/lab/bench/domain/store-manifest.ts`: `loadBenchStoreManifest` (anti-traversal), `listBenchTestStores` (manifesto E Supabase local) e `assertBenchTestStore` (exigido nos pontos de entrada, `store_not_in_manifest` sem leitura)
  - `src/lib/lab/bench/persistence/bench-branding-signer.ts`: `createBenchBrandingSignedUrl` restrito a `store-logos`/`store-brand-assets`/`visual-signatures`, allowlist estrita de bucket/path após `assertLabEnvironment`, e `createBenchBrandingSignedUrlForStore` (exige `assertBenchTestStore` antes de assinar)
  - `src/lib/lab/bench/domain/branding-service.ts`: `loadBenchBranding` (somente leitura; `typography_direction` da fonte persistida; fallback `without_logo`; assets por URL assinada restrita) e `toBenchBrandingSnapshot`
  - `src/lib/lab/bench/domain/campaign-snapshot.ts`: `buildBenchCampaignSnapshot`/`resolveBenchIntent` com `intentResolvedFrom` e `assertBenchCampaignSnapshot`
affects: [48.2.2 planos 04-08, 48.2.3]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Manifesto local como única fonte de elegibilidade (manifesto E materialização local), cruzado por leitura somente-leitura de `stores`"
    - "Signer de branding dedicado por allowlist estrita de bucket/path, aplicado após `assertLabEnvironment`, com gate de manifesto antes de assinar (nunca aceita bucket/path do cliente)"
    - "Contrato de branding read-only com `typography_direction` lida da coluna persistida (fecha a lacuna sem tocar o pipeline produtivo)"
    - "Snapshot de campanha puro com intenção resolvida registrada explicitamente (`explicit` | `inferred_from_prices`)"

key-files:
  created:
    - fixtures/lab/bench/stores.json
    - src/lib/lab/bench/domain/store-manifest.ts
    - src/lib/lab/bench/domain/branding-service.ts
    - src/lib/lab/bench/persistence/bench-branding-signer.ts
    - src/lib/lab/bench/domain/campaign-snapshot.ts
    - src/lib/lab/bench/__tests__/store-manifest.test.ts
    - src/lib/lab/bench/__tests__/bench-branding-signer.test.ts
    - src/lib/lab/bench/__tests__/branding-service.test.ts
    - src/lib/lab/bench/__tests__/campaign-snapshot.test.ts
  modified: []

key-decisions:
  - "assertBenchTestStore exige loja no manifesto E materializada no Supabase local (store_not_in_manifest | bench_store_not_materialized) e é o contrato dos pontos de entrada (GET branding, estimativa e POST runs) — consumo no plano 06"
  - "createBenchBrandingSignedUrlForStore adiciona o gate de manifesto ANTES de assinar; a assinatura low-level createBenchBrandingSignedUrl({client,bucket,path}) permanece com allowlist estrita de bucket/path"
  - "fixtures/lab/bench/stores.json versionado com stores: [] — os IDs reais das lojas locais serão preenchidos no UAT autorizado (plano 08)"
  - "Reuso apenas dos TIPOS produtivos (BrandProfileRecord/BrandAssetRecord e CampaignBriefProduct/CampaignBriefCommercial) sem alterá-los; nenhum pipeline produtivo tocado"
  - "Bucket do logo derivado da tabela de origem (store_brand_assets -> store-brand-assets; store_visual_signatures -> visual-signatures); store-logos permanece na allowlist para registros legados"
  - "resolveBenchIntent é determinística: preço promocional (original > atual) => inferred_from_prices; caso contrário => explicit; primeiro recorte sempre offer"

patterns-established:
  - "Isolamento read-only aditivo: leitura de lojas/branding local sem afrouxar a proibição de produção"
  - "Signer escopado à loja: a elegibilidade (manifesto) precede qualquer assinatura de asset"

requirements-completed: [lab-bench-branding, lab-generation-bench, lab-isolation]

# Metrics
duration: ~6min
completed: 2026-09-28
---

# Phase 48.2.2 Plan 03: Lojas de teste e branding completo Summary

**Manifesto local de lojas de teste com `assertBenchTestStore`, contrato de branding completo somente-leitura (incluindo `typography_direction` lida da fonte persistida) com assets servidos por um signer local restrito `createBenchBrandingSignedUrl`, e snapshot de campanha produto/oferta com intenção resolvida — sem tocar o pipeline produtivo e sem nenhuma chamada paga.**

## Performance

- **Duration:** ~6min
- **Started:** 2026-09-28T17:17:00Z (implementação das tasks)
- **Completed:** 2026-09-28T20:23:00Z (fechamento)
- **Tasks:** 3/3
- **Files modified:** 9 (9 criados, 0 modificados)

## Verificação (plan-level)

Comandos reexecutados no encerramento (modo sequencial, árvore principal):

- `npm run typecheck` → **exit 0** (`tsc -p tsconfig.typecheck.json --noEmit`).
- `npm test -- --run src/lib/lab/bench/__tests__/store-manifest.test.ts src/lib/lab/bench/__tests__/bench-branding-signer.test.ts src/lib/lab/bench/__tests__/branding-service.test.ts src/lib/lab/bench/__tests__/campaign-snapshot.test.ts src/lib/lab/__tests__/lab-prompt-optimization.contract.test.ts` → **5 test files passed (5) / 67 tests passed (67)**, exit 0 (vitest v4.1.9).
- `git diff --name-only src/components/campaign/types.ts src/lib/store-identity-service.ts src/lib/image-generation/services/art-director-briefing.ts` → **vazio** (fronteiras produtivas intocadas).
- Gates adicionais reexecutados: `npm test -- --run src/lib/ai/__tests__/architecture-guard.test.ts src/lib/lab/__tests__/lab-isolation.contract.test.ts` → **2 test files passed (2) / 31 tests passed (31)**, exit 0.

## Accomplishments

- **Manifesto local de lojas de teste** (`fixtures/lab/bench/stores.json`): única fonte de elegibilidade além da existência no Supabase local (D4); arquivo versionado e válido com `stores: []` (IDs reais a preencher no UAT).
- **Loader read-only confinado** (`store-manifest.ts`): `loadBenchStoreManifest` com confinamento anti-traversal (`assertWithinRoot`/`path.relative`), `listBenchTestStores` cruzando manifesto E `stores` local (`.select(...)` somente-leitura) e **`assertBenchTestStore` exportado** para ser exigido nos pontos de entrada (GET branding, estimativa e POST runs) **antes** de qualquer leitura.
- **Signer local restrito de branding** (`bench-branding-signer.ts`): `createBenchBrandingSignedUrl` aceita **somente** `store-logos`/`store-brand-assets`/`visual-signatures` (allowlist estrita de bucket e path), aplica `assertLabEnvironment()` na entrada, usa TTL do servidor e **não** reutiliza o signer de artefatos do laboratório; `createBenchBrandingSignedUrlForStore` exige `assertBenchTestStore` antes de assinar (o cliente nunca informa bucket/path livremente).
- **Contrato completo de branding** (`branding-service.ts`): `loadBenchBranding` começa por `assertBenchTestStore`, lê `stores`/`store_brand_profiles` (`status='synced'`, fallback `source='without_logo'`)/`store_brand_assets` (`status='active'`)/`store_visual_signatures` (`status='active'`) em **somente leitura**, expõe **todos** os campos incluindo `typography_direction` (lida diretamente da coluna persistida) e resolve logo/assinatura por URL assinada do signer restrito; `toBenchBrandingSnapshot` registra a evidência. Nenhuma referência a `BrandProfileSnapshot`/`resolveStoreIdentity`/`art-director-briefing`, nem a `createArtifactSignedUrl`/`campaign-images`.
- **Snapshot de campanha** (`campaign-snapshot.ts`): módulo puro com `buildBenchCampaignSnapshot` (produto/comercial compatíveis com os contratos reais), `resolveBenchIntent` determinística e `intentResolvedFrom` (`explicit` | `inferred_from_prices`); `assertBenchCampaignSnapshot` exige os campos mínimos (`missing_campaign_snapshot`). Nenhum serviço de crédito/entrega/correção/publicação e nenhum client Supabase.
- **Testes negativos** (fakes em memória): bucket produtivo, path traversal e loja fora do manifesto recusados **sem rede real**; ausência de escrita nas tabelas de loja/branding; ausência de bucket produtivo/`lab-artifacts`.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Manifesto local de lojas de teste e loader read-only confinado** — `ef04240f` (feat)
2. **Task 2: Signer local restrito de branding e contrato completo read-only** — `ba1c57c9` (feat)
3. **Task 3: Snapshot de campanha produto/oferta com intenção resolvida** — `b9321f41` (feat)

**Plan metadata:** `[pending]` (docs: complete lojas de teste e branding completo)

## Files Created/Modified

- `fixtures/lab/bench/stores.json` — Manifesto/allowlist local das lojas de teste (`stores: []`, IDs reais a preencher no UAT).
- `src/lib/lab/bench/domain/store-manifest.ts` — `loadBenchStoreManifest`/`listBenchTestStores`/`assertBenchTestStore`; leitura somente-leitura de `stores`, anti-traversal e erros `store_not_in_manifest`/`bench_store_not_materialized`.
- `src/lib/lab/bench/persistence/bench-branding-signer.ts` — `createBenchBrandingSignedUrl`/`createBenchBrandingSignedUrlForStore`/`BENCH_BRANDING_BUCKETS`; allowlist estrita, `assertLabEnvironment` e códigos `bench_branding_bucket_not_allowed`/`bench_branding_path_invalid`.
- `src/lib/lab/bench/domain/branding-service.ts` — `loadBenchBranding`/`toBenchBrandingSnapshot`/`BenchBrandingContract`; contrato completo read-only com `typography_direction`.
- `src/lib/lab/bench/domain/campaign-snapshot.ts` — `buildBenchCampaignSnapshot`/`resolveBenchIntent`/`assertBenchCampaignSnapshot`; `intentResolvedFrom` e `missing_campaign_snapshot`.
- `src/lib/lab/bench/__tests__/store-manifest.test.ts` — 9 testes (elegibilidade cruzada, recusa sem leitura, traversal, sem escrita).
- `src/lib/lab/bench/__tests__/bench-branding-signer.test.ts` — 16 testes (allowlist, bucket produtivo, traversal, loja fora do manifesto, guarda de ambiente).
- `src/lib/lab/bench/__tests__/branding-service.test.ts` — 9 testes (contrato completo, fallback, assets assinados, sem escrita, sem bucket produtivo, manifesto antes da leitura, snapshot).
- `src/lib/lab/bench/__tests__/campaign-snapshot.test.ts` — 10 testes (intenção resolvida, montagem, determinismo, campos mínimos, pureza).

## Decisions Made

- **`assertBenchTestStore` como contrato de elegibilidade:** exige loja **no manifesto E** materializada no Supabase local, devolvendo o registro local (`store_not_in_manifest` sem qualquer leitura; `bench_store_not_materialized` quando ausente localmente). O plano 06 deve chamá-lo em **todos** os pontos de entrada (branding GET, estimativa e execução POST) **antes** de qualquer leitura de branding/tabela/storage.
- **Seam de injeção do manifesto (aditivo):** `listBenchTestStores`, `assertBenchTestStore`, `loadBenchBranding` e `createBenchBrandingSignedUrlForStore` aceitam um parâmetro opcional `manifest` (default: lê o arquivo versionado). É um seam de testabilidade em memória, alinhado ao padrão "client por parâmetro"; nenhum ponto de entrada de produção depende dele.
- **`fixtures/lab/bench/stores.json` vazio por padrão:** os IDs reais das lojas do Supabase local serão preenchidos no UAT autorizado (plano 08); o schema já está correto e validado.
- **Reuso apenas de tipos produtivos:** `BrandProfileRecord`/`BrandAssetRecord` (leitura da fonte persistida) e `CampaignBriefProduct`/`CampaignBriefCommercial` (snapshot compatível) — nenhum módulo produtivo alterado.
- **Bucket do logo derivado da tabela de origem:** `store_brand_assets` → `store-brand-assets` e `store_visual_signatures` → `visual-signatures`; `store-logos` permanece na allowlist do signer (registros legados), sempre validado pela allowlist estrita.
- **`resolveBenchIntent` determinística:** preço promocional (`originalPriceCents > priceCents`) ⇒ `inferred_from_prices`; caso contrário ⇒ `explicit` (primeiro recorte sempre `offer`).

## Deviations from Plan

None - plan executed exactly as written.

*(Ajuste interno de redação no doc-comment do signer para não citar literais proibidos pela própria `acceptance_criteria` — ver "Issues Encountered"; nenhuma mudança funcional.)*

## Issues Encountered

- **`acceptance_criteria` do signer proíbe os literais `createArtifactSignedUrl` e `lab-artifacts` no arquivo do signer.** A primeira versão do doc-comment do `bench-branding-signer.ts` citava ambos os nomes (como referência ao que **não** reutiliza). Corrigido o comentário para descrever "o signer de artefatos do laboratório" sem os literais proibidos — nenhuma alteração de código funcional e nenhuma nova verificação de rede. Confirmado por `rg -c` retornando 0 para ambos os literais no arquivo do signer.
- Nenhuma chamada paga, nenhuma dependência nova e nenhum `supabase db push` foram executados neste plano.

## User Setup Required

None — nenhuma configuração de serviço externo. O manifesto (`fixtures/lab/bench/stores.json`) será populado com os IDs das lojas de teste locais no **UAT autorizado** (plano 08).

## Next Phase Readiness

- **Plano 06 (API) deve** exigir `assertBenchTestStore` em **todos** os pontos de entrada (GET branding, estimativa e POST runs) **antes** de qualquer leitura, e usar `loadBenchBranding`/`toBenchBrandingSnapshot` para o branding e o snapshot de evidência.
- **Plano 04** habilita os presets confirmados pelo spike (CHECKPOINT 2) — os presets seguem desabilitados até então.
- Fronteiras produtivas permanecem intocadas (`git diff` vazio para `BrandProfileSnapshot`/`resolveStoreIdentity`/`art-director-briefing`) e a regressão do pipeline está verde.
- Tracking: `requirements.mark-complete` **não** aplicável (`.planning/REQUIREMENTS.md` é um índice operacional sem esses REQ-IDs); os IDs foram registrados apenas no frontmatter deste SUMMARY.
- **Nenhuma chamada paga**; nenhum preset habilitado.

---

*Phase: 48.2.2-fundacao-bancada-geracao*
*Completed: 2026-09-28*

## Self-Check: PASSED

- Arquivos criados/verificados: `fixtures/lab/bench/stores.json`, `src/lib/lab/bench/domain/store-manifest.ts`, `src/lib/lab/bench/persistence/bench-branding-signer.ts`, `src/lib/lab/bench/domain/branding-service.ts`, `src/lib/lab/bench/domain/campaign-snapshot.ts`, `src/lib/lab/bench/__tests__/store-manifest.test.ts`, `src/lib/lab/bench/__tests__/bench-branding-signer.test.ts`, `src/lib/lab/bench/__tests__/branding-service.test.ts`, `src/lib/lab/bench/__tests__/campaign-snapshot.test.ts` — todos FOUND.
- Commits verificados: `ef04240f`, `ba1c57c9`, `b9321f41` — todos FOUND.
- Verificação: typecheck exit 0; 5 arquivos de teste / 67 testes verdes; gates de arquitetura/isolamento 2 arquivos / 31 testes verdes; `git diff` das fronteiras produtivas vazio.
