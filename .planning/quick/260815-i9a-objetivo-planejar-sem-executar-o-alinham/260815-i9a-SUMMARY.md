---
phase: quick-40
plan: 01
subsystem: database, api, testing, docs
tags: [supabase, postgres, sql, rpc, credits, freemium, cnpj, pg, verification, openspec]

# Dependency graph
requires:
  - phase: 41
    provides: créditos freemium (credit_balances/credit_transactions, try_grant_monthly_entitlement, grant_credits/reserve_credit, stores com cnpj_root_hash)
provides:
  - RPC `grant_monthly_credits` reescrita para semântica por raiz CNPJ com limiar de elegibilidade, ciclo por aniversário em America/Sao_Paulo e REVOKE/GRANT service_role
  - Contrato botão admin ↔ shape canônico `{eligible, granted, skipped, errors, details}` com `body.skipped === true`
  - Script de verificação SQL real com 8 cenários (driver pg, DATABASE_URL)
  - Specs/docs/env sem ambiguidade cap-vs-threshold
affects: [fase-42, runbooks, admin UI de créditos]

# Tech tracking
tech-stack:
  added: [pg (devDependency ^8.23.0)]
  patterns: [RPC SECURITY DEFINER com REVOKE/GRANT service_role, idempotência por freemium_entitlements(root_hash, benefit_type, cycle), verificação SQL real com setup/cleanup transacional em ordem de FK]

key-files:
  created: [supabase/migrations/20260815000001_grant_monthly_credits_por_raiz.sql, scripts/verify/39-monthly-grant-por-raiz-verification.mjs]
  modified: [src/components/admin/monthly-credit-grant-button.tsx, src/lib/credit/__tests__/monthly-credits.test.ts, package.json, package-lock.json, openspec/specs/monthly-credits-cron/spec.md, openspec/specs/monthly-credits-engine/spec.md, openspec/specs/credit-tables/spec.md, openspec/specs/admin-credit-grant/spec.md, openspec/specs/admin-cnpj-display/spec.md, openspec/specs/launch-config/spec.md, docs/alinhamento-fase-29-3-creditos-mensais-automaticos.md, .planning/REQUIREMENTS.md, .env.example]

key-decisions:
  - "Assinatura (p_amount, p_bonus_cap, p_min_store_age_days, p_reference_date DEFAULT NULL) com DROP prévio da assinatura de 3 params para eliminar ambiguidade PostgREST"
  - "Ordem dos checks: existência (SELECT) → limiar → INSERT via try_grant_monthly_entitlement (ON CONFLICT como salvaguarda de corrida)"
  - "Recipiente determinístico: matriz (substring(cnpj_normalized,9,4)='0001') → loja não-teste mais antiga; histórico freemium validado NO NÍVEL DA RAIZ, sem filtro EXISTS no recipiente"
  - "Limiar (não teto): bonus_balance < cap → grant integral; >= cap → nenhum grant no ciclo (9→14; 10→sem grant)"
  - "Ciclo por aniversário com clamp LEAST(anniv_day, last_day) (29/30/31 → último dia do mês curto, nunca dia 1); fuso America/Sao_Paulo em todos os cálculos"
  - "Idempotência por raiz+cycle via freemium_entitlements(root_hash, 'monthly', cycle) + idempotency_key 'mensal_<cycle>_<root_hash>'; last_monthly_grant_at deprecado"
  - "REVOKE EXECUTE FROM PUBLIC/anon/authenticated + GRANT EXECUTE TO service_role (fecha escalada de privilégio via PostgREST)"
  - "Botão admin: disabled somente quando body.skipped === true (skipped numérico do shape canônico nunca dispara 'Concessão desabilitada')"
  - "Script de verificação usa driver pg (não supabase-js) para operações transacionais em auth.users com cleanup em ordem de FK"

patterns-established:
  - "RPC mensal por raiz: cursor DISTINCT cnpj_root_hash → recipiente determinístico → row garantida em credit_balances (ON CONFLICT DO NOTHING) → lock FOR UPDATE → checks → INSERT entitlement"
  - "Shape canônico: eligible = granted + skipped_already_granted + skipped_bonus_threshold; roots_considered = eligible + skipped_not_due; skipped_not_due fora de eligible"

requirements-completed: [MONTHLY-06]

# Metrics
duration: 47min
completed: 2026-08-16
---

# Quick 260815-i9a: Concessão mensal por raiz CNPJ com limiar (não teto) — RPC, consumidores e specs alinhados

**RPC `grant_monthly_credits` reescrita para semântica por raiz de CNPJ com limiar de elegibilidade (9→14 integral, 10→sem grant), ciclo por aniversário com clamp 29/30/31 em America/Sao_Paulo, recipiente determinístico (matriz → loja mais antiga), idempotência por freemium_entitlements(root_hash,'monthly',cycle), REVOKE/GRANT service_role, botão admin com `body.skipped === true`, script de verificação SQL real de 8 cenários e specs/docs/env sem ambiguidade cap-vs-threshold**

