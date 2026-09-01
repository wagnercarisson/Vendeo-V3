---
phase: 42-signup-controlado-elegibilidade-freemium
plan: 04
subsystem: api
tags: [freemium, elegibilidade, motor, d7, d8, d9, d10, cnae, situacao-nao-ativa, pre-gate, typescript, vitest]

# Dependency graph
requires:
  - phase: 42-03
    provides: cnae-mapping.ts determinístico (cnaeCompatibilityFor, tri-state compatible/incompatible/unknown)
  - phase: fase-42-signup-controlado-elegibilidade-freemium
    provides: OpenSpec F42 source of truth (D7 cidade/UF gate; D8 situacao_nao_ativa; D9 CNAE; D10 ordem do motor)
  - phase: 33-verificacao-cnpj-freemium
    provides: Motor F33 original (evaluateFreemiumEligibility, ordem inicial, lacunas INAPTA/cnaeCompatible null)
  - phase: fase-40-campos-comerciais-avisos-brief
    provides: Enum real stores.segment (STORE_SEGMENTS — 13 valores incluindo outros)
provides:
  - Motor `evaluateFreemiumEligibility` revisado com ordem D10 completa (CNPJ → situação ATIVA exata → raiz → nome ≥ 0.6 → cidade/UF → CNAE → approved score ≥ 60)
  - Lacuna F33 corrigida: INAPTA/SUSPENSA/qualquer situação não-vazia ≠ ATIVA → review `situacao_nao_ativa`; situação vazia/ausente em resposta resolvida → defer `dados_oficiais_incompletos` (score 0)
  - `signals.cnaeCompatible` tri-state `"compatible" | "incompatible" | "unknown" | null` preenchido via `cnaeCompatibilityFor`; incompatible → review `segmento_cnae_divergente` (nunca reject); unknown → neutro
  - Novo motivo de review `localizacao_oficial_indisponivel` (cidade/UF preenchidas sem contrapartida oficial)
  - Pré-gate D7 nos DOIS callers (`store/route.ts` create e `update-cnpj/route.ts`): city/state ausentes → motor NÃO chamado, loja `unverified`, sem review na fila admin e sem concessão de crédito
  - `update-cnpj/route.ts` sem auto-aprovação por `score.bestScore >= 0.8` (nome virou métrica de apoio, não decisão)
  - Tipos em `freemium/types.ts`: `city/state: string | null`, `cnaeCompatible` tri-state, `Decision` sem quinto retorno
  - Contrato de elegibilidade documentado no código do motor (pré-gate no caller; sem branch de draft; F34 `check_store_readiness` intocada)
affects: [42-05 (admin review — 4 novos labels consumidos: situacao_nao_ativa, localizacao_oficial_indisponivel, segmento_cnae_divergente, dados_oficiais_incompletos), 42-15 (testes 22-36 do motor), 42-20 (UAT fail-closed)]

# Tech tracking
tech-stack:
  added: []
  patterns: [pré-gate de contrato no caller/rota (motor nunca recebe nulos — ausência é estado do caller, não branch do motor), decisão única por motor com sinais de apoio separados (nome vira métrica de apoio, não decisão), motivo genérico de review substitui motivo específico preservando label legado para histórico]

key-files:
  created: []
  modified:
    - src/lib/freemium/types.ts
    - src/lib/freemium/freemium-risk-service.ts
    - src/lib/freemium/__tests__/freemium-risk-service.test.ts
    - src/app/api/store/route.ts
    - src/app/api/store/__tests__/route.test.ts
    - src/app/api/store/update-cnpj/route.ts
    - src/app/api/store/update-cnpj/__tests__/route.test.ts

