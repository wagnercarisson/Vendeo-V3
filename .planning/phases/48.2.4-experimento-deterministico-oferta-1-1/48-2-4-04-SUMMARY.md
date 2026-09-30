---
phase: 48.2.4-experimento-deterministico-oferta-1-1
plan: 48-2-4-04
subsystem: lab-bench
tags: [prompt-composer, branding, identity, deterministic, pure-module, vitest]

# Dependency graph
requires:
  - phase: 48.2.4 (48-2-4-02)
    provides: prompt-composer core (PROMPT_BLOCK_LABELS/BenchPromptBlockLabel, composePromptBlocks) with contributions; identityLines removed from the core
  - phase: 48.2.4 (48-2-4-03)
    provides: versioned default prompt-base (independent; not imported here)
provides:
  - Deterministic minimal branding mapping (always storeName + brandColor; exactly one visual-direction field via campaignBrief → campaignGuidelines → visualStyle → visualTone → brandPersonality)
  - Typography direction in its own [DIREÇÃO TIPOGRÁFICA] block
  - Dedicated identity fidelity orientation contribution ([IDENTIDADE E DIREÇÃO VISUAL]) when a logo/visual_signature reference exists
  - Contract tests for single-visual-field selection, typography separation, determinism, no semantic dedup, and fidelity orientation presence/absence
