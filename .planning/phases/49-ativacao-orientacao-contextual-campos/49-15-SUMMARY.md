---
phase: 49-ativacao-orientacao-contextual-campos
plan: 15
subsystem: ui
tags: [react, nextjs, accessibility, useId, aria-describedby, single-source-of-truth, gap-closure, code-review]

# Dependency graph
requires:
  - phase: 49-ativacao-orientacao-contextual-campos
    provides: "F49 primitivos de orientação, microcopy canônica, revisão do brief, gates e baseline de não-mudança"
provides:
  - "RecommendedBadge consumindo RECOMMENDED_LABEL (fonte única — ME-01)"
  - "Resolução cast-free do tom de voz com aria-describedby condicional (ME-02)"
  - "Ids de grupo/label/helper derivados de useId em CampaignImageUpload e store-identity-form (ME-03)"
  - "Revisão exibindo o texto de informações obrigatórias com trim (LO-03)"
  - "Reexecução dos 4 gates + prova de 59 hashes sem divergência (49-GATES.txt)"
affects: [49-ativacao-orientacao-contextual-campos, code-review-follow-up]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-source microcopy: componentes consomem constantes do módulo field-guidance em vez de literais"
    - "Id estável por instância via useId para label/hint/erro de grupos acessíveis"
    - "Lookup cast-free em Record com guarda de render para valores legados/desconhecidos"

key-files:
  created:
    - .planning/phases/49-ativacao-orientacao-contextual-campos/49-15-SUMMARY.md
  modified:
    - src/components/ui/recommended-badge.tsx
    - src/__tests__/components/ui/recommended-badge.test.tsx
    - src/components/flow/store-identity-form.tsx
    - src/components/flow/campaign-image-upload.tsx
    - src/components/flow/campaign-brief-review.tsx
    - src/components/flow/__tests__/campaign-input-form.orientation.test.tsx
    - .planning/phases/49-ativacao-orientacao-contextual-campos/49-GATES.txt
    - .planning/phases/49-ativacao-orientacao-contextual-campos/49-VERIFICATION.md
    - .planning/ROADMAP.md
    - ROADMAP.md
    - .planning/STATE.md

key-decisions:
  - "ME-02 resolvido com lookup cast-free em Object.entries (sem helper novo no módulo de conteúdo) e guarda dupla (aria-describedby + render) — um tom legado não gera <p> vazio nem id órfão"
  - "ME-03 unificou o id do helper fiscal (LO-04, mesma convenção) sob a mesma correção de useId"
  - "Asserções de ids na suíte de orientação passaram a resolver dinamicamente via aria-labelledby/aria-describedby, eliminando dependência de strings fixas"
  - "Escopo estrito: LO-01, LO-02, LO-05 e a futura melhoria do seletor de tom de voz permaneceram fora"

patterns-established:
  - "Co-migração de asserções de a11y: resolver ids pelo DOM em vez de literais"
  - "Gap closure de review com reexecução de gates e prova de hashes registrada no artefato da fase"

requirements-completed: [contextual-field-help, store-identity-ui, campaign-input-ui, campaign-brief-review]

# Metrics
duration: 10min
completed: 2026-09-18
---

# Phase 49 Plan 15: Gap Closure do Code Review Summary

