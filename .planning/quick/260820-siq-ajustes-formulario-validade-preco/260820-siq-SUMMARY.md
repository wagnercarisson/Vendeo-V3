---
phase: quick-siq
plan: 01
subsystem: ui
tags: [form, validade, date-mask, dd-mm-aaaa, iso, prompts, image-review]

# Dependency graph
requires:
  - phase: fase-40-campos-comerciais-avisos-brief
    provides: buildValidityDisplayText/formatDDMM + ValidityField presentacional + displayText nu via body.validity
provides:
  - Validade da oferta com ano (dd/mm/aaaa) na arte e no displayText (até 30/09/2026, de 25/09/2026 até 30/09/2026)
  - Input de data mascarado dd/mm/aaaa (text + inputMode numeric) com armazenamento ISO e conversão determinística por string (sem timezone)
  - Validação frontend de data incompleta/inválida (erro genérico) e ordem data inicial <= data final no modo range (bloqueia submit antes do fetch, sem mudar contrato da rota)
  - Erros de data exibidos na UI via props do ValidityField (startDateError/endDateError + blur) integrados em campaign-input-form.tsx
  - Reforço dia/mês/ano nos prompts do diretor (base + offer) e do revisor (buildValidityTextSection)
affects: [fase-43-revisao-brief-pre-geracao, Quick 2 (preco/helper)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Helpers de data determinísticos por string (split/regex), nunca new Date()/timezone (estilo src/lib/changelog/format-date.ts)"
    - "Máscara com draft local + regra anti-ISO-stale: parent atualizado em toda mudança; incompleto/inválido emite '' (nunca mantém ISO antigo)"
    - "Re-sync do draft com prop ISO externa via useEffect com guarda de foco (não sobrescreve digitação em andamento)"
    - "Validação de data por ISO no hook (o hook nunca valida texto mascarado); validação fina de calendário em isValidDateInput no evento do componente"

key-files:
  created:
    - src/components/campaign/__tests__/validity-field.test.tsx
    - src/components/flow/__tests__/campaign-input-form.test.tsx
  modified:
    - src/components/flow/use-campaign-form.ts
    - src/components/campaign/validity-field.tsx
    - src/components/flow/campaign-input-form.tsx
    - src/components/flow/__tests__/use-campaign-form-validity.test.ts
    - prompts/campaign-image-director.md
    - prompts/campaign-image-director-offer.md
    - src/lib/image-generation/services/image-review-service.ts
    - src/lib/image-generation/services/__tests__/image-review-service.test.ts
    - openspec/specs/offer-validity-modes/spec.md

key-decisions:
  - "D1 aprovado: formatDDMM renomeada para formatDateDisplay com ano (DD/MM/AAAA), sem manter o nome antigo (co-migração total)"
  - "D2 aprovado: erro inline genérico 'Informe uma data válida (dd/mm/aaaa)'; hook valida por ISO vazio; validação fina de calendário em isValidDateInput no evento do componente"
  - "D5 aprovado: ordem data inicial <= data final (iguais permitidas) validada no frontend (validateField + submit), comparando apenas quando ambas as datas estão preenchidas (end vazia prioriza erro genérico em validityEndDate)"
  - "startDateError/endDateError tipadas como string | null (não apenas string) para aceitar o ?? null do wiring em campaign-input-form.tsx — ajuste mínimo de tipo exigido pelo typecheck"

patterns-established:
  - "Máscara de data dd/mm/aaaa com draft local + anti-ISO-stale (useDateInput) no ValidityField"
  - "Erro de data inline no padrão do form: p.mt-1.5 flex items-center gap-1.5 text-accent-red text-xs + AlertCircle"

requirements-completed: [Q-SIQ-01, Q-SIQ-02, Q-SIQ-03, Q-SIQ-04]

# Metrics
duration: ~30min
completed: 2026-08-20
---

# Quick 1: Validade/Data — Summary

**Validade da oferta com ano na arte (dd/mm/aaaa), input mascarado dd/mm/aaaa com armazenamento ISO determinístico, validação frontend de data incompleta/inválida e ordem `inicial <= final` (bloqueia submit antes do fetch) e reforço dia/mês/ano nos prompts do diretor e do revisor**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-20T16:40:00Z
- **Completed:** 2026-08-20T17:11:40Z
- **Tasks:** 3
- **Files modified:** 11 (9 modificados + 2 criados)

## Accomplishments
- `formatDDMM` → `formatDateDisplay` (retorno DD/MM/AAAA) + novos helpers puros exportados `formatDateInput`/`parseDateInput`/`isValidDateInput` — conversão determinística por string, sem `new Date()`/timezone (referência: `src/lib/changelog/format-date.ts`)
- Validação de datas no `validateField`/submit: erro genérico "Informe uma data válida (dd/mm/aaaa)" quando o modo exige a data (`until-date`/`range`) e ela está vazia; ordem `data inicial <= data final` no range (iguais permitidas), comparada apenas quando ambas as datas estão preenchidas — bloqueia geração antes de montar `body.validity`, sem mudar contrato da rota
- `ValidityField` reescrito: 3 inputs `type="date"` → `type="text"` + `inputMode="numeric"` + `autoComplete="off"` + `maxLength={10}` + placeholder "dd/mm/aaaa", com draft local (anti-ISO-stale: parent atualizado em toda mudança; incompleto/inválido emite `""`) e re-sync externo com guarda de foco
- Novas props `startDateError`/`endDateError`/`onStartDateBlur`/`onEndDateBlur` renderizando erro inline (AlertCircle + text-accent-red, padrão do form) — integradas em `campaign-input-form.tsx` via `touched`/`fieldErrors`/`handleBlur`
- Prompts do diretor (base + offer) e `buildValidityTextSection` do revisor exigem fidelidade de dia/mês/ano (dd/mm/aaaa); spec `offer-validity-modes` atualizada de dd/mm para dd/mm/aaaa
- Testes: co-migração dd/mm/aaaa + helpers/validação (18), componente da máscara + integração hook→UI (13), revisor (25), regressão pipeline (107) — todos verdes

## Task Commits

Cada task foi commitada atomicamente (code only — sem PLAN/SUMMARY/STATE):

1. **Task 1: Helpers de data + validade com ano + validação de datas (incl. ordem range) no submit** - `b1a20452` (feat)
2. **Task 2: UI — máscara no ValidityField com anti-ISO-stale + integração de erros/blur + testes de componente** - `80d05514` (feat)
3. **Task 3: Reforço dia/mês/ano nos prompts (diretor + revisor) + spec offer-validity-modes** - `c0c1d38c` (feat)

## Files Created/Modified
- `src/components/flow/use-campaign-form.ts` - `formatDateDisplay` (dd/mm/aaaa), helpers `formatDateInput`/`parseDateInput`/`isValidDateInput`, cases `validityStartDate`/`validityEndDate` no validateField (D2/D5); `buildValidityDisplayText` com ano
- `src/components/flow/__tests__/use-campaign-form-validity.test.ts` - co-migrado dd/mm/aaaa + testes novos (round-trip, calendário real, required por modo, start>end bloqueando fetch, iguais permitidas, prioridade de erro)
- `src/components/campaign/validity-field.tsx` - máscara dd/mm/aaaa com draft local (useDateInput), anti-ISO-stale, props de erro/blur, helper text atualizado
- `src/components/flow/campaign-input-form.tsx` - wiring `startDateError`/`endDateError`/`onStartDateBlur`/`onEndDateBlur` ao ValidityField
- `src/components/campaign/__tests__/validity-field.test.tsx` (novo) - sem `type="date"`, placeholder/inputMode, digitação→ISO, anti-stale, re-sync externo, render de erro, blur
- `src/components/flow/__tests__/campaign-input-form.test.tsx` (novo) - integração: erro de `fieldErrors`/`touched` chega à UI via ValidityField REAL (useCampaignForm mockado com `importOriginal`)
- `prompts/campaign-image-director.md` / `prompts/campaign-image-director-offer.md` - reforço: data completa dd/mm/aaaa na arte, não truncar/omitir ano
- `src/lib/image-generation/services/image-review-service.ts` - `buildValidityTextSection` exige fidelidade dia/mês/ano (divergência = reprovação CRÍTICA `illegible_text`)
- `src/lib/image-generation/services/__tests__/image-review-service.test.ts` - 3 testes novos (fidelidade, regressão vazia, sanitização) + fixture 8.20 atualizada
- `openspec/specs/offer-validity-modes/spec.md` - displayText dd/mm → dd/mm/aaaa em tabela e scenarios

## Decisions Made
- Seguido o plano como especificado (D1/D2/D5 já aprovados pelo revisor). Única adaptação de tipo documentada abaixo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tipo das props de erro aceita `string | null`**
- **Found during:** Task 2 (validação de typecheck do wiring)
- **Issue:** o plano especificava `startDateError?: string`/`endDateError?: string`, mas o próprio wiring proposto (`campaign-input-form.tsx:529-541`) passa `fieldErrors.X ?? null` → `string | null`, o que quebraria o typecheck com `?: string`.
- **Fix:** tipadas como `startDateError?: string | null` e `endDateError?: string | null` (comentário no código documentando a origem do valor).
- **Files modified:** src/components/campaign/validity-field.tsx
- **Verification:** `tsc -p tsconfig.typecheck.json --noEmit` limpo.
- **Committed in:** 80d05514 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, ajuste de tipo)
**Impact on plan:** Sem mudança de comportamento ou escopo; apenas o tipo da prop alinhado ao valor efetivamente passado.