affects: [48-2-4-06, 48-2-4-07, 48-2-4-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Local structurally-compatible contribution shape to keep wave-2 plans independent (no policies/types import)"
    - "Positional (non-semantic) priority selection — first non-empty of a fixed chain"
    - "Static import-scoped purity proof in contract tests"

key-files:
  created:
    - src/lib/lab/bench/domain/branding-prompt-mapping.ts
    - src/lib/lab/bench/domain/identity-direction.ts
    - src/lib/lab/bench/__tests__/branding-prompt-mapping.contract.test.ts
    - src/lib/lab/bench/__tests__/identity-direction.contract.test.ts
  modified: []

key-decisions:
  - "Declared the contribution return shape locally (BrandingPromptContribution/IdentityDirectionContribution) — structurally compatible with BenchPromptContribution, without importing policies/types.ts (Plan 02 runs in the same wave)"
  - "Visual-direction selection is positional (first non-empty of the fixed chain); never the five fields; no semantic dedup/embedding/AI"
  - "identity-direction.ts takes a BenchIdentityReference | null and returns [] when absent; orientation is faithful-reproduction + secondary + no fixed position, with no invention"
  - "Purity/independence static checks inspect only import lines (doc comments legitimately mention the forbidden module names)"

patterns-established:
  - "Pure branding mapping module consuming BenchExperimentalBriefing"
  - "Dedicated identity contribution module separated from the core and from recorte policies"

requirements-completed:
  - "cap: lab-bench-branding"
  - "cap: lab-bench-identity-transport"
  - "spec: lab-bench-branding"
  - "spec: lab-bench-identity-transport"
  - "D8"
  - "D9"
  - "tasks: 5.1, 5.2, 5.3"

# Metrics
duration: 2min
completed: 2026-09-30
---

# Phase 48.2.4 Plan 04: Mapeamento mínimo de branding e orientação de identidade Summary

**Seleção determinística por prioridade para o bloco de identidade (storeName + brandColor + um único campo de direção visual), tipografia em bloco próprio e contribuição dedicada de reprodução fiel da identidade — módulos puros, sem IA e sem dedup semântica.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-09-30T15:52:16Z
- **Completed:** 2026-09-30T15:54:41Z
- **Tasks:** 3/3
- **Files modified:** 4 created (0 production files edited)

## Accomplishments
- `branding-prompt-mapping.ts` envia **sempre** `storeName` + `brandColor` e **exatamente um** campo de direção visual pela cadeia `campaignBrief → campaignGuidelines → visualStyle → visualTone → brandPersonality` (primeiro não vazio; nunca os cinco).
- `typographyDirection` vai para o bloco próprio `[DIREÇÃO TIPOGRÁFICA]`; os demais campos permanecem apenas na evidência.
- `identity-direction.ts` adiciona ao bloco `[IDENTIDADE E DIREÇÃO VISUAL]` a orientação de reprodução fiel (sem redesenhar/distorcer/completar/reinterpretar/inventar), secundária e sem posição fixa; devolve `[]` sem referência.
- Ambos os módulos são puros/determinísticos, declararam o shape de contribuição localmente e **não** importam `policies/types.ts` nem serviços produtivos.
- 21 testes de contrato verdes; `npm run typecheck` exit 0.

## Task Commits

1. **Task 1: branding-prompt-mapping.ts (seleção determinística por prioridade)** - `14a2c7bd` (feat)
2. **Task 2: identity-direction.ts (orientação de fidelidade da identidade)** - `33dcee37` (feat)
3. **Task 3: testes de contrato (branding + identidade)** - `6f79263d` (test)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `src/lib/lab/bench/domain/branding-prompt-mapping.ts` - Seleção determinística por prioridade; `buildBrandingPromptContributions`, `selectVisualDirection`, `VISUAL_DIRECTION_CHAIN`.
- `src/lib/lab/bench/domain/identity-direction.ts` - Orientação de fidelidade; `buildIdentityDirectionContributions`.
- `src/lib/lab/bench/__tests__/branding-prompt-mapping.contract.test.ts` - 15 testes (um único campo, tipografia, determinismo, ausência de dedup semântica, evidência-only, não-sobreposição).
- `src/lib/lab/bench/__tests__/identity-direction.contract.test.ts` - 6 testes (presença/ausência, fidelidade/secundária/sem posição fixa, pureza, não-sobreposição).

## Decisions Made
- **Shape de contribuição local** em ambos os módulos (sem importar `policies/types.ts`), honrando a independência de onda solicitada no contexto do plano.
- **Seleção posicional** (não semântica): primeiro não vazio da cadeia travada; provada por teste com conteúdo idêntico em dois degraus (posição vence).
- **Orientação de identidade** consome `BenchIdentityReference | null`; `BenchBrandingIdentityReferenceContract` (com `signedUrl`) é estruturalmente compatível.

## Deviations from Plan

### Observação (sem alteração de código)

**1. Referências de linha desatualizadas em `prompt-composer.ts`**
- **Found during:** Leitura inicial (antes da Task 1).
- **Issue:** O plano (seção `<interfaces>`/`<read_first>` e o must_have "O compositor atual (prompt-composer.ts:91-103) deixa de emitir os cinco campos…") descreve `identityLines` em `prompt-composer.ts:91-103`. No código atual esse builder **já não existe** — o Plano 02 (concluído) refatorou o compositor em núcleo neutro e **removeu** `identityLines`, exatamente como previsto no Plano 02.
- **Impacto:** Nenhum. O objetivo (deixar de emitir os cinco campos) **já está satisfeito** por 01/02; a Task 1 cria o mapeamento de branding como módulo novo e self-contained, conforme a `<action>` do plano. Não foi necessário (nem permitido) editar `prompt-composer.ts`.
- **Ação:** Nenhuma edição; divergência apenas documental (referências de linha obsoletas). Não houve improviso — a execução seguiu a `<action>` literal do plano.

### TDD Gate Compliance
- As tasks estão marcadas `tdd="true"`, mas o plano estrutura explicitamente a implementação nas Tasks 1–2 (arquivos de módulo) e os testes na Task 3 (arquivos de teste). A execução seguiu a estrutura do plano (feat → feat → test), sem inversão RED-first por task.
- Commits presentes: `feat(...)` ×2 e `test(...)` ×1. Não há commit `test` anterior ao `feat` correspondente dentro de cada task — comportamento conforme a decomposição do próprio plano.

## Issues Encountered
- Os primeiros rascunhos das verificações estáticas de pureza (nos testes) casavam palavras-chave presentes nos **comentários** dos módulos (`embedding`, `art-director-briefing`). Resolvido escopando as verificações às **linhas de import** — prova de independência mais precisa. Testes verdes após o ajuste (2 arquivos, 21 testes).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `buildBrandingPromptContributions(briefing)` e `buildIdentityDirectionContributions(reference)` prontos para consumo pelos Planos 06 (`preflight-revalidation.ts`) e 07 (`POST /compose`), que já referenciam essas assinaturas.
- Nenhum arquivo produtivo alterado; nenhuma dependência nova; nenhuma chamada de IA.

---
*Phase: 48.2.4-experimento-deterministico-oferta-1-1*
*Completed: 2026-09-30*

## Self-Check: PASSED

- FOUND: src/lib/lab/bench/domain/branding-prompt-mapping.ts
- FOUND: src/lib/lab/bench/domain/identity-direction.ts
- FOUND: src/lib/lab/bench/__tests__/branding-prompt-mapping.contract.test.ts
- FOUND: src/lib/lab/bench/__tests__/identity-direction.contract.test.ts
- FOUND: 14a2c7bd (Task 1)
- FOUND: 33dcee37 (Task 2)
- FOUND: 6f79263d (Task 3)
