---
phase: 49-ativacao-orientacao-contextual-campos
plan: 09
subsystem: testing
tags: [vitest, fences, art-director, copy-director, brief-review, identity, f49, d8, d11, d12, d15]

# Dependency graph
requires:
  - phase: 49-ativacao-orientacao-contextual-campos
    provides: 49-05/49-06 campos da campanha + revisão separável; 49-02 módulos puros de conteúdo; 49-08 correspondência preço/tom
provides:
  - "Fence em runtime do Diretor de Arte: `product.description` chega ao `CopyDirectorInput` e não aparece nas 7 seções do briefing"
  - "Não-mudança comportamental de body/snapshot/transporte (`buildMandatoryArtworkText` 4 combinações, snapshot `campaign_brief_v1`, `inferIntent`)"
  - "Categorias separáveis da revisão do brief provadas nos 4 casos (ambos / só aviso / só obrigatórias / nenhum) com quebras de linha preservadas"
  - "Correspondência da microcopy de identidade × consumidores reais (copy direto + perfil/direção visual indireto)"
affects: [49-12, 49-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fence de pipeline provada em runtime importando as funções reais (mapper de copy + seções do diretor) — sem reimplementação da lógica"
    - "Guarda de correspondência por leitura de fonte (`readFileSync` relativo a `process.cwd()`) para consumidores indiretos não observáveis em runtime puro"
    - "Revisão testada por derivação de `fields` (não do texto concatenado) com query de parágrafo por rótulo"

key-files:
  created:
    - src/components/flow/__tests__/phase49-fences.test.ts
    - src/components/flow/__tests__/campaign-brief-review.orientation.test.tsx
  modified: []

key-decisions:
  - "A fence do Diretor de Arte asserta a ausência do sentinela em TODAS as 7 seções exportadas, além da presença no CopyDirectorInput — prova explícita da separação copy × arte (T-49-06)"
  - "A correspondência indireta (perfil/direção visual) é provada por leitura de fonte dos 4 módulos reais, pois o efeito não é observável em runtime puro sem chamada de IA"
  - "O caso 'só informações obrigatórias' asserta `whitespace-pre-line` + `textContent` com `\\n` preservado, e ausência do aviso ilustrativo"

patterns-established:
  - "Guarda de fonte para contrato de microcopy ↔ consumidor de IA sem executar o pipeline (fonte única + correspondência)"

requirements-completed: [campaign-brief-review, contextual-field-help, campaign-field-orientation]

# Metrics
duration: 3 min
completed: 2026-09-18
---

# Phase 49 Plan 09: Fences do Diretor de Arte e Categorias Separáveis da Revisão Summary

**Fence em runtime prova que `product.description` chega ao copy e nunca ao briefing do Diretor de Arte; a revisão do brief exibe aviso ilustrativo e informações obrigatórias como itens separáveis nos 4 casos; e a microcopy de identidade corresponde aos consumidores reais (copy direto + perfil/direção visual indireto) — 17 testes verdes, nenhum arquivo de produção alterado**

## Performance

- **Duration:** 3 min
- **Started:** 2026-09-18T19:52:18Z
- **Completed:** 2026-09-18T19:55:00Z
- **Tasks:** 3
- **Files modified:** 2 (ambos criados; nenhum arquivo de produção alterado)

## Accomplishments
- **Task 1 — Fence do Diretor de Arte (7.10) + não-mudança (7.11):** `mapBriefToCopyDirectorInput(brief, context, {}).description === SENTINELA` (a descrição chega ao copy) e o sentinela está **ausente** nas 7 seções do diretor (`campaignFactsSection`, `commercialDetailsSection`, `buildCommercialRepertoire`, `productReferenceSection`, `constraintsSection`, `creativeDirectionSection`, `identityReferenceSection`). `buildMandatoryArtworkText` assertado nas 4 combinações exatas; `snapshot.schemaVersion === "campaign_brief_v1"` com `snapshot.product.description === SENTINELA`; `inferIntent(10000, 8000) === "offer"`.
- **Task 2 — Categorias separáveis da revisão (7.8):** quatro casos da seção Avisos — ambos (dois itens rotulados distintos, cada natureza no seu próprio parágrafo), só aviso (sem `MANDATORY_ARTWORK_LABEL`), só informações obrigatórias (sem `ILLUSTRATIVE_NOTICE_TEXT`, com `whitespace-pre-line` e `\n` preservado nos três itens) e nenhum (`"Sem avisos adicionais."`). Rótulos `"Preço anterior"`/`"Preço de venda"` e validade em item próprio assertados.
- **Task 3 — Microcopy de identidade × consumidores reais (7.9, terceira parte):** os 5 campos de identidade (`storeName`, `toneOfVoice`, `positioning`, `shortDescription`, `slogan`) chegam ao `CopyDirectorInput`; o tom de voz chega a `campaignFactsSection` e, ausente, usa o default `"profissional"`; os 4 módulos reais de perfil/direção visual (`brand-director.ts`, `brand-profiler.ts`, `text-only-inference-service.ts`, `identity-art-director.ts`) referenciam `tone_of_voice:`, `positioning:`, `short_description:` e `slogan:` nos seus mapas de variáveis de prompt (guarda por leitura de fonte).
- **Fences de não-mudança:** nenhum arquivo de produção alterado; `prompts/**`, `src/lib/ai/**`, `src/lib/campaign/brief*.ts`, `use-campaign-form.ts`, rotas e DB/storage intactos.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fence do Diretor de Arte e não-mudança de body/snapshot** - `7a593b5a` (test)
2. **Task 2: Categorias separáveis da revisão do brief** - `76d60020` (test)
3. **Task 3: Correspondência da microcopy de identidade × consumidores reais** - `9e79cf79` (test)

**Plan metadata:** (commit de docs deste plano — SUMMARY + STATE/ROADMAP + OpenSpec tasks.md)

## Files Created/Modified
- `src/components/flow/__tests__/phase49-fences.test.ts` - Fence do Diretor de Arte + não-mudança de body/snapshot/transporte + correspondência da microcopy de identidade × consumidores reais (12 testes)
- `src/components/flow/__tests__/campaign-brief-review.orientation.test.tsx` - Categorias separáveis da revisão do brief nos 4 casos + rótulos de preço/validade (5 testes)

## Decisions Made
- A fence do Diretor de Arte asserta a ausência do sentinela em **todas** as 7 seções exportadas, além da presença no `CopyDirectorInput` — evita vazamento acidental entre estágios do pipeline (T-49-06).
- A correspondência indireta (perfil/direção visual) é provada por leitura de fonte dos 4 módulos reais, pois o efeito não é observável em runtime puro sem chamada de IA; a guarda falha se um consumidor deixar de referenciar o campo.
- O caso "só informações obrigatórias" usa `p.whitespace-pre-line` como âncora e asserta `textContent` com `\n` (matcher que respeita quebras), em vez de depender da normalização de whitespace do Testing Library.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- O ambiente jsdom emite o aviso `Not implemented: Window's scrollTo() method` ao renderizar a revisão (a `useEffect` de scroll no topo). É um aviso conhecido do jsdom, já presente na suíte existente de `campaign-brief-review.test.tsx`; não afeta o resultado (5/5 verde).

## User Setup Required
None - no external service configuration required.

## Verification Evidence
- `npx vitest run src/components/flow/__tests__/phase49-fences.test.ts src/lib/campaign/__tests__/brief-snapshot.test.ts src/lib/campaign/__tests__/prompt-reframe.test.ts` → **3 files / 28 tests passed** (Task 1; goldens existentes verdes).
- `npx vitest run src/components/flow/__tests__/campaign-brief-review.orientation.test.tsx` → **1 file / 5 tests passed** (Task 2).
- `npx vitest run src/components/flow/__tests__/phase49-fences.test.ts` → **1 file / 12 tests passed** (Task 3).
- Plan-level: `npx vitest run src/components/flow/__tests__/phase49-fences.test.ts src/components/flow/__tests__/campaign-brief-review.orientation.test.tsx` → **2 files / 17 tests passed**.
- `npx tsc -p tsconfig.typecheck.json --noEmit` → exit 0.
- `git diff --name-only 83a0d490..HEAD` → apenas os 2 arquivos de teste; `git status --short` → apenas o untracked pré-existente `docs/alinhamento-fase-44-temas-de-campanhas` preservado.

## Next Phase Readiness
- Fence do Diretor de Arte, não-mudança de body/snapshot/transporte, categorias separáveis da revisão e correspondência da microcopy de identidade × consumidores reais provadas. Pronto para 49-10/49-11 (co-migração), 49-12 (regressão + 4 gates) e 49-13 (UAT).
- **Rastreabilidade OpenSpec:** item **7.9** fechado nesta Task 3 (terceira parte); **7.8/7.10/7.11** fechados neste plano. Progresso OpenSpec neste ponto: **39/50**.
- Sem blockers.

## Self-Check: PASSED

---
*Phase: 49-ativacao-orientacao-contextual-campos*
*Completed: 2026-09-18*
