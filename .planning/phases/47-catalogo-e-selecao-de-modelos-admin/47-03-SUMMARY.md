---
phase: 47-catalogo-e-selecao-de-modelos-admin
plan: 03
subsystem: ai-runtime
tags: [resolver, fail-open, gateway-composition, registry]

requires:
  - phase: 47-catalogo-e-selecao-de-modelos-admin
    provides: bulk catalog/selection maps, TTL and invalidation from 47-02
provides:
  - PersistedModelResolver decorator with fail-open validation
  - singleton resolver composition in defaultAiGateway without gateway.ts changes
  - invariant tests for precedence, deprecated, missing, invalid tuples and fallback
  - catalog segment validation and strict null-versus-absent fallback semantics
affects: [47-04, 47-05, 47-07, 47-08]

tech-stack:
  added: []
  patterns:
    - catalog authority plus runtime provider/protocol compatibility validation
    - default registry fallback on persistence/read/catalog failures

key-files:
  created:
    - src/lib/ai/persisted-model-resolver.ts
    - src/lib/ai/__tests__/persisted-model-resolver.test.ts
    - src/lib/ai/__tests__/ai-model-index.test.ts
  modified:
    - src/lib/ai/index.ts

decisions:
  - "MODEL_ALLOWLIST não bloqueia modelo adicional aprovado no catálogo; o resolver valida apenas provider/protocolo suportado, capacidade e presença no catálogo."
  - "Seleção deprecated vigente continua executável; linha missing, parcial ou incompatível volta ao registry completo."
  - "Fallback só é aceito para campaign_copy; três campos nulos significam fallback desabilitado."
  - "Segmento persistido deve coincidir com CAPABILITY_SEGMENTS; fallback undefined/parcial é inválido e não equivale a três nulls."

requirements: [ai-model-selection, ai-model-registry]
requirements-completed: [ai-model-selection, ai-model-registry]

completed: 2026-09-14
---

# Phase 47 Plan 03 Summary

PersistedModelResolver implementado como decorator fail-open do ModelRegistry. A composição padrão agora injeta o resolver persistido no `AiGateway`, sem alteração do gateway, adapters, prompts, telemetria, retries ou contratos externos.

## Tasks

- Task 1: resolver assíncrono valida seleção contra mapas bulk, catálogo active/deprecated, segmento, capacidade, provider/protocolo e primary/fallback.
- Task 2: `defaultAiGateway` usa um `defaultAiModelResolver` singleton em `src/lib/ai/index.ts`.
- Task 3: invariantes cobertas por testes, incluindo modelo adicional catalogado, deprecated vigente, missing, segmento incompatível, seleção parcial, fallback nulo/ausente, seleção igual ao default e falhas de leitura.

## Gate Results

| Gate | Resultado |
|---|---|
| Resolver + composição + gateway focal | PASS — 3 files / 31 testes |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `src/lib/ai/gateway.ts` | PASS — diff vazio |
| Prompts/contratos de geração/domínio | PASS — não tocados |
| Dependências/package-lock | PASS — nenhum pacote novo |

## Commits

- `68c51cb0` — PersistedModelResolver fail-open
- `cfaba391` — composição singleton e testes de invariantes
- `82ad69df` — validação de segmento, fallback null/undefined e testes de cobertura

## Self-Check

- [x] Seleção válida tem precedência
- [x] Ausência/erro/missing/parcial/incompatível cai no registry
- [x] Deprecated vigente continua executável
- [x] Modelo adicional catalogado não é rejeitado por MODEL_ALLOWLIST
- [x] Fallback apenas em campaign_copy
- [x] Fallback nulo desabilita fallback
- [x] Fallback ausente/parcial volta ao default
- [x] Segmento do catálogo é validado contra a capacidade
- [x] Seleção igual ao default é coberta
- [x] `gateway.ts` permanece intocado
