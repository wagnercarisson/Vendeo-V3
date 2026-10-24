---
type: quick
status: executed_pending_review
date: 2026-10-23
---

# Regra de timestamps reais e unicidade de migrations

Solicitação: registrar nos artefatos de agentes o uso do horário real de criação nas versões de migrations e a decisão de preservar F50.3 na colisão com F47.1.

1. Atualizar AGENTS.md e o guia obrigatório com formato UTC `YYYYMMDDHHmmss`, checagem de unicidade entre branches e proibição de alteração silenciosa de ledgers.
2. Registrar que F47.1 será renumerada somente na integração autorizada, preservando evidências históricas; não renumerar F50.3.
3. Registrar a distinção entre validação local e preparação produtiva.
4. Verificar diff; entregar sem commit, merge, alteração de migration/runtime/banco, chamada paga ou deploy.