key-decisions:
  - "Pré-gate D7 mora no caller/rota: city/state ausentes → motor NÃO é chamado; a loja permanece `unverified` com `verificationData = { signals: {}, score: 0 }`, sem review na fila admin e sem concessão — create (store/route.ts) e update-cnpj compartilham o MESMO contrato (decisão do usuário: contrato único)"
  - "Nome similar (compareBusinessName) deixou de ser a decisão final no update-cnpj: virou métrica de apoio (`cnpjValidationScore`) persistida como sinal; a decisão vem exclusivamente do motor revisado"
  - "A lacuna F33 é corrigida com um motivo genérico `situacao_nao_ativa` (qualquer situação não-vazia ≠ ATIVA, ex. INAPTA/SUSPENSA) em vez de estender o bloco SUSPENSA específico; `situacao_suspensa` permanece legado para histórico (D8, sem migração)"
  - "Situação vazia/ausente em resposta resolvida → defer `dados_oficiais_incompletos` (score 0), nunca aprova e não gera review ruidoso — distingue-se de BAIXADA/NULA (reject) já tratados antes na ordem D10"
  - "CNAE determinístico (D9): tri-state preenchido sempre que há officialData; `incompatible` → review `segmento_cnae_divergente` (nunca reject exclusivo); `unknown` neutro (segmento fora do enum, CNAE malformado, `outros`); chamada sem custo externo"

patterns-established:
  - "Pré-gate no caller: ausência de dado de conclusão (cidade/UF) é estado do caller, não branch do motor — o motor nunca recebe nulos e o contrato não cresce com quinto retorno"
  - "Sinais de apoio vs decisão: `cnpjValidationScore` (nome) é persistido como métrica informativa; a decisão vem de um único ponto (motor)"

requirements-completed: ["freemium-risk-service (evaluateFreemiumEligibility — motor de decisão determinístico)"]

# Metrics
duration: 8min
completed: 2026-08-17
---

# Phase 42 Plan 04: Motor de Elegibilidade Revisado (D8/D10) + Pré-gate D7 nos Callers Summary

**Motor `evaluateFreemiumEligibility` revisado com a ordem D10 (CNPJ → situação ATIVA exata → raiz → nome ≥ 0.6 → cidade/UF → CNAE → approved), lacuna F33 corrigida (INAPTA/SUSPENSA → review `situacao_nao_ativa`; situação ausente → defer `dados_oficiais_incompletos`), `cnaeCompatible` tri-state preenchido via cnae-mapping (incompatible → review `segmento_cnae_divergente`, nunca reject), novo motivo `localizacao_oficial_indisponivel` e pré-gate D7 implementado nos DOIS callers (`store/route.ts` e `update-cnpj/route.ts`) com contrato único — city/state ausentes → motor não chamado, loja não avaliada, sem review/concessão; auto-aprovação por nome ≥ 0.8 removida do update-cnpj; F34 `check_store_readiness` intocada**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-17T20:39:43Z
- **Completed:** 2026-08-17T20:46:45Z
- **Tasks:** 3 (Tasks 1 e 2 TDD com RED+GREEN; Task 3 execute)
- **Files modified:** 7

## Accomplishments

- **Ordem D10 completa no motor** — CNPJ `not_found` → reject; BAIXADA/NULA → reject; situação não-vazia ≠ ATIVA → review `situacao_nao_ativa`; situação vazia/ausente em resposta resolvida → defer `dados_oficiais_incompletos`; raiz usada → reject; unavailable/sem dados → defer `api_unavailable`; nome < 0.6 → review `nome_divergente`; cidade/UF preenchidas sem oficial → review `localizacao_oficial_indisponivel`; divergentes → `cidade_divergente`/`uf_divergente`; CNAE incompatible → review `segmento_cnae_divergente`; senão → approved (score ≥ 60 preservado)
- **Lacuna F33 corrigida** — INAPTA (e qualquer situação ≠ ATIVA/BAIXADA/NULA) não atravessa mais: vira review `situacao_nao_ativa` (motivo genérico substitui o bloco SUSPENSA específico; `situacao_suspensa` fica legado para histórico, D8); situação ausente/vazia → defer `dados_oficiais_incompletos` (nunca aprova, sem review ruidoso)
- **CNAE determinístico integrado (D9)** — `signals.cnaeCompatible` agora é `"compatible" | "incompatible" | "unknown" | null`, preenchido via `cnaeCompatibilityFor(segment, cnae_principal)` quando há officialData; `incompatible` → review (nunca reject); `unknown` neutro — testado com código real (variedades-utilidades + `4789-0/09` → incompatible; `outros` → unknown)
- **Pré-gate D7 nos DOIS callers (contrato único)** — `store/route.ts` (create) e `update-cnpj/route.ts` (draft→fiscal): city/state ausentes (undefined/empty após trim) → motor NÃO chamado, `verificationStatus = "unverified"`, `verificationData = { signals: {}, score: 0 }`, sem review na fila admin e sem concessão; preenchidos → motor com valores non-null
- **Auto-aprovação por nome removida no update-cnpj** — `score.bestScore >= 0.8` deixou de ser a decisão final; `compareBusinessName`/`cnpjValidationScore` permanece como métrica de apoio persistida; a decisão vem exclusivamente do motor (teste prova: nome ≥ 0.8 com INAPTA → review `situacao_nao_ativa`, NUNCA approved)
- **Contrato documentado no motor** — comentário JSDoc em `evaluateFreemiumEligibility`: pré-gate D7 no caller (motor nunca recebe nulos), sem quinto retorno ("draft"), F34 `check_store_readiness` intocada
- **TDD RED→GREEN nas duas tasks** — Task 1: teste de contrato de tipo falhou typecheck (TS2322 boolean|null → tri-state) e passou após a mudança de tipos; Task 2: 8 testes novos/co-migrados falharam no motor antigo (exatamente as lacunas F33 + CNAE) e passaram após a revisão
- Regressão completa: **223 files / 2071 testes passing** (F42-03 fechou com 223/2059; +12)

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1 (TDD): Tipos atualizados (types.ts)**
   - `ed35ec2` — `test(42-04)`: add failing type-contract test for tri-state cnaeCompatible (RED — typecheck TS2322)
   - `d99c35e` — `feat(42-04)`: update freemium types (nullable city/state + tri-state cnaeCompatible) (GREEN)
   - _REFACTOR: não necessário — mudança de tipos mínima_
