---
phase: quick-260820-p3u
plan: 1
subsystem: form-validation
tags: [validity, dates, past-date, use-campaign-form, validation]
requires: []
provides:
  - Bloqueio de validade no passado no frontend (until-date/range), antes do fetch/geração
  - Helper determinístico getTodayISO (data local YYYY-MM-DD)
affects: [campaign form submit validation]
tech-stack:
  added: []
  patterns:
    - "Comparação lexicográfica de ISO YYYY-MM-DD (sem new Date() para data de usuário)"
    - "Hoje determinístico nos testes via vi.useFakeTimers({ toFake: ['Date'] }) + vi.setSystemTime"
key-files:
  created: []
  modified:
    - src/components/flow/use-campaign-form.ts
    - src/components/flow/__tests__/use-campaign-form-validity.test.ts
key-decisions:
  - "getTodayISO(now = new Date()) usa getFullYear/getMonth/getDate (fuso LOCAL) — único uso de new Date() no módulo; datas do usuário nunca são parseadas com Date"
  - "todayISO como parâmetro opcional nos validators (default getTodayISO() em runtime) — validateField/handleSubmit/UI/rota intactos"
  - "Checagem de passado SÓ roda quando o modo exige data (until-date/range); today/stock/custom retornam null mesmo com datas preenchidas (draft antigo trocado para custom não bloqueia)"
  - "Ordem das checagens por campo: presença → passado → ordem (range); regra start <= end e mensagem originais preservadas"
  - "Nenhuma mudança de contrato/backend/schema/rota/prompts/copy/reviewer/UI"
requirements-completed:
  - Q-P3U-01
  - Q-P3U-02
duration: 45min
completed: 2026-08-20
---

# Quick: Validação de Data Passada na validade da oferta — Summary

**Datas de validade anteriores a hoje agora bloqueiam o submit no frontend (modos until-date/range) com erro inline por campo, antes de qualquer fetch/geração — usando comparação lexicográfica de ISO e "hoje" determinístico via getTodayISO. Backend, prompts, copy, reviewer e contratos intactos.**

## Performance

- **Duration:** 45 min
- **Tasks:** 2
- **Files modified:** 2 (editados, nenhum criado)

## Accomplishments
- Novo helper exportado `getTodayISO(now = new Date())` → `YYYY-MM-DD` no fuso local (`getFullYear`/`getMonth`/`getDate`), determinístico dado `now`; único uso de `new Date()` no módulo — datas de usuário continuam comparadas por string ISO (padrão D5).
- `validateValidityEndDate` e `validateValidityStartDate` ganharam o parâmetro opcional `todayISO = getTodayISO()` (D4) e a checagem de passado:
  - `until-date` com `validityEndDate < hoje` → `fieldErrors.validityEndDate = "Data final não pode ser anterior à data de hoje"`.
  - `range` com `validityStartDate < hoje` → `"Data inicial não pode ser anterior à data de hoje"`; `validityEndDate < hoje` → `"Data final não ser anterior à data de hoje"`.
  - Igual a hoje (início e/ou fim) é permitido; regra `start <= end` preservada com a mensagem original `"Data inicial não pode ser posterior à data final"`.
  - **Checagem respeita o modo (ajuste aprovado):** só roda em `until-date`/`range`; `today`/`stock`/`custom` retornam `null` mesmo com datas preenchidas (draft antigo trocado para `custom` não bloqueia).
- `validateField`/`handleSubmit`/UI (`ValidityField`)/rota intactos — as mensagens novas fluem pelos canais existentes (fieldErrors + touched + blur), sem mudança de contrato (`validity?: string`).
- 8 testes novos + 1 puro (`getTodayISO`), num describe dedicado com `vi.useFakeTimers({ toFake: ["Date"] })` + `vi.setSystemTime("2026-08-20T12:00:00")` (D1 — fakes apenas de Date, `waitFor` funcional); setup completo (`OFFER_FIELDS` + sessionStorage image + storeId + fetchMock) nos casos de passagem.

## Task Commits

1. **Task 1 (getTodayISO + validators)** — `e0bfac03` (feat)
2. **Task 2 (testes Q-P3U)** — `d6e2e76d` (feat)

**Plan metadata:** commit dos docs (PLAN.md) em etapa separada.

## Files Modified
- `src/components/flow/use-campaign-form.ts` - `getTodayISO` exportado + validators de validade com checagem de passado (respeitando o modo).
- `src/components/flow/__tests__/use-campaign-form-validity.test.ts` - 27 testes verdes (8 novos Q-P3U + 1 getTodayISO + regressão D2/D5).

## Decisions Made
- **D1:** hoje nos testes via `vi.useFakeTimers({ toFake: ["Date"] })` + `vi.setSystemTime` (padrão já usado no repo) — evita mudar a API pública do hook.
- **D2:** `getTodayISO` usa data local (getFullYear/getMonth/getDate) — sem timezone acidental; `new Date()` só para "hoje" no runtime.
- **D3:** ordem das checagens por campo = presença → passado → ordem; no range, ordem só avaliada quando `endDate` está preenchida.
- **D4:** `todayISO` como parâmetro opcional nos validators (default runtime real) — validators puros/testáveis, `validateField`/`handleSubmit` sem mudança.
- **Modo:** checagem de passado restrita a `until-date`/`range` (ajuste aprovado na revisão).

## Deviations from Plan
- Nenhuma mudança de código em relação ao plano aprovado. Único ajuste em teste: no cenário "range com endDate no passado" com `start = hoje`, o erro de ordem (`start > end`) também é emitido em `validityStartDate` — a asserção foi alinhada à validação por campo (ambos os erros exibíveis), conforme regras de negócio.

## Issues Encountered
- `npm` (PowerShell) não roda em pipeline no Windows — usado `npm.cmd` para typecheck/lint.
- ESLint direto em arquivos individuais reporta "File ignored because no matching configuration was supplied" (config flat com globs) — lint válido apenas via `eslint .`.
- Typecheck pegou `afterEach` não importado no teste (corrigido).

## User Setup Required
None - sem configuração externa.

## Next Phase Readiness
- A geração de campanha agora impede validade vencida no frontend, mantendo o contrato da rota (`validity?: string`) e a validação de ordem existente.
- Padrão estabelecido: comparar datas por ISO string + "hoje" via helper injetável/determinístico; reutilizável para outros modos de data.

---
*Phase: quick-260820-p3u*
*Completed: 2026-08-20*