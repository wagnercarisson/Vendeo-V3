---
status: complete
phase: 16-minhas-campanhas
source:
  - 16-01-SUMMARY.md
  - 16-02-SUMMARY.md
  - 16-03-SUMMARY.md
started: 2026-07-10T14:30:00Z
updated: 2026-07-10T14:55:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Redirect /campaign/preview → /minhas-campanhas
expected: Acessando /campaign/preview autenticado com loja, redireciona para /minhas-campanhas sem mostrar preview antigo
result: pass

### 2. Link "Minhas Campanhas" no AuthHeader
expected: Header mostra link "Minhas Campanhas" quando autenticado, antes do logout
result: pass

### 3. Estado vazio da listagem
expected: Conta sem campanhas mostra "Nenhuma campanha encontrada" + CTA "Criar Primeira Campanha"
result: pass

### 4. Back link "← Minhas Campanhas" em /campanha/[id]
expected: Link no topo da página volta para /minhas-campanhas
result: pass

### 5. Proteção de rota — não autenticado
expected: Acessar /minhas-campanhas sem login redireciona para /login
result: pass

### 6. Link "Baixar" só para campanhas ready
expected: Apenas campanhas com status ready exibem link de download
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

(none)