2. **Task 2 (TDD): Motor revisado (freemium-risk-service.ts)**
   - `b26de65` — `test(42-04)`: update motor tests for D10 order (RED — 8 falhas nas lacunas F33 + CNAE)
   - `af4a4b3` — `feat(42-04)`: revise eligibility motor with D10 order + CNAE tri-state (GREEN — 20/20)
   - _REFACTOR: não necessário — implementação mínima seguindo a ordem D10_
3. **Task 3: Pré-gate D7 + motor nos dois callers + contrato** - `b3b9903` (`feat(42-04)`: implement D7 pre-gate + revised motor in both callers)

## Files Created/Modified

- `src/lib/freemium/types.ts` - `FreemiumEligibilityInput.city/state: string | null` (D7); `signals.cnaeCompatible: "compatible" | "incompatible" | "unknown" | null` (D9); `Decision` inalterada
- `src/lib/freemium/freemium-risk-service.ts` - motor revisado: ordem D10, `situacao_nao_ativa` genérico, `dados_oficiais_incompletos`, `localizacao_oficial_indisponivel`, `segmento_cnae_divergente`, `cnaeCompatible` via `cnaeCompatibilityFor`, contrato JSDoc
- `src/lib/freemium/__tests__/freemium-risk-service.test.ts` - 20 testes (7 novos/co-migrados: contrato de tipo, INAPTA/SUSPENSA, situação ausente, localização oficial ausente ×2, CNAE incompatible/unknown); makeInput com segmento real
- `src/app/api/store/route.ts` - pré-gate D7 no create: city/state ausentes → motor não chamado, `unverified` sem review/concessão
- `src/app/api/store/__tests__/route.test.ts` - 3 casos novos/co-migrados: motor chamado com non-null quando presentes; motor NÃO chamado sem city/state; city sem state → não chamado; bodies co-migrados com city/state
- `src/app/api/store/update-cnpj/route.ts` - auto-aprovação por nome removida; pré-gate D7 + motor com rootEligible (freemium_entitlements), officialData, segment, city, state, storeName; nome como métrica de apoio
- `src/app/api/store/update-cnpj/__tests__/route.test.ts` - mock de cadeia fluente (duplicata + entitlement); 4 casos: unverified sem city/state (motor not called, sem auto-aprovação), INAPTA com nome ≥ 0.8 → review, CNAE incompatible → review, tudo ok → approved via motor

## Decisions Made

