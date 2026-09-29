---
phase: 48.2.3-fidelidade-experimental-bancada
plan: 48-2-3-05
subsystem: lab-bench
tags: [lab, bench, branding, brand-color, experimental-briefing, supabase, vitest]

# Dependency graph
requires:
  - phase: 48.2.3 (planos 48-2-3-01 e 48-2-3-04)
    provides: contrato local de branding (branding-service) e form-rules/snapshot fiel
provides:
  - resolveBenchBrandColor puro com a precedência produtiva exata (1)-(5) e paridade comprovada por teste
  - readBrandProfile alinhado ao único perfil status='synced' (sem fallback por source)
  - Contrato de branding expondo inferredPrimaryColor, storeBrandColor e brandColor resolvido
  - experimental-briefing.ts puro (entrada estruturada do compositor)
affects: [48-2-3-06 prompt-composer, 48-2-3-07 API/UI, 48-2-3-08 verificação]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Resolver puro de paridade: replicar a precedência produtiva e provar igualdade contra resolveStoreIdentity sobre fixtures"
    - "Briefing experimental estruturado como entrada do compositor (não o texto final)"

key-files:
  created:
    - src/lib/lab/bench/domain/resolve-bench-brand-color.ts
    - src/lib/lab/bench/domain/experimental-briefing.ts
    - src/lib/lab/bench/__tests__/resolve-bench-brand-color.test.ts
  modified:
    - src/lib/lab/bench/domain/branding-service.ts
    - src/lib/lab/bench/domain/schemas.ts
    - src/lib/lab/bench/__tests__/branding-service.test.ts

key-decisions:
  - "Resolver cromático replicado em módulo puro próprio (sem editar resolveStoreIdentity); paridade provada por teste que aciona a resolução produtiva sobre fixtures"
  - "Contrato de branding estendido de forma aditiva com inferredPrimaryColor/storeBrandColor/brandColor para cumprir a spec lab-bench-branding (contrato SHALL expor brandColor)"
  - "experimental-briefing recebe branding + snapshot + config e resolve brandColor via resolveBenchBrandColor, reusando formatPriceBRL/sanitizePromptText"

patterns-established:
  - "Paridade cromática: ausência de synced = ausência de perfil; perfil não sincronizado nunca vira baseline"
  - "Briefing puro e determinístico consumindo o contrato de branding local"

requirements-completed:
  - "cap: lab-bench-experimental-briefing"
  - "cap: lab-bench-branding"
  - "D15"
  - "D16"
  - "D5"
  - "spec: lab-bench-experimental-briefing"
  - "spec: lab-bench-branding"
  - "tasks: 5.1, 5.2, 5.3, 5.4"

# Metrics
duration: 5 min
completed: 2026-09-29
---

# Phase 48.2.3 Plan 05: Briefing experimental e resolução cromática fiel

**Resolver cromático puro com paridade comprovada contra o produtivo, loader alinhado ao único perfil synced e briefing experimental estruturado (direção visual + tipografia + brandColor) como entrada do compositor — sem tocar o pipeline produtivo.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-29T18:12:02Z
- **Completed:** 2026-09-29T18:17:25Z
- **Tasks:** 3
- **Files modified:** 6 (3 criados, 3 alterados)

## Accomplishments
- `resolveBenchBrandColor(profile, store)` **puro** reproduzindo exatamente a precedência produtiva efetiva: (1) `brand_colors_chosen[0]` válido → (2) `safe_color_tokens.primary` válido → (3) `inferred_primary_color` válido apenas em `text_only` → (4) `stores.brand_color` → (5) `getDefaultBrandColor(segment)`, com validação `/^#[0-9A-Fa-f]{6}$/`.
- Teste de **paridade** aciona `resolveStoreIdentity` (produtivo, não editado) sobre fixtures e afirma igualdade de `brandColor`, cobrindo precedência, valores inválidos, ausência de synced e perfil não sincronizado.
- `readBrandProfile` alinhado ao **único** `status='synced'` (qualquer `source`, incl. `text_only`); fallback por `source` **removido**.
- `experimental-briefing.ts` **puro** montando o briefing estruturado (direção visual consolidada + `typography_direction` + `brandColor` resolvido + produto/comercial/restrições) como **entrada** do compositor.
- Contrato de branding expõe `inferredPrimaryColor`, `storeBrandColor` e `brandColor` (spec `lab-bench-branding`), com o snapshot persistido atualizado.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: resolveBenchBrandColor puro + teste de paridade** — `147f4690` (test, RED) → `8ad08b41` (feat, GREEN)
2. **Task 2: readBrandProfile único synced + experimental-briefing.ts** — `b6cbc405` (feat)
3. **Task 3: testes de briefing e resolução cromática** — `450afcbe` (test)

**Plan metadata:** commit de SUMMARY (docs)

_Nota: Task 1 seguiu o ciclo TDD (RED → GREEN). Task 3 é test-only (ver desvios)._

## Files Created/Modified
- `src/lib/lab/bench/domain/resolve-bench-brand-color.ts` (novo) — resolver puro com a precedência produtiva exata.
- `src/lib/lab/bench/domain/experimental-briefing.ts` (novo) — briefing estruturado puro (entrada do compositor).
- `src/lib/lab/bench/__tests__/resolve-bench-brand-color.test.ts` (novo) — testes de precedência, paridade e pureza.
- `src/lib/lab/bench/domain/branding-service.ts` — `readBrandProfile` único synced (sem fallback); leitura de `stores.brand_color`; campos cromáticos no contrato.
- `src/lib/lab/bench/domain/schemas.ts` — `BenchBrandingSnapshotSchema` com `inferredPrimaryColor`/`storeBrandColor`/`brandColor` (aditivo).
- `src/lib/lab/bench/__tests__/branding-service.test.ts` — atualização do teste de fallback removido + testes de briefing/brandColor.