## Issues Encountered
- `npm run typecheck`/`npm run lint` via npm não emitiam saída no shell (quirk do wrapper npm no PowerShell 5.1); executados diretamente via `node node_modules/typescript/bin/tsc` e `node node_modules/eslint/bin/eslint.js` — ambos EXIT 0.

## Gates (verificação)

| Gate | Resultado |
|------|-----------|
| `vitest use-campaign-form-validity.test.ts` | ✅ 18 passed |
| `vitest validity-field.test.tsx + campaign-input-form.test.tsx` | ✅ 13 passed |
| `vitest image-review-service.test.ts` | ✅ 25 passed |
| Regressão pipeline (route/brief/brief-mapper/brief-snapshot) | ✅ 107 passed |
| `tsc -p tsconfig.typecheck.json --noEmit` | ✅ limpo |
| eslint . | ✅ limpo |
| Grep `formatDDMM` em src | ✅ zero ocorrências |
| Grep `type="date"` em validity-field.tsx | ✅ zero ocorrências |
| Grep `dd/mm na campanha` em validity-field.tsx | ✅ zero ocorrências |

## Known Stubs
Nenhum — máscara, erros e helper text estão totalmente conectados (sem valores vazios hardcoded, placeholders ou componentes sem fonte de dados).

## Threat Flags
Nenhum — nenhuma superfície nova de rede/auth/arquivo/schema em fronteira de confiança introduzida (validação é client-side no hook; prompts e seção de review são texto).

## Next Phase Readiness
- Validade com ano pronta nos dois modos (até/intervalo) e nas duas superfícies (diretor + revisor).
- Quick 2 (Preço/Helper) pode seguir sem colisão: nenhum arquivo de preço/helper foi tocado (escopo locked respeitado).
- Pendências pós-quick: nenhuma. UAT visual do fluxo de digitação mascarada pode ser feita em conjunto com a verificação humana do Quick 2.

---
*Phase: quick-siq*
*Completed: 2026-08-20*

## Self-Check: PASSED

- 12/12 arquivos criados/modificados confirmados em disco (11 do plano + SUMMARY.md).
- 3/3 commits confirmados no histórico: `b1a20452`, `80d05514`, `c0c1d38c`.
- Gates: vitest focados (18 + 13 + 25), regressão pipeline (107), typecheck limpo, lint limpo, 3 grep gates com zero ocorrências.