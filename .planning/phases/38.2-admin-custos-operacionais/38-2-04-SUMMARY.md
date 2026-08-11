---
phase: 38.2-admin-custos-operacionais
plan: 04
subsystem: api
tags: [economic-parameters, admin, api-route, zod, supabase-rpc, idempotency, vitest]

# Dependency graph
requires:
  - phase: 38.2-admin-custos-operacionais (plan 38-2-02)
    provides: "EconomicParameterService.getAll() server-only + EconomicParameterResolution (key/value/source) + EconomicParameterUnavailableError → 503 + ECONOMIC_PARAMETER_KEYS enum"
  - phase: 38.2-admin-custos-operacionais (plan 38-2-01)
    provides: "RPC admin_set_economic_parameter (SECURITY DEFINER, transacional, idempotência por operation_id) + tabela economic_parameters no remoto"
  - phase: 38-1-ai-cost-accounting
    provides: "padrão de rota admin (ai-costs/ai-model-pricing): apiHandler + requireAdmin + zod + supabaseAdmin.rpc"
provides:
  - "GET /api/admin/economic-parameters — lista resolvida via EconomicParameterService.getAll() com source table/fallback (200/403/503 fail-closed)"
  - "PUT /api/admin/economic-parameters — zod UpdateEconomicParameterRequestSchema + RPC admin_set_economic_parameter com p_actor_id; 200 { parameter, auditId, updatedAt, idempotent } / 400 / 403 / 500"
  - "UpdateEconomicParameterRequestSchema em src/lib/admin/schemas.ts (key enum ECONOMIC_PARAMETER_KEYS, value > 0, reason obrigatório, operationId uuid opcional)"
  - "9 testes da rota (tarefa 12.2 — 5 cenários exigidos + 4 extras) — sem endpoint público"
affects: [38-2-07 admin-operation-costs UI (página /admin/operation-costs "Configurações Econômicas" consome GET/PUT), 38-2-10 verificacao]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rota admin GET: apiHandler + requireAdmin + service server-only com try/catch fail-closed (EconomicParameterUnavailableError → 503) — padrão ai-costs/operation-costs"
    - "Rota admin PUT: requireAdmin retorna { userId } → p_actor_id; supabaseAdmin.rpc('admin_set_economic_parameter', { p_actor_id, p_key, p_value, p_reason, p_operation_id }) — única via de escrita (padrão financeiro F38)"
    - "zod safeParse no body → 400 { error: 'Dados inválidos', details: parsed.error.errors }"
    - "Teste de rota: vi.mock('@/lib/admin/require-admin') + vi.mock('@/lib/supabase/server') (rpc) + vi.mock do service — padrão operation-costs/__tests__/route.test.ts"

key-files:
  created:
    - "src/app/api/admin/economic-parameters/route.ts"
    - "src/app/api/admin/economic-parameters/__tests__/route.test.ts"
  modified:
    - "src/lib/admin/schemas.ts"

key-decisions:
  - "PUT usa safeParse (não parse try/catch ZodError) para 400 único { error: 'Dados inválidos', details } — body malformado (json().catch(() => null)) também cai em 400 zod"
  - "p_operation_id repassado como null quando operationId ausente (RPC DEFAULT NULL) — idempotência só quando o cliente envia operation_id"
  - "200 do PUT mapeia o JSONB do RPC para camelCase { parameter: { key, value }, auditId, updatedAt, idempotent } (contrato D2 da UI)"

patterns-established:
  - "Pattern 1: rota admin de parâmetro econômico — GET lê via EconomicParameterService (server-only, fail-closed 503), PUT escreve exclusivamente via RPC SECURITY DEFINER com actor_id e motivo obrigatório"
  - "Pattern 2: testes de rota admin com 3 mocks independentes (require-admin, supabase/server rpc, service) — verifica payload exato do RPC via toHaveBeenCalledWith"

requirements-completed: [F38.2-05, F38.2-06]

# Metrics
duration: 6min
completed: 2026-08-10
---

# Phase 38.2 Plan 04: API Configurações Econômicas GET/PUT Summary

