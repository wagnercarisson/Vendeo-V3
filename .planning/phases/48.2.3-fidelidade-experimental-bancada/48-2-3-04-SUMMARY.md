---
phase: 48.2.3-fidelidade-experimental-bancada
plan: 48-2-3-04
subsystem: lab
tags: [lab-bench, form-parity, campaign-snapshot, preserveImageContext, vitest]

# Dependency graph
requires:
  - phase: 48.2.3-fidelidade-experimental-bancada
    provides: contrato fiel BenchProduct/BenchOffer (limites 60/120/200 + preserveImageContext) e seams do laboratório (Plano 48-2-3-01)
provides:
  - Módulo puro form-rules.ts com paridade fiel do formulário produtivo (limites, normalização, selo, intenção, validade, avisos, preserveImageContext)
  - Snapshot fiel via mappers produtivos (buildCampaignBriefFromFlat/buildCampaignBriefSnapshot) com intentResolvedFrom
  - Testes explícitos de paridade (matriz de fixtures) e prova de ausência de efeitos produtivos
affects: [48.2.3-fidelidade-experimental-bancada, lab-bench-prompt-preflight, lab-bench-experimental-briefing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Módulo puro de domínio replicando helpers do hook cliente + teste explícito de paridade (D13)"
    - "Snapshot contratual construído pelos mappers produtivos puros (D14)"

key-files:
  created:
    - src/lib/lab/bench/domain/form-rules.ts
    - src/lib/lab/bench/__tests__/form-parity.contract.test.ts
  modified:
    - src/lib/lab/bench/domain/campaign-snapshot.ts

key-decisions:
  - "form-rules.ts replica (não importa) os helpers puros do hook cliente — importá-lo arrastaria o runtime de UI; paridade comprovada por testes (D13)"
  - "Normalização monetária reusa parseCurrencyBRL de formatters, conforme interfaces/PATTERNS/D13"
  - "resolveBenchIntent honra offer.campaignIntent explícito e mantém a inferência por preço promocional (intentResolvedFrom)"
  - "Snapshot expõe preserveImageContext e briefSnapshot (campaign_brief_v1) sem alterar a assinatura de assertBenchCampaignSnapshot"

patterns-established:
  - "Paridade programática: matriz de fixtures comparando o helper da bancada contra o produtivo exportado"

requirements-completed:
  - "cap: lab-bench-form-parity"
  - "cap: lab-generation-bench"
  - "D13"
  - "D14"
  - "spec: lab-bench-form-parity"
  - "spec: lab-generation-bench"
  - "tasks: 4.1, 4.2, 4.3, 4.4, 4.5"

# Metrics
duration: 4min
completed: 2026-09-29
---

# Phase 48.2.3 Plan 48-2-3-04: Paridade do formulário e snapshot fiel Summary

**Módulo puro `form-rules.ts` com paridade fiel do formulário produtivo (limites 60/120/200, imagens 1+3/5MB/tipos, selo, intenção, validade, avisos e `preserveImageContext`) e snapshot construído pelos mappers produtivos com `intentResolvedFrom`, provados por 71 testes de paridade e snapshot.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-09-29T15:04:15Z
- **Completed:** 2026-09-29T15:08:00Z
- **Tasks:** 3/3
- **Files modified:** 3 (2 criados, 1 modificado)

## Accomplishments
- `form-rules.ts` puro (sem JSX/DOM/server-only) reproduz as regras relevantes do formulário produtivo, reusando módulos genuinamente puros e replicando os helpers do hook cliente com comentário explícito de reuso vs replicação.
- `preserveImageContext` implementado fielmente: disponível só em Destaque/Exclusivo, padrão `false` e forçado `false` ao mudar para Oferta.
- `campaign-snapshot.ts` passou a usar `buildCampaignBriefFromFlat`/`buildCampaignBriefSnapshot` (puros), registrando `intentResolvedFrom` e expondo `preserveImageContext` + `briefSnapshot`, mantendo `assertBenchCampaignSnapshot` (`missing_campaign_snapshot`) e o módulo puro.
- `form-parity.contract.test.ts` cobre intenção, normalização monetária, selo, `preserveImageContext`, validade, avisos e limites/roles de imagem, além de comprovar ausência de efeitos produtivos.
- Formulário e hook produtivos (`src/components/flow/**`) **não editados** (verificado por `git diff`).

## Task Commits

Each task was committed atomically:

1. **Task 1: form-rules.ts puro** - `27710d11` (feat)
2. **Task 2: snapshot fiel pelos mappers produtivos** - `97c91886` (feat)
3. **Task 3: testes explícitos de paridade** - `703f4c3b` (test)

**Plan metadata:** (este SUMMARY) — commit de docs ao final.

## Files Created/Modified
- `src/lib/lab/bench/domain/form-rules.ts` - Regras puras fiéis (limites, normalização, selo, intenção, validade, avisos, preserveImageContext); reuso de `formatters`/`constants`/`campaign/constants`/`image-generation/config`; replicação documentada dos helpers do hook.
- `src/lib/lab/bench/domain/campaign-snapshot.ts` - Snapshot via mappers produtivos + `intentResolvedFrom` + `preserveImageContext`/`briefSnapshot`; módulo puro; assinatura de `assertBenchCampaignSnapshot` preservada.
- `src/lib/lab/bench/__tests__/form-parity.contract.test.ts` - Matriz de fixtures de paridade e prova de ausência de efeitos produtivos.

## Decisions Made
- **Replicação em vez de import do hook:** os helpers puros vivem no hook cliente (`"use client"` + React); importá-los acoplaria o runtime de UI ao domínio da bancada (alternativa rejeitada em D13). Foram replicados fielmente e cobertos por teste explícito de paridade.
- **Normalização monetária:** reusa `parseCurrencyBRL` de `@/lib/formatters`, conforme as `<interfaces>` e o PATTERNS §2.
- **`resolveBenchIntent`:** honra `offer.campaignIntent` explícito (`explicit`) e mantém a inferência por preço promocional (`inferred_from_prices`); a assinatura e os resultados do teste existente permanecem estáveis.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Exemplo de normalização monetária inconsistente no plano**
- **Found during:** Task 3 (testes de paridade)
- **Issue:** O `<behavior>` do plano afirma `normalizePriceCents("1.234") → 123400 (…), igual ao produtivo`. Porém `parseCurrencyBRL("1.234")` retorna `123` (trata o último separador como decimal), divergindo do valor citado. Não existe implementação que satisfaça simultaneamente o exemplo literal e o reuso de `parseCurrencyBRL` exigido pelas `<interfaces>`/PATTERNS/D13.
- **Fix:** Mantido o reuso de `parseCurrencyBRL` (instrução concreta e fonte OpenSpec de "normalização idêntica") e ajustada a asserção do teste para a entrada por dígitos `"1234" → 123400` (que corresponde ao valor citado no plano e à paridade com `parseCurrencyBRL`).
- **Files modified:** `src/lib/lab/bench/__tests__/form-parity.contract.test.ts`
- **Verification:** `normalizePriceCents("1234") === 123400` e matriz de paridade `normalizePriceCents(s) === parseCurrencyBRL(s)` verde.
- **Committed in:** `703f4c3b` (Task 3)

---

**Total deviations:** 1 auto-fixed (1 bug/correção de plano)
**Impact on plan:** Sem impacto em produção; a paridade com `parseCurrencyBRL` foi preservada e o valor numérico citado no plano (123400) permanece coberto.

## Issues Encountered
- O comando de verificação `npm run typecheck ; if ($LASTEXITCODE -ne 0) …` produziu falso-negativo neste shell (PowerShell não propaga `$LASTEXITCODE` para o shim `npm`). A verificação real foi executada com `npm.cmd run typecheck`, retornando `EXIT=0`. Nenhuma alteração de código envolvida.
- Nenhum outro problema.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Paridade do formulário e snapshot fiel prontos; base para o briefing experimental e o compositor de prompt (planos seguintes da F48.2.3).
- Produção intocada; nenhuma dependência nova; nenhuma chamada de IA.

---
*Phase: 48.2.3-fidelidade-experimental-bancada*
*Completed: 2026-09-29*

## Self-Check: PASSED

- FOUND: `src/lib/lab/bench/domain/form-rules.ts`
- FOUND: `src/lib/lab/bench/__tests__/form-parity.contract.test.ts`
- FOUND: `.planning/phases/48.2.3-fidelidade-experimental-bancada/48-2-3-04-SUMMARY.md`
- FOUND: commits `27710d11`, `97c91886`, `703f4c3b`
- typecheck exit 0; 71 testes verdes (2 arquivos); `src/components/flow/**` intocado.
