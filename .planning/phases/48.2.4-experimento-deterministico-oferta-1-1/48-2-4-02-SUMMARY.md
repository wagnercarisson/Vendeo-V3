---
phase: 48.2.4-experimento-deterministico-oferta-1-1
plan: 48-2-4-02
subsystem: lab-bench
tags: [prompt-composer, policies, determinism, fail-closed, oferta-1-1, contribution-based]

# Dependency graph
requires:
  - phase: 48.2.4-experimento-deterministico-oferta-1-1 (plan 48-2-4-01)
    provides: DDL/schemas/persistência/isolamento (Base SHA f5a7fe9a)
provides:
  - Núcleo do compositor contribution-based (composePromptBlocks) com COMPOSER_VERSION 48.2.4
  - Registry versionado de políticas (5 habilitadas: oferta, 1:1, produto, peca-unica, nenhum)
  - resolveBenchPromptPolicies(config) fail-closed (bench_policy_not_implemented)
  - Contratos de teste: prompt-composer.contract.test.ts + prompt-policy.contract.test.ts
affects:
  - 48-2-4-03 (prompt-base padrão / API compose)
  - 48-2-4-04 (branding mínimo / identity-direction — consome contribuições)
  - 48-2-4-05 (API/UI — consome versões de políticas e composição)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Núcleo neutro (coleta/ordena/serializa) separado de políticas versionadas"
    - "Política pura { id, dimension, value, version, contributions(context) }"
    - "Resolução fail-closed antes da chamada paga (bench_policy_not_implemented)"
    - "Atribuição exclusiva e disjunta entre políticas (oferta × produto)"
    - "Golden do prompt completo + atribuição por política (não só contagem)"

key-files:
  created:
    - src/lib/lab/bench/domain/policies/types.ts
    - src/lib/lab/bench/domain/policies/registry.ts
    - src/lib/lab/bench/domain/policies/oferta.ts
    - src/lib/lab/bench/domain/policies/formato-1-1.ts
    - src/lib/lab/bench/domain/policies/produto.ts
    - src/lib/lab/bench/domain/policies/peca-unica.ts
    - src/lib/lab/bench/domain/policies/tema-nenhum.ts
    - src/lib/lab/bench/domain/policies/resolve-bench-prompt-policies.ts
    - src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts
  modified:
    - src/lib/lab/bench/domain/prompt-composer.ts
    - src/lib/lab/bench/__tests__/prompt-composer.contract.test.ts

key-decisions:
  - "Núcleo não emite valores crus de configuração; intenção/formato/estrutura vêm só das políticas"
  - "bench_policy_not_implemented acrescenta-se a config_registry_value_disabled (autoridade do config-registry)"
  - "Tema neutro `nenhum` é resolvido/versionado mas não contribui linha alguma"
  - "Registro de políticas com parâmetro opcional `registry` para compor registries em testes"

patterns-established:
  - "Contribuição por bloco: { block: BenchPromptBlockLabel, lines: readonly string[] }"
  - "Registry fail-fast valida id/versão/dimension/value contra o valor habilitado no config-registry"

requirements-completed:
  - "cap: lab-bench-prompt-policy"
  - "spec: lab-bench-prompt-policy"
  - "spec: lab-bench-prompt-preflight"
  - "D1"
  - "D2"
  - "D3"
  - "D4"
  - "D5"
  - "D7"
  - "tasks: 1.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9"

# Metrics
duration: 18min
completed: 2026-09-30
---

# Phase 48.2.4 Plan 02: Núcleo do compositor e políticas versionadas Summary

**Compositor refatorado em núcleo neutro contribution-based com 5 políticas versionadas (oferta/1:1/produto/peça-única/tema nenhum) e resolução fail-closed `bench_policy_not_implemented`, em linguagem natural e com atribuição exclusiva oferta × produto.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-09-30T15:28Z (aprox.)
- **Completed:** 2026-09-30T15:46Z (aprox.)
- **Tasks:** 3/3
- **Files modified:** 11 (9 criados, 2 modificados)