## Decisions Made
- Replicar a precedência cromática em módulo puro próprio em vez de extrair um resolver compartilhado de `resolveStoreIdentity` (D16 — não tocar o produtivo).
- Estender `BenchBrandingContract` de forma **aditiva** com os campos necessários à resolução + `brandColor`, pois a spec `lab-bench-branding` exige que o contrato exponha o `brandColor` resolvido.
- `experimental-briefing` resolve o `brandColor` via `resolveBenchBrandColor` a partir dos campos do contrato, reusando `formatPriceBRL`/`sanitizePromptText`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Contrato de branding estendido (aditivo) com campos de cor + snapshot**
- **Found during:** Task 2
- **Issue:** O `BenchBrandingContract` não expunha `brandColor` nem os insumos da resolução (`stores.brand_color`, `inferred_primary_color`). A spec `lab-bench-branding` (fonte da verdade) exige "o contrato local de branding SHALL expor o brandColor resolvido".
- **Fix:** Adicionados `inferredPrimaryColor`, `storeBrandColor` e `brandColor` ao contrato; `PROFILE_COLUMNS` passou a ler `inferred_primary_color`; `loadBenchBranding` lê `stores.brand_color` (somente leitura) e resolve via `resolveBenchBrandColor`; `BenchBrandingSnapshotSchema` (`.strict()`) atualizado de forma aditiva.
- **Files modified:** `src/lib/lab/bench/domain/branding-service.ts`, `src/lib/lab/bench/domain/schemas.ts`
- **Verification:** `npm run typecheck` exit 0; `branding-service.test.ts` verde; campos existentes preservados.
- **Committed in:** `b6cbc405` (Task 2)

**2. [Rule 3 - Blocking] Atualização do teste do fallback removido**
- **Found during:** Task 2
- **Issue:** O teste existente "faz fallback para source without_logo quando não há perfil synced" afirmava o comportamento que o plano manda remover; a verificação da Task 2 exige `branding-service.test.ts` verde.
- **Fix:** O teste passou a afirmar a nova regra (ausência de synced = ausência de perfil; nada do perfil outdated vaza).
- **Files modified:** `src/lib/lab/bench/__tests__/branding-service.test.ts`
- **Verification:** `branding-service.test.ts` verde.
- **Committed in:** `b6cbc405` (Task 2)

**3. [Rule 1 - Bug] Fixture do teste de paridade sem `store_id`**
- **Found during:** Task 1 (GREEN)
- **Issue:** A resolução produtiva consulta por `store_id`; a fixture não injetava o vínculo, fazendo o perfil ser filtrado e a paridade falhar por motivo errado.
- **Fix:** Injeção de `store_id` na fixture dentro do helper de paridade.
- **Files modified:** `src/lib/lab/bench/__tests__/resolve-bench-brand-color.test.ts`
- **Verification:** teste de paridade verde (16 testes).
- **Committed in:** `8ad08b41` (Task 1 GREEN)

---

**Total deviations:** 3 auto-fixed (1 missing critical, 1 blocking, 1 bug)
**Impact on plan:** Todas necessárias para cumprir a spec (fonte da verdade) e manter as verificações verdes; as adições ao contrato são estritamente aditivas e não alteram o produtivo. Sem ampliação de produto/escopo.

## Issues Encountered

- **Task 3 (`tdd="true"`, test-only):** por ser composta apenas por arquivos de teste (sem arquivos-fonte), está isenta do gate MVP+TDD (`is_behavior_adding=false`). Como a implementação já entrou na Task 2, os testes passaram de imediato (sem ciclo RED/GREEN próprio); commitada como `test(...)`.
- **Falha pré-existente do `architecture-guard.test.ts`** (não causada por este plano): `form-rules.ts` (Plano 04) importa `@/lib/campaign/constants`, fora da allowlist `BENCH_ALLOWED_CAMPAIGN_MODULES` (Plano 01). Registrada em `deferred-items.md`; **não** corrigida por pertencer a outro plano.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Resolver cromático e briefing estruturado prontos para o compositor (`48-2-3-06`) e para a API/UI (`48-2-3-07`).
- Produção intocada: `git diff aa972708..HEAD` limitado a 6 arquivos da bancada; `resolveStoreIdentity`, `art-director-briefing.ts` e `BrandProfileSnapshot` sem alterações.
- Pendência herdada (fora do escopo deste plano): allowlist do `architecture-guard.test.ts` (ver `deferred-items.md`).

---
*Phase: 48.2.3-fidelidade-experimental-bancada*
*Completed: 2026-09-29*

## Self-Check: PASSED

- Arquivos criados verificados em disco: `resolve-bench-brand-color.ts`, `experimental-briefing.ts`, `resolve-bench-brand-color.test.ts`, `48-2-3-05-SUMMARY.md`, `deferred-items.md`.
- Commits verificados no histórico: `147f4690`, `8ad08b41`, `b6cbc405`, `450afcbe`.
- `npm run typecheck` exit 0; testes de cor e branding verdes (31 testes).