**API admin completa dos parâmetros econômicos (D2): GET lista resolvida com source (200/403/503 fail-closed via EconomicParameterService) + PUT via RPC admin_set_economic_parameter com zod (key enum, value>0, reason obrigatório, operationId idempotente) e auditoria — 9 testes da rota, sem endpoint público**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-10T21:24:49Z
- **Completed:** 2026-08-10T21:31:15Z
- **Tasks:** 3
- **Files modified:** 3 (2 criados, 1 modificado)

## Accomplishments
- `UpdateEconomicParameterRequestSchema` em `src/lib/admin/schemas.ts` (D2): `key: z.enum(ECONOMIC_PARAMETER_KEYS)` (enum TS versionado de `@/lib/economic/types`), `value: z.number().positive("Value deve ser maior que zero")` (espelha o CHECK value > 0 do banco — T-38.2-15), `reason: z.string().min(1, "Motivo obrigatório")`, `operationId: z.string().uuid().optional()` (idempotência — T-38.2-16). Schemas existentes intactos; typecheck limpo
- `GET /api/admin/economic-parameters` (route.ts): `apiHandler` + `requireAdmin()` (403 sem admin via ForbiddenError → apiHandler), `new EconomicParameterService().getAll()` → `200 { parameters: [{ key, value, source }] }`; `EconomicParameterUnavailableError` → `503 { error: "economic_parameters_unavailable" }` (fail-closed, T-38.2-18); NENHUM parâmetro de query/body — leitura pura; **sem endpoint público** (rota exclusivamente sob `/api/admin/` — T-38.2-17)
- `PUT /api/admin/economic-parameters` (mesma route.ts): `request.json().catch(() => null)` + `UpdateEconomicParameterRequestSchema.safeParse` → 400 `{ error: "Dados inválidos", details }`; RPC `admin_set_economic_parameter` com `p_actor_id: admin.userId` (actor do requireAdmin), `p_key`, `p_value`, `p_reason`, `p_operation_id: operationId ?? null`; sucesso → `200 { parameter: { key, value }, auditId, updatedAt, idempotent }` do JSONB do RPC; erro do RPC → `500 { error: "economic_parameter_update_failed" }` com log server-side (sem vazar reason — reason já vai para a audit table); idempotência por operation_id repassada no 200
- `src/app/api/admin/economic-parameters/__tests__/route.test.ts`: **9 testes** (3 GET + 6 PUT) — cobrem os 5 cenários exigidos da tarefa 12.2 (PUT atualiza via RPC + audit; sem reason/key inválido/value <= 0 → 400; GET/PUT sem admin → 403; idempotência por operation_id) + extras (reason vazio, value negativo, 503 fail-closed, payload exato do RPC via toHaveBeenCalledWith)
- Threat model atendido: T-38.2-14 (PUT sem admin → requireAdmin + RPC service_role-only), T-38.2-15 (zod key/value/reason), T-38.2-16 (idempotência por operation_id repassada), T-38.2-17 (rota só sob /api/admin, nenhuma pública), T-38.2-18 (503 fail-closed), T-38.2-SC (nenhum pacote instalado)

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema UpdateEconomicParameterRequestSchema (D2)** - `f87cc6b` (feat)
2. **Task 2: GET /api/admin/economic-parameters (D2)** - `0337e5e` (test RED) + `e3e9d9f` (feat GREEN)
3. **Task 3: PUT /api/admin/economic-parameters (D2) + 5 testes da API (12.2)** - `b11a1d2` (test RED) + `2ddcc08` (feat GREEN)

**Plan metadata:** (docs: complete plan — commit ao final)

## Files Created/Modified
- `src/lib/admin/schemas.ts` - +`UpdateEconomicParameterRequestSchema` (key enum, value positive, reason obrigatório, operationId uuid opcional) + import de `ECONOMIC_PARAMETER_KEYS`
- `src/app/api/admin/economic-parameters/route.ts` - GET (lista via EconomicParameterService.getAll, 200/403/503) + PUT (zod + RPC admin_set_economic_parameter, 200/400/403/500, idempotência)
- `src/app/api/admin/economic-parameters/__tests__/route.test.ts` - 9 testes (3 GET + 6 PUT) — mocks de require-admin, supabase/server (rpc) e service