## Accomplishments
- Núcleo determinístico contribution-based: mescla contribuições por bloco, omite blocos vazios, preserva o prompt-base verbatim e mantém a ordem canônica travada; `COMPOSER_VERSION` atualizada para `48.2.4-prompt-composer-v1`.
- Núcleo **neutro**: removidos `identityLines`/`typographyLines`/`intentLines` e a emissão de valores crus de configuração — regras de dimensão vivem apenas nas políticas.
- Registry versionado com as 5 políticas habilitadas + validação fail-fast; `resolveBenchPromptPolicies(config)` resolve contribuições/versões e falha com `bench_policy_not_implemented` antes da chamada paga.
- Atribuição exclusiva e disjunta (oferta × produto) provada por teste, complementada por **golden do prompt completo** do recorte Oferta 1:1.
- 37 testes verdes nos dois contratos; `npm run typecheck` exit 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Contratos de política + registry versionado + 5 políticas habilitadas** - `ebda9516` (feat)
2. **Task 2: Núcleo neutro contribution-based + COMPOSER_VERSION da fase** - `f0b358b2` (refactor)
3. **Task 3: resolveBenchPromptPolicies fail-closed + contrato de políticas** - `6ae487a3` (feat)

**Plan metadata:** (ver commit de docs deste plano)

## Files Created/Modified
- `src/lib/lab/bench/domain/policies/types.ts` - `BenchPromptPolicy`, `BenchPromptContribution`, `BenchPolicyContext`.
- `src/lib/lab/bench/domain/policies/registry.ts` - Registry dimensão→política + `validateBenchPromptPolicyRegistry` fail-fast.
- `src/lib/lab/bench/domain/policies/oferta.ts` - Orientação comercial (só em `[CONDIÇÕES COMERCIAIS]`) + "Oferta".
- `src/lib/lab/bench/domain/policies/formato-1-1.ts` - "quadrado 1:1" em `[INTENÇÃO E FORMATO]`.
- `src/lib/lab/bench/domain/policies/produto.ts` - Orientação de produto (só em `[PRODUTO E IMAGENS DE REFERÊNCIA]`).
- `src/lib/lab/bench/domain/policies/peca-unica.ts` - "peça única" em `[INTENÇÃO E FORMATO]`.
- `src/lib/lab/bench/domain/policies/tema-nenhum.ts` - Tema neutro (nenhuma linha).
- `src/lib/lab/bench/domain/policies/resolve-bench-prompt-policies.ts` - Resolução fail-closed + `BenchPromptPolicyError`.
- `src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts` - Determinismo, linguagem natural, omissão do tema, sem redundância, atribuição exclusiva, golden, negativos, neutralidade.
- `src/lib/lab/bench/domain/prompt-composer.ts` - Refatorado em núcleo neutro contribution-based.
- `src/lib/lab/bench/__tests__/prompt-composer.contract.test.ts` - Reescrito com contribuições sintéticas (sem importar `policies/**`).

## Decisions Made
- **Contexto das políticas** definido como `{ config, briefing?, references? }`; as políticas habilitadas emitem orientação estática, então `resolveBenchPromptPolicies(config)` passa apenas `{ config }` (assinatura conforme o plano).
- **Erro para combinação desabilitada** vem do `config-registry` (`config_registry_value_disabled`), e `bench_policy_not_implemented` é acrescentado pela resolução (D2) — mantendo a autoridade dos valores no `config-registry`.
- **`registry` opcional** em `resolveBenchPromptPolicies` (padrão `BENCH_PROMPT_POLICY_REGISTRY`) para permitir provar o caminho `bench_policy_not_implemented` sem desabilitar políticas reais.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Testes ambientais fora do escopo (não regressão):** `bench-execution.contract.test.ts` (4 timeouts de 5s em processamento de imagem) e `bench-boundary.contract.test.ts` (1 `fetch failed` em `ai-model-pricing`) falham de forma intermitente/ambiental no Windows. Nenhum desses arquivos importa `prompt-composer`/`policies`; as falhas são de ambiente (timeout/rede) e **não** são causadas por este plano. Fora do escopo (ver `deferred-items`).
- Preço formatado com `toLocaleString("pt-BR")` usa espaço não separável (U+00A0); o golden usa `\u00A0` explícito para manter a comparação determinística.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Núcleo e políticas prontos para os Planos 03/04/05 (prompt-base padrão, branding mínimo/identity-direction, API/UI) consumirem `composePromptBlocks({ ..., contributions, policyVersions })` e `resolveBenchPromptPolicies`.
- `compose/route.ts` ainda não resolve políticas nem passa contribuições (integração prevista nos planos seguintes); o núcleo é retrocompatível (contribuições opcionais), então typecheck permanece verde.

---
*Phase: 48.2.4-experimento-deterministico-oferta-1-1*
*Completed: 2026-09-30*

## Self-Check: PASSED

- Todos os 9 arquivos criados/alterados e o SUMMARY.md verificados no disco.
- Commits de task verificados: `ebda9516`, `f0b358b2`, `6ae487a3`.
- `npm run typecheck` exit 0; contratos `prompt-composer` + `prompt-policy` verdes (37 testes).
