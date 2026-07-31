---
status: resolved
phase: 35-changelog-novidades
source: [35-VERIFICATION.md]
started: 2026-07-31T15:50:00Z
updated: 2026-07-31T16:05:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Sidebar com indicador
expected: Item "Novidades" aparece como 5º link após "Conta" com ponto indicador verde (primeiro acesso, localStorage limpo)
result: approved — usuário validou o ponto indicador verde no 5º item da sidebar (checkpoint 35-05 aprovado)

### 2. Card de anúncio na dashboard
expected: Card "Freemium CNPJ" (F32) aparece acima do conteúdo, abaixo dos banners; × some o card mantendo o indicador; reload não reaparece
result: approved — usuário validou card, dispensa × com indicador persistente e não reaparecimento após reload (checkpoint 35-05 aprovado)

### 3. Página /novidades
expected: 3 entries na ordem F34 (01/08/2026) → F32 (31/07/2026) → F30 (30/07/2026), badges de categoria com cores corretas, datas dd/mm/aaaa sem deslocamento de dia
result: approved — usuário validou ordem, cores de badge e datas (checkpoint 35-05 aprovado)

### 4. Indicador some após visita
expected: Após visitar /novidades, voltar ao dashboard → indicador da sidebar some e anúncio não reaparece
result: approved — usuário validou sincronização via evento (checkpoint 35-05 aprovado)

### 5. AccountMenu
expected: Dropdown mostra Configurações, Novidades (entre Configurações e Sair) e Sair; "Novidades" navega para /novidades
result: approved — usuário validou posição do link e navegação (checkpoint 35-05 aprovado)

### 6. Botão "Ver novidades"
expected: Resetar localStorage, clicar "Ver novidades" no card → navega para /novidades e card some ao voltar
result: approved — usuário validou fluxo completo (checkpoint 35-05 aprovado)

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
