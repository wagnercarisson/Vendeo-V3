---
phase: 47-catalogo-e-selecao-de-modelos-admin
plan: 02
subsystem: ai-model-configuration
tags: [catalog, selection, bulk-read, cache, parity]

requires:
  - phase: 47-catalogo-e-selecao-de-modelos-admin
    provides: local schema F47, 12 catalog seeds and server-only tables from 47-01
provides:
  - server-only bulk catalog reader with active/deprecated map and local TTL
  - server-only selection map reader with 30-second TTL and explicit invalidation
  - registry/catalog parity tests for all 11 capabilities and 12 seed tuples
  - epoch-guarded invalidation that cannot repopulate cache from stale in-flight reads
affects: [47-03, 47-04, 47-05]

tech-stack:
  added: []
  patterns:
    - injectable Supabase clients and clock for deterministic service tests
    - in-flight promise sharing to prevent concurrent duplicate bulk reads

key-files:
  created:
    - src/lib/ai/ai-model-catalog-service.ts
    - src/lib/ai/ai-model-selection-service.ts
    - src/lib/ai/__tests__/ai-model-catalog-service.test.ts
    - src/lib/ai/__tests__/ai-model-selection-service.test.ts
    - src/lib/ai/__tests__/ai-model-catalog-parity.test.ts

decisions:
  - "O catálogo é carregado em uma consulta completa; linhas deprecated permanecem no mapa para resolver seleções vigentes e sinalizar a UI."
  - "O cache é por instância, TTL 30s, com invalidação explícita; não foi adicionada infraestrutura compartilhada."
  - "Falhas de leitura retornam coleção vazia para permitir o fail-open do resolver posterior."
  - "Epoch + identidade da promise impedem que uma leitura iniciada antes da invalidação restaure o cache antigo."

requirements: [ai-model-catalog, ai-model-selection, ai-model-registry]
requirements-completed: [ai-model-catalog, ai-model-selection, ai-model-registry]

completed: 2026-09-14
---

# Phase 47 Plan 02 Summary

Implementados os serviços bulk server-only de catálogo e seleção, sem lookup por capacidade/invoke e sem alteração do gateway. O catálogo mantém active e deprecated em memória; a seleção é um mapa completo com TTL de 30 segundos e invalidação local.

## Tasks

- Task 1: `AiModelCatalogService` e `AiModelSelectionService` com clients injetáveis, cache local, compartilhamento de leituras concorrentes e tratamento fail-open.
- Task 2: testes de bulk, TTL, invalidação, falha de leitura, deprecated, corrida in-flight e paridade registry × catálogo.
- Correção: paridade do verificador local compara exatamente as 12 tuplas retornadas pelo `ai_model_catalog` após migration, não apenas uma fixture unitária.

## Gate Results

| Gate | Resultado |
|---|---|
| Focal Vitest | PASS — 3 files / 10 testes |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Verificador local F47-01 | PASS — 23/23, catálogo real comparado à matriz esperada |
| Serviços `server-only` | PASS por import explícito e inspeção |
| Dependências/package-lock | PASS — nenhum pacote novo |

## Commits

- `7abc2a25` — serviços bulk de catálogo e seleção
- `0c29b4ef` — testes de cache, invalidação e paridade
- `f3648ce5` — epoch de invalidação, testes concorrentes e paridade do catálogo real

## Self-Check

- [x] Uma leitura bulk por cache de catálogo/seleção
- [x] TTL de seleção em 30 segundos
- [x] Invalidação local explícita
- [x] Deprecated preservado para seleção vigente
- [x] Defaults primary/fallback do registry cobertos
- [x] Provider/protocolo/segmento cobertos
- [x] Nenhuma alteração em `gateway.ts`
