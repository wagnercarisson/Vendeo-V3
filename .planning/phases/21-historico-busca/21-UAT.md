---
status: testing
phase: 21-historico-busca
source: 21-01-SUMMARY.md, 21-02-SUMMARY.md, 21-03-SUMMARY.md
started: "2026-07-14T19:55:00.000Z"
updated: "2026-07-14T20:30:00.000Z"
---

## Current Test

number: 10
name: Página inválida cai para página 1
expected: |
  Acessar /campanhas?page=999 mostra página 1 sem erro (crash ou blank)
awaiting: user response

## Tests

### 1. Página de campanhas carrega com controles de filtro
expected: Ao acessar /campanhas, a lista de campanhas é exibida com search input, chips de status (Todas/Pronta/Erro), dropdown de data e dropdown de ordenação
result: pass

### 2. Busca textual com debounce
expected: Digitar no campo de busca filtra os resultados após ~300ms sem pressionar botão
result: pass

### 3. Filtro por status
expected: Clicar em "Pronta" ou "Erro" filtra a lista e atualiza a URL com ?status=ready ou ?status=error
result: pass

### 4. Filtro por data
expected: Selecionar "7 dias", "30 dias" ou "90 dias" no dropdown filtra por data e atualiza a URL com ?date=7d
result: pass

### 5. Ordenação
expected: Alterar ordenação entre "Mais recentes", "Mais antigas", "Nome A-Z", "Nome Z-A" reordena a lista e atualiza a URL com ?sort=product_name&order=asc
result: pass

### 6. URL state compartilhável
expected: Copiar URL com filtros aplicados e colar em nova aba restaura os mesmos filtros e resultados
result: pass

### 7. Empty state sem campanhas
expected: Usuário sem nenhuma campanha vê o estado vazio com ícone, título descritivo e CTA "Nova Campanha"
result: pass

### 8. Empty state de busca sem resultados
expected: Busca que não encontra campanhas mostra "Nenhuma campanha encontrada" com sugestão de limpar filtros
result: pass

### 9. Paginação
expected: Com mais de 10 campanhas, botões de página aparecem — clicar navega e atualiza URL com ?page=N
result: pass

### 10. Página inválida cai para página 1
expected: Acessar /campanhas?page=999 mostra página 1 sem erro (crash ou blank)
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