## Decisions Made
- **PUT com `safeParse` + body `catch(() => null)`** (em vez de `parse` + try/catch ZodError das rotas anteriores): JSON malformado cai no mesmo 400 zod `{ error: "Dados inválidos", details }` — contrato único de erro 400 para a UI da 38-2-07
- **`p_operation_id: operationId ?? null`**: o RPC tem DEFAULT NULL; o plano exige repassar explicitamente null quando ausente (teste do payload verifica o shape exato)
- **Resposta camelCase**: `{ parameter: { key, value }, auditId, updatedAt, idempotent }` — mapeamento do JSONB do RPC (snake_case) para o contrato D2 consumido pela UI da 38-2-07
- **Log de erro do RPC server-side** (`console.error`) com mensagem do provider, sem expor o reason no corpo da resposta 500 (reason já persiste na audit table)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Edit acidentalmente truncou AiCostsQuerySchema em schemas.ts**
- **Found during:** Task 1 (adição do schema — erro do meu Edit ao ancorar o novo schema)
- **Issue:** O primeiro `edit` substituiu o corpo inteiro de `AiCostsQuerySchema` (fields storeId..hours) deixando `z.object({` órfão e quebrando o typecheck
- **Fix:** Restaurado o corpo original completo do `AiCostsQuerySchema` + adicionado o `UpdateEconomicParameterRequestSchema` logo após, em um único edit corrigido
- **Files modified:** src/lib/admin/schemas.ts
- **Verification:** typecheck limpo; greps do plano (UpdateEconomicParameterRequestSchema=1, ECONOMIC_PARAMETER_KEYS=3, z.enum=2); diff final = +15 linhas só (schema novo), AiCostsQuerySchema intacto
- **Committed in:** f87cc6b (parte do commit da Task 1)

---

**Total deviations:** 1 auto-fixed (1 bug de edição — Rule 1)
**Impact on plan:** Desvio transitório de edição, corrigido antes do commit — nenhum impacto no contrato final; schemas existentes intactos conforme acceptance criteria.

## Issues Encountered
- **PowerShell 5.1 não roda `npm` em pipeline** (mesmo issue de 38-2-02): `npm run typecheck 2>&1 | Select-Object` falha nativamente (`CantActivateDocumentInPipeline`) — contornado com `cmd /c "npm run typecheck"`. Sem impacto.
- **Cálculo de duração via parse de timestamp** falhou na primeira tentativa (datetime parse inconsistente) — recalculado via epoch. Cosmético, sem impacto.

## Authentication Gates
Nenhum — plano sem operações de rede/deploy (só código + testes locais).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **Base pronta para 38-2-07 (UI Configurações Econômicas):** `GET /api/admin/economic-parameters` entrega `{ parameters: [{ key, value, source }] }` para a seção "Parâmetros Econômicos" da página `/admin/operation-costs` (badge source tabela/fallback); `PUT /api/admin/economic-parameters` valida motivo obrigatório e retorna `auditId`/`updatedAt` para o feedback da UI
- **Pronto para 38-2-10 (verificação):** testes da rota (9) + RPC no remoto (38-2-01) + service testado (38-2-02) completam a cadeia D2 da API
- **Nenhum bloqueador** — RPC `admin_set_economic_parameter` já aplicado no remoto pela 38-2-01; esta API é o único consumidor server-side da escrita de parâmetros

---
*Phase: 38.2-admin-custos-operacionais*
*Completed: 2026-08-10*

## Self-Check: PASSED
- Arquivos: schemas.ts, route.ts, route.test.ts, SUMMARY.md encontrados no disco (4/4 FOUND)
- Commits: f87cc6b (schema), 0337e5e (test GET RED), e3e9d9f (feat GET GREEN), b11a1d2 (test PUT RED), 2ddcc08 (feat PUT GREEN) presentes no git log (5/5 FOUND)
- Verificação: typecheck limpo; 9 testes verdes na rota; sem endpoint público (src/app/api/economic-parameters não existe); greps do plano todos satisfeitos