**Achados ME-01/ME-02/ME-03/LO-03 corrigidos (RECOMMENDED_LABEL na fonte única, lookup cast-free do tom de voz, ids via useId e trim na revisão) com 4 gates verdes, 59/59 hashes sem divergência e tracking F49 em 15/15.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-09-18T19:33:00Z
- **Completed:** 2026-09-18T19:42:23Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- **ME-01:** `RecommendedBadge` deixou de duplicar o literal "Recomendado" e passou a consumir `RECOMMENDED_LABEL` de `@/lib/store-onboarding/field-guidance`; o teste do componente foi co-migrado para importar/assertar a constante (a constante deixou de ser dead code em produção).
- **ME-02:** removido o cast `as StoreToneOfVoice`; a descrição do tom de voz é resolvida por lookup cast-free e `toneDescriptionId`/`FieldHint` só entram quando a descrição existe — valor legado/desconhecido não gera `<p>` vazio nem id órfão no `aria-describedby`.
- **ME-03:** ids de grupo/label/required da imagem (`imageLabelId`/`imageRequiredId`) e do helper fiscal (`fiscalHelperId`) agora derivam de `useId`; os literais `productImages-label`, `productImages-required` e `fiscal-section-helper` foram eliminados e as asserções da suíte de orientação resolvem os ids dinamicamente pelo DOM.
- **LO-03:** a revisão exibe `fields.mandatoryArtworkTextFree.trim()` (mantendo `whitespace-pre-line`), coerente com o gate `hasMandatoryArtworkText` e com o body (`buildMandatoryArtworkText`).
- **Gates + fences:** 4 gates reexecutados verdes (vitest 345 arquivos / 3660 testes + 1 skipped; typecheck/lint/build exit 0), 59/59 hashes protegidos idênticos ao baseline (0 divergências) e diff desde `SHA_INICIAL_F49` sem caminhos proibidos.
- **Tracking:** 7 requirements da F49 marcados `Done ✓`; ambos os roadmaps em 15/15 — Complete; STATE em 15 planos; re-verificação curta anexada a `49-VERIFICATION.md` mantendo `status: passed`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Corrigir ME-01, ME-02, ME-03 e LO-03** — `023b6aaa` (fix)
2. **Task 2: Reexecutar testes, 4 gates e prova de não-mudança** — `89b43bd4` (docs)
3. **Task 3: requirements Done, tracking 15/15 e verificação curta** — `{metadata-commit}` (docs)

## Files Created/Modified

- `src/components/ui/recommended-badge.tsx` — consome `RECOMMENDED_LABEL` (ME-01)
- `src/__tests__/components/ui/recommended-badge.test.tsx` — asserções na constante canônica (ME-01)
- `src/components/flow/store-identity-form.tsx` — lookup cast-free + `aria-describedby`/`FieldHint` condicionais (ME-02) e `fiscalHelperId` via `useId` (ME-03/LO-04)
- `src/components/flow/campaign-image-upload.tsx` — `imageLabelId`/`imageRequiredId`/`imageErrorId` via `useId` (ME-03)
- `src/components/flow/campaign-brief-review.tsx` — exibição com `.trim()` (LO-03)
- `src/components/flow/__tests__/campaign-input-form.orientation.test.tsx` — asserções de ids dinâmicas (ME-03)
- `.planning/phases/49-ativacao-orientacao-contextual-campos/49-GATES.txt` — seção "Reexecução pós-review (49-15)"
- `.planning/phases/49-ativacao-orientacao-contextual-campos/49-VERIFICATION.md` — seção "Re-verificação pós-review (49-15)" (`status: passed`)
- `.planning/ROADMAP.md`, `ROADMAP.md`, `.planning/STATE.md` — requirements `Done ✓` e tracking 15/15

## Decisions Made

- **ME-02:** resolvido inline no componente com `Object.entries(TONE_OF_VOICE_DESCRIPTIONS).find(...)?.[1] ?? null`, sem introduzir helper novo no módulo de conteúdo — mantém o módulo puro e o escopo estrito do plano.
- **ME-03/LO-04:** o id do helper fiscal (`fiscal-section-helper`, achado LO-04 com a mesma raiz) foi corrigido junto de ME-03, pois o plano o inclui explicitamente na tarefa de ids via `useId`.
- **Asserções de a11y:** passaram a resolver o id referenciado no DOM em vez de strings fixas, tornando os testes instance-safe e imunes a mudanças de id.
- **Escopo estrito:** LO-01, LO-02, LO-05 e a futura melhoria do seletor de tom de voz não foram tocados, conforme a constraint do plano.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- F49 fechada em 15/15 com os achados acionáveis do code review endereçados; fences e gates revalidados.
- Follow-up não-bloqueante remanescente: LO-01 (associação de erro do grupo de imagem em elemento não-focável), LO-02 (feedback neutro em amber), LO-05 (inconsistência de label no painel de ajustes) e a melhoria futura do seletor de tom de voz.
- Próximo passo da fase: arquivamento OpenSpec do change e planejamento da próxima fatia F48.x, conforme autorização.

---

*Phase: 49-ativacao-orientacao-contextual-campos*
*Completed: 2026-09-18*

## Self-Check: PASSED

- `49-15-SUMMARY.md` exists on disk.
- Commits `023b6aaa` (Task 1) and `89b43bd4` (Task 2) exist in git history.
- Focused tests: 4 files / 24 tests passed; full suite 345 files / 3660 passed + 1 skipped.
- 4 gates green; 59/59 protected hashes identical (0 divergences); 0 forbidden paths.
