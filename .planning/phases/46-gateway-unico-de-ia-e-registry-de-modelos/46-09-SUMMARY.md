---
phase: 46-gateway-unico-de-ia-e-registry-de-modelos
plan: 09
subsystem: ai
tags: [verification, uat, goal-backward, records, archive, phase-close]

# Dependency graph
requires:
  - phase: 46-gateway-unico-de-ia-e-registry-de-modelos
    provides: 46-01..46-08 (registry/gateway/adapters/telemetria/migração/envs/gate/inventário) — 275 files / 2721 testes, 4 gates verdes
provides:
  - ".planning/phases/46-gateway-unico-de-ia-e-registry-de-modelos/46-VERIFICATION.md — verificação goal-backward (passed)"
  - ".planning/phases/46-gateway-unico-de-ia-e-registry-de-modelos/46-UAT.md — UAT humano 8/8 PASS (decisão final aprovada)"
  - "Registros atualizados (AGENTS/STATE/ROADMAP raiz e .planning/ROADMAP/PROJECT) + arquivamento do change preparado"
affects: [47]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Verificação goal-backward por spec/requisito com evidência arquivo:linha/teste"
    - "UAT humano com critério de equivalência (não igualdade literal) e validação por código dos itens não reproduzíveis"

key-files:
  created:
    - .planning/phases/46-gateway-unico-de-ia-e-registry-de-modelos/46-VERIFICATION.md
    - .planning/phases/46-gateway-unico-de-ia-e-registry-de-modelos/46-UAT.md
    - .planning/phases/46-gateway-unico-de-ia-e-registry-de-modelos/46-09-SUMMARY.md
  modified:
    - AGENTS.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - ROADMAP.md
    - .planning/PROJECT.md

key-decisions:
  - "UAT humano 8/8 PASS (equivalência de comportamento/contrato/estrutura/qualidade; não igualdade literal — IA não determinística)"
  - "Achado de UAT (snapshot econômico em brand_profile_vision) corrigido em 529a69c5 antes do fechamento"
  - "Arquivamento do change OpenSpec preparado, não executado (aguarda instrução)"

requirements: [F46-40, F46-41, F46-42]
requirements-completed: [F46-40, F46-41, F46-42]

# Metrics
duration: 30min
completed: 2026-09-13
---

# Phase 46 Plan 09: Verificação Final Summary

**`46-VERIFICATION.md` (goal-backward, `passed`) + `46-UAT.md` (UAT humano 8/8 PASS) gerados; 4 gates verdes (275 files / 2721 testes); registros atualizados e arquivamento do change preparado — a F46 (Gateway Único de IA e Registry de Modelos, Change A) está concluída.**

## Performance

- **Duration:** ~30 min (incl. UAT humano e correção do achado)
- **Tasks:** 4/4
- **Files modified:** 5 (registros) + 3 artefatos de verificação

## Accomplishments

- **Task 1 — `46-VERIFICATION.md`:** verificação goal-backward sobre as 6 specs (ai-model-registry, ai-invocation-gateway, ai-cost-accounting, ai-image-generation, text-provider, ai-campaign-intelligence): cada requisito mapeado a evidência (`arquivo:linha`/teste) com status. `46-UAT.md`: roteiro humano de 8 cenários (campanha, fallback de imagem, VS, brand profile, copy, logo/correção, `campaign_spec`, config sem envs).
- **Task 2 — 4 gates + 10 critérios:** `npx vitest run` (275 files / 2721 testes), `typecheck`, `lint`, `build` verdes; os 10 critérios da proposta confirmados com evidência; `46-VERIFICATION.md` marcado `passed`.
- **Task 3 — UAT humano (checkpoint blocking):** roteiro executado pelo usuário; **8/8 cenários PASS**; decisão final **APROVADO** (2026-09-12/13). Itens não reproduzíveis manualmente validados por cobertura automatizada (fallbacks de imagem/copy; fluxo de correção). Achado real do UAT — evento `brand_profile_vision` apurado com câmbio de fallback — **corrigido em `529a69c5`** (propagação do snapshot econômico em todos os callers do `AiTelemetryContext`) e revalidado.
- **Task 4 — registros + arquivamento:** AGENTS.md, `.planning/STATE.md`, `.planning/ROADMAP.md`, `ROADMAP.md` raiz e `.planning/PROJECT.md` atualizados para conclusão da F46; arquivamento do change OpenSpec **preparado** (não executado).

## Task Commits

1. **Task 1/2: VERIFICATION + UAT + gates** — `836bd008` (docs) + `1178a03f` (docs)
2. **Correção do roteiro UAT (dois gatilhos; equivalência)** — `c8a481af` (docs)
3. **Correção do achado do UAT (snapshot econômico)** — `529a69c5` (fix)
4. **UAT aprovado + decisão final** — `df33137f` (docs)
5. **Registros + SUMMARY** — metadata commit (docs)