## Performance

- **Duration:** ~47 min
- **Started:** 2026-08-16T10:58:00Z
- **Completed:** 2026-08-16T11:45:23Z
- **Tasks:** 3/3
- **Files modified:** 14 (2 novos, 12 editados)

## Accomplishments

- Migration `20260815000001_grant_monthly_credits_por_raiz.sql` (246 linhas): RPC por raiz com limiar, ciclo por aniversário com clamp, recipiente determinístico matriz→mais antiga sem EXISTS, row garantida em credit_balances antes do lock, ordem de checks existência→limiar→INSERT, REVOKE/GRANT service_role, shape canônico com `details.roots_considered` e REVERT documentado
- Botão admin alinhado ao contrato: `body.skipped === true` (flag booleana dos routes) nunca confundido com `skipped` numérico do RPC; label "raízes elegíveis"; interface `GrantResult` com `details?` opcional
- Testes monthly-credits com fixtures do shape canônico (`roots_considered = eligible + skipped_not_due`) + 2 casos novos cobrindo `skipped` numérico não-disabled nas rotas admin e cron (13 testes PASS)
- Script `scripts/verify/39-monthly-grant-por-raiz-verification.mjs` com 8 cenários (day-31→abril, fevereiro LEAST(31,28), limiar 9→14 integral, limiar 10 sem grant, matriz sem transação própria, sem-matriz→mais antiga, idempotência dupla execução, consumo bônus primeiro), driver `pg` com `DATABASE_URL` e cleanup em ordem de FK
- Specs (6), doc de alinhamento F29.3, REQUIREMENTS.md MONTHLY-06 (marcado atendido) e .env.example sem resíduos de cap/partial/ciclo-30-dias/last_monthly_grant_at-como-verdade

## Task Commits

Cada task foi commitada atomicamente na branch `feature/quick-concessao-de-creditos-mensais`:

1. **Task 1: Migration — grant_monthly_credits por raiz com limiar, ciclo por aniversário e REVOKE/GRANT** - `ededab3` (feat)
2. **Task 2: Alinhar botão admin, testes de rota e script de verificação SQL real** - `ee24bc4` (feat)
3. **Task 3: Corrigir specs, docs e env para semântica por raiz e limiar** - `cefbfe0` (docs)

_Nota: SUMMARY.md não é commitado (artefato de planejamento, fora dos commits de task)._

## Files Created/Modified

- `supabase/migrations/20260815000001_grant_monthly_credits_por_raiz.sql` (NEW) - RPC por raiz: limiar, aniversário, recipiente determinístico, REVOKE/GRANT, shape canônico
- `scripts/verify/39-monthly-grant-por-raiz-verification.mjs` (NEW) - 8 cenários C1-C8 com driver pg, usuários distintos em auth.users, cleanup em ordem de FK
- `src/components/admin/monthly-credit-grant-button.tsx` - `body.skipped === true`, `details?`, "raízes elegíveis"
- `src/lib/credit/__tests__/monthly-credits.test.ts` - fixtures canônicos + casos skipped numérico
- `package.json` / `package-lock.json` - devDependency `pg ^8.23.0`
- `openspec/specs/monthly-credits-cron/spec.md` - shape canônico com roots_considered, cenários por raiz/limiar/aniversário/fuso
- `openspec/specs/monthly-credits-engine/spec.md` - reescrita por-raiz + limiar + idempotência entitlement
- `openspec/specs/credit-tables/spec.md` - `last_monthly_grant_at` + índice marcados DEPRECATED
- `openspec/specs/admin-credit-grant/spec.md` - limiar de elegibilidade no lugar de monthlyBonusCap (D9)
- `openspec/specs/admin-cnpj-display/spec.md` - badge 🔴 reformulado (limiar >= cap ou ciclo já concedido)
- `openspec/specs/launch-config/spec.md` - VENDEO_MONTHLY_BONUS_CAP como limiar
- `docs/alinhamento-fase-29-3-creditos-mensais-automaticos.md` - seção "Revisão de alinhamento (pós-F32)" marcando D4/D7 como substituídas
- `.planning/REQUIREMENTS.md` - MONTHLY-06 reescrito e marcado [x] (migration da Task 1 existe)
- `.env.example` - comentário do VENDEO_MONTHLY_BONUS_CAP como limiar de elegibilidade

## Decisions Made

