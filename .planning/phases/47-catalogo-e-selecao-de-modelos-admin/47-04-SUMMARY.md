---
phase: 47-catalogo-e-selecao-de-modelos-admin
plan: 04
subsystem: admin-api
tags: [admin, api, zod, rpc, selection, catalog-status]

requires:
  - phase: 47-catalogo-e-selecao-de-modelos-admin
    provides: bulk services and persisted resolver from 47-02/47-03
provides:
  - strict selection update/reset schemas and F47 audit labels
  - server-only selection view composer with active/deprecated/missing statuses
  - admin GET/PUT/DELETE selection API with RPC-only mutation
  - effective-vs-configured view semantics delegated to PersistedModelResolver
  - OpenSpec contract updated to define current/configured/default explicitly
affects: [47-05, 47-06, 47-07, 47-08]

tech-stack:
  added: []
  patterns:
    - strict UUID operationId preserved from request through RPC
    - cache invalidation only after successful audited mutation

key-files:
  created:
    - src/lib/ai/ai-model-selection-view.ts
    - src/app/api/admin/ai-model-selection/route.ts
    - src/app/api/admin/ai-model-selection/route.test.ts
    - src/lib/ai/__tests__/ai-model-selection-view.test.ts
    - src/lib/admin/__tests__/schemas.test.ts
  modified:
    - src/lib/admin/schemas.ts
    - src/lib/admin/labels.ts

decisions:
  - "DELETE aceita somente JSON estrito { capability, reason, operationId }; nenhum operationId é gerado no servidor."
  - "GET reutiliza o composer server-only e não faz request HTTP interno nem lookup N+1."
  - "Pricing fica fora desta wave; o view model reserva a integração futura sem warnings de pricing."
  - "current/source são derivados do mesmo resolver usado no runtime; configured preserva o diagnóstico da seleção persistida inválida/deprecated/missing."

requirements: [ai-model-selection, admin-ai-model-selection, ai-model-catalog]
requirements-completed: [ai-model-selection, admin-ai-model-selection, ai-model-catalog]

completed: 2026-09-14
---

# Phase 47 Plan 04 Summary

API administrativa de seleção implementada com schemas Zod estritos, composer server-only e mutações via RPCs auditadas. O GET expõe catálogo ativo, seleções, defaults e status de catálogo por tupla completa; PUT/DELETE preservam actor e operationId e invalidam o cache somente após sucesso.

## Tasks

- Task 1: schemas estritos para PUT/DELETE e labels `ai_model_selection_update`, `ai_model_selection_reset` e `ai_model_selection`.
- Task 2: composer `buildAiModelSelectionView` e rota GET/PUT/DELETE com requireAdmin em todos os métodos.
- Task 3: testes de autorização, parse, status active/deprecated/missing, RPC, actor, operationId, retry, falha de invalidação e default efetivo.
- Correção: o composer agora reutiliza `PersistedModelResolver.resolveWithSource`; a seleção inválida é diagnóstico em `configured`, não aparece como `current` executado.

## Gate Results

| Gate | Resultado |
|---|---|
| Schemas + route + view focal | PASS — 3 files / 12 testes |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Mutação direta em tabelas | PASS — rota usa somente RPC |
| DELETE JSON estrito/UUID | PASS |
| Dependências/package-lock | PASS — nenhum pacote novo |

## Commits

- `435f6040` — schemas, labels e testes de contrato
- `5e4df666` — composer e API administrativa
- `590a34e5` — testes da API e status do catálogo
- `071132e9` — view efetiva via resolver e cobertura adicional da API
- `b8e90fc6` — teste de seleção deprecated efetiva
- `da3ad200` — contrato OpenSpec current/configured/default

## Self-Check

- [x] GET/PUT/DELETE protegidos por requireAdmin
- [x] status active/deprecated/missing por tupla completa
- [x] PUT/DELETE RPC-only e auditáveis
- [x] operationId obrigatório e preservado
- [x] cache invalidado somente após RPC bem-sucedida
- [x] reset sem linha preserva resposta do RPC sem criar auditoria na rota
- [x] pricing não calculado nesta wave
- [x] `current` representa configuração efetivamente executada
- [x] seleção inválida/deprecated/missing preservada como diagnóstico separado
- [x] defaults completos, 403, validações, retry e falha de RPC cobertos