- **Pré-gate D7 no caller, contrato único create/update** — ausência de cidade/UF é estado do caller (loja `unverified`), não branch do motor: motor nunca recebe nulos, sem quinto retorno ("draft"). Aplicado em `store/route.ts` e `update-cnpj/route.ts` com o mesmo comportamento (sem review na fila admin, sem concessão)
- **Nome virou métrica de apoio no update-cnpj** — a auto-aprovação por `bestScore >= 0.8` foi removida como fonte final de decisão; `cnpjValidationScore` continua persistido como sinal informativo; a decisão vem do motor (D10)
- **`situacao_nao_ativa` genérico em vez de estender SUSPENSA** — corrige a lacuna F33 (INAPTA atravessava); `situacao_suspensa` mantido apenas como label legado para histórico (D8)
- **`dados_oficiais_incompletos` = defer (score 0)** — situação ausente em resposta resolvida nunca aprova e não gera review ruidoso na fila admin (T-42-04 mitigado)
- **CNAE nunca rejeita** — `incompatible` → review `segmento_cnae_divergente`; `unknown` neutro; chamada determinística sem custo (T-42-04a mitigado)

## Deviations from Plan

### Auto-fixed Issues

Nenhuma — o plano foi executado exatamente como escrito.

---

**Total deviations:** 0
**Impact on plan:** N/A — todas as tasks completas conforme especificado; sem scope creep.

## Issues Encountered

- **Mock da rota update-cnpj não suportava a segunda query `from()` (entitlements)** — o mock antigo encadeava apenas `select→eq→neq→maybeSingle`; o novo código adiciona a consulta `freemium_entitlements` (`select→eq→eq→maybeSingle`). Corrigido inline substituindo o helper `mockFromNoDuplicate()` por uma cadeia fluente compartilhada (Rule 1, parte do commit `b3b9903`)
- **`evaluateFreemiumEligibility` é síncrono** — o mock da rota update-cnpj usa `mockReturnValue` (não `mockResolvedValue`) para os testes de decisão; `mockResolvedValue` produziria um Promise tratado como objeto (`eligibility.decision` undefined)

## User Setup Required

None — nenhuma configuração externa. Nenhuma env var nova.

## Next Phase Readiness

- **42-05 (admin reviews) pronto para consumir** os 4 novos motivos emitidos pelo motor: `situacao_nao_ativa`, `localizacao_oficial_indisponivel`, `segmento_cnae_divergente`, `dados_oficiais_incompletos` (labels + dados informados × oficiais); `situacao_suspensa` permanece legado para histórico
- **42-15 (testes 22-36 do motor)** pode referenciar o motor revisado e o pré-gate D7 nos callers; os testes 37-46 (CNAE) já existem e permanecem verdes
- **42-20 (UAT fail-closed)** pode exercitar: INAPTA → review; cidade/UF ausentes → loja draft não avaliada (sem review/concessão); CNAE incompatível → review nunca reject
- F34 (`check_store_readiness`) intacta — separação de conceitos D7 preservada

## TDD Gate Compliance

- Task 1: RED `ed35ec2` (test) → GREEN `d99c35e` (feat) — ✓ sequência válida
- Task 2: RED `b26de65` (test) → GREEN `af4a4b3` (feat) — ✓ sequência válida
- Task 3: `type="execute"` (não-TDD) — commit único `b3b9903` conforme esperado
- Nenhuma violação de gate; o RED da Task 1 é um teste de contrato de tipo (falha de typecheck TS2322), o RED da Task 2 falha em runtime com as 8 lacunas F33/D9 esperadas

## Self-Check: PASSED

- Files exist on disk — FOUND: `src/lib/freemium/types.ts`, `src/lib/freemium/freemium-risk-service.ts`, `src/lib/freemium/__tests__/freemium-risk-service.test.ts`, `src/app/api/store/route.ts`, `src/app/api/store/update-cnpj/route.ts` + testes
- Commits in git log — FOUND: `ed35ec2`, `d99c35e`, `b26de65`, `af4a4b3`, `b3b9903`
- Plan-level verification re-run:
  - `npx vitest run src/lib/freemium/__tests__/freemium-risk-service.test.ts` → 20/20 PASS
  - `npx vitest run src/app/api/store/__tests__/route.test.ts src/app/api/store/update-cnpj/__tests__/route.test.ts` → 30/30 PASS
  - `npm run typecheck` → 0 errors PASS
  - Regressão completa `npx vitest run` → 223 files / 2071 testes PASS
  - `git diff --name-only` → nenhum arquivo em `src/lib/store-readiness/` (F34 intocada) PASS

---
*Phase: 42-signup-controlado-elegibilidade-freemium*
*Completed: 2026-08-17*