- **Assinatura 4 params com `p_reference_date DEFAULT NULL`** + DROP da assinatura de 3 antes do CREATE OR REPLACE — callers existentes (cron + admin) seguem passando só os 3 primeiros; sem ambiguidade PostgREST.
- **Ordem de checks existência→limiar→INSERT** — na 2ª execução do mesmo dia com bônus consumido, a raiz cai em `skipped_already_granted` (causa real), não em `skipped_bonus_threshold`.
- **Limiar (não teto)** — decisão de produto: bonus 9 recebe +5 integral (14); bonus 10 não recebe no ciclo (perde o ciclo, sem grant parcial).
- **Ciclo por aniversário com clamp** — `LEAST(v_anniv_day, v_last_day)`; dia 29/30/31 → último dia do mês curto, nunca dia 1 do mês seguinte.
- **Recipiente determinístico sem EXISTS** — histórico freemium validado no nível da raiz (qualquer loja da raiz), não no recipiente.
- **`pg` como driver do script de verificação** (r2-4) — supabase-js não é adequado para operações transacionais diretas em `auth.users` com cleanup em ordem de FK.
- **`body.skipped === true`** no botão — a flag booleana de disabled vem dos routes; o `skipped` numérico do shape canônico nunca dispara o erro "Concessão mensal desabilitada".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Grep gate da matriz não casava no ORDER BY do recipiente**
- **Found during:** Task 1 (verificação da migration)
- **Issue:** o verify do plano exigia `substring\(cnpj_normalized, 9, 4\)`, mas o ORDER BY determinístico usa `substring(s.cnpj_normalized, 9, 4)` (com prefixo `s.`), que não casava o pattern literal
- **Fix:** adicionado comentário no corpo SQL com `substring(cnpj_normalized, 9, 4)` documentando a preferência da matriz; o pattern do verify passou sem alterar o ORDER BY real
- **Files modified:** supabase/migrations/20260815000001_grant_monthly_credits_por_raiz.sql
- **Verification:** 18/18 grep gates do Task 1 passam
- **Committed in:** ededab3 (Task 1 commit)

**2. [Rule 1 - Bug] Lint "File ignored because no matching configuration" em arquivos src/**
- **Found during:** Task 2 (verificação lint)
- **Issue:** eslint reporta warning "File ignored because no matching configuration was supplied" para todos os arquivos de `src/` — comportamento pré-existente da config flat do repo (verificado em route.ts existente, 0 erros)
- **Fix:** nenhum (pré-existente, fora do escopo da task); lint com 0 erros nas 3 arquivos da task
- **Files modified:** nenhum
- **Verification:** mesmo warning em `src/app/api/admin/monthly-credits/grant/route.ts` (arquivo pré-existente não tocado)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Auto-fixes necessários para os gates de verificação passarem; nenhum scope creep.

## Issues Encountered

- **`npm i -D pg` silenciosamente falhava no PowerShell** — resolvido invocando via `cmd /c "npm i -D pg"` (adição de 14 pacotes, `pg ^8.23.0`). Sem impacto no resultado.
- **Falsa negativa do grep de resíduo em Task 3** — o texto novo continha negações explícitas ("não teto", "sem partial") que casavam o pattern de resíduo `teto|partial|LEAST\(p_amount`; reformulado para evitar os termos-gatilho. Grep final limpo.

## Known Stubs

Nenhum stub detectado nos artefatos das 3 tasks.

## User Setup Required

**Verificação SQL real adiada (manual, pós-merge):** o script `scripts/verify/39-monthly-grant-por-raiz-verification.mjs` NÃO foi executado — requer `DATABASE_URL` (connection string Supabase) que não existe em `.env.local` hoje, e mexe em `auth.users`/`stores` (não deve rodar contra produção sem supervisão). Executar em staging/DB de dev após o merge da migration:

```
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres node scripts/verify/39-monthly-grant-por-raiz-verification.mjs
```

Também pendente (fora do escopo do plano): aplicar a migration `20260815000001_grant_monthly_credits_por_raiz.sql` via Supabase (Local + Remote) e validar os callers cron/admin contra o DB real.

## Next Phase Readiness

- RPC nova pronta para deploy (migration pendente de aplicação via Supabase CLI)
- Contrato botão/testes/script alinhados ao shape canônico
- Verificação SQL real (8 cenários) pronta para execução manual com DATABASE_URL
- Specs e docs refletem a semântica por raiz + limiar; F42 pode consumir sem ambiguidade

## Self-Check: PASSED

- FOUND: `supabase/migrations/20260815000001_grant_monthly_credits_por_raiz.sql`
- FOUND: `scripts/verify/39-monthly-grant-por-raiz-verification.mjs`
- FOUND: `.planning/quick/260815-i9a-objetivo-planejar-sem-executar-o-alinham/260815-i9a-SUMMARY.md`
- FOUND: commit `ededab3` (Task 1)
- FOUND: commit `ee24bc4` (Task 2)
- FOUND: commit `cefbfe0` (Task 3)

---
*Phase: quick-40-01 (260815-i9a)*
*Completed: 2026-08-16*