## Files Created/Modified

- `46-VERIFICATION.md` — verificação goal-backward (`passed`).
- `46-UAT.md` — roteiro + resultados (8/8 PASS, decisão final aprovada).
- `AGENTS.md` / `.planning/STATE.md` / `.planning/ROADMAP.md` / `ROADMAP.md` / `.planning/PROJECT.md` — conclusão da F46.
- `46-09-SUMMARY.md` — este arquivo.

## Gate Results

| Gate | Resultado |
|---|---|
| `npx vitest run` (suíte completa) | ✅ **275 files / 2721 testes — 0 falhas** |
| `npm run typecheck` | ✅ 0 erros |
| `npm run lint` | ✅ 0 erros |
| `npm run build` | ✅ sucesso |
| Contrato externo (UI/form/schema/snapshot/domínio/prompts) | ✅ diff vazio |
| 14 envs de modelo em `src/`+`scripts/` | ✅ 0 |
| Prompts sem drift | ✅ vazio |

## 10 Critérios da Proposta (confirmados)

1. Registry 11 capacidades com `protocol` no primary/fallback; allowlist por capacidade+provider+modelo+protocolo; `primary ≠ fallback` ✅
2. `AiModelResolver` (`resolve` + `listCapabilities`); gateway depende só da interface ✅
3. Gateway `invoke(...,target)` — alvo explícito, adapter por protocolo, uma tentativa, envelope por tentativa, contexto obrigatório ✅
4. 4 adapters com contrato único; `AbortSignal` propagado ✅
5. `AiInvocationError` preserva os gates (auth/safety não; capability → images.edit/json_object; domínio não normalizado) ✅
6. Telemetria correta (modelo real; furo 1; images.edit `not_available`; componente da tool em `campaign_image` **e** `visual_signature_image`) ✅
7. Migração incremental behavior-preserving das 11 capacidades ✅
8. Cobertura de telemetria em todos os callers + inventário ✅
9. Legado `campaign_spec` via gateway + migration aditiva do CHECK ✅
10. 14 envs removidas + ordem de deploy + 4 gates + **UAT humano 8/8** ✅

## Achado de UAT e correção

- **Sintoma:** evento `brand_profile_vision` (logo) apurado com "parâmetro atual (fallback)" em vez do câmbio capturado.
- **Causa:** callers recém-instrumentados criavam o `AiTelemetryContext` sem `usdBrlRateAtGeneration`/`creditValueBrlAtGeneration`.
- **Correção (`529a69c5`):** helper compartilhado `resolveEconomicSnapshot()` + propagação em todos os callers (`logo`, `retry-brand-director`, `approve`, `restore`, `server-actions`, `campaign/generate`, `problem-report`); `realign`/VS `generate-without-logo` refatorados para o helper. Teste de inventário garante que nenhum caller crie o contexto sem o snapshot.

## Arquivamento do Change (preparado, NÃO executado)

Fonte: `openspec/changes/fase-46-gateway-unico-de-ia-e-registry-de-modelos/` → `openspec/changes/archive/2026-09-13-fase-46-gateway-unico-de-ia-e-registry-de-modelos/`.

Comando (executar somente após instrução explícita do usuário):
```bash
openspec archive fase-46-gateway-unico-de-ia-e-registry-de-modelos --yes
# (ou mover manualmente o diretório para openspec/changes/archive/2026-09-13-fase-46-...)
```

## User Setup Required

**Deploy (ordem D5 — obrigatória):**
1. Deploy do código que lê só as chaves (`OPENAI_API_KEY`/`GEMINI_API_KEY`) + operacionais.
2. **Depois** remover as 14 env-vars de modelo/provider na Vercel. **Nunca o inverso.**

## Next Phase Readiness

- **F47 (Catálogo e Seleção de Modelos Admin — Change B)** é a sucessora; consome o seam `AiModelResolver` sem refazer o gateway.
- Sem blockers.

## Self-Check: PASSED

- [x] `46-VERIFICATION.md` existe e está `passed`
- [x] `46-UAT.md` com roteiro + 8/8 PASS + decisão final aprovada
- [x] 4 gates verdes (275 files / 2721 testes)
- [x] Achado do UAT corrigido (`529a69c5`) e coberto por teste
- [x] Registros atualizados (AGENTS/STATE/ROADMAP/PROJECT)
- [x] Arquivamento preparado (não executado)

---
*Phase: 46-gateway-unico-de-ia-e-registry-de-modelos*
*Completed: 2026-09-13*
