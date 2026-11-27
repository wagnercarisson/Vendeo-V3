---
quick_id: 261126-tmn
slug: regularizar-acabamento-local-e-preparar-
mode: quick
date: 2026-11-26
status: planned
---

# Quick 261126-tmn — Acabamento local e preparação da consolidação Git da F63

## Objetivo

Eliminar o warning de lint introduzido na F63, auditar o worktree sem alterar a entrega já
encerrada no homolog e preparar o agrupamento de commits para aprovação, parando no Review Stop.

## Escopo

- Corrigir somente o parâmetro não utilizado em `scripts/f63/preservation-report.mjs`.
- Auditar e classificar todos os arquivos novos/modificados.
- Verificar hashes das migrations A/B/C contra as evidências.
- Registrar o resultado e corrigir a classificação do warning como anterior à F63.
- **Não** executar `git add`, commit, push, merge, deploy, migration ou operação remota.

## Tasks

### Task 1 — Remover parâmetro não utilizado

- **files:** `scripts/f63/preservation-report.mjs`
- **action:** remover `stage` da assinatura de `buildSchemaComparison` e ajustar a chamada,
  sem alterar comportamento, sem desabilitar regra e sem supressão.
- **verify:** `node --check`, `npx eslint` no arquivo, import do módulo e `--help` exit 0.
- **done:** warning eliminado; `npm run lint` exit 0; distinção de lint TS preservada.

### Task 2 — Auditar o worktree

- **files:** estado Git completo (modificados + não rastreados)
- **action:** levantar contagens reais, classificar por tipo, procurar credenciais/URLs com
  senha/tokens/dumps/dados pessoais/gerados indevidos sem imprimir valores; conferir hashes
  das migrations contra as evidências.
- **verify:** inventário classificado; hashes A/B/C idênticos às evidências; nenhum arquivo
  removido e nenhum padrão amplo adicionado ao `.gitignore`.
- **done:** arquivos duvidosos listados com recomendação e decisão pendente.

### Task 3 — Registrar e preparar consolidação

- **files:** `.planning/quick/261126-tmn-.../261126-tmn-SUMMARY.md`, `.planning/STATE.md`,
  `.planning/phases/63-base-versionada-de-ofertas-2a/63-05-SUMMARY.md`,
  `.planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-05-verification.md`
- **action:** registrar resultados, corrigir a classificação do warning e propor agrupamento
  de commits com listas explícitas.
- **verify:** `git diff --check` exit 0; pendências preservadas (lint TS não validado, três
  falhas globais, comentário SQL desatualizado); nenhuma operação Git executada.
- **done:** Review Stop apresentado; consolidação Git aguardando aprovação específica.
