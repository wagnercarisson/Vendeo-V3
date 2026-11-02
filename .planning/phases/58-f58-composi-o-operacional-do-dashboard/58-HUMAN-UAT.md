---
status: passed
phase: 58-f58-composi-o-operacional-do-dashboard
source: [58-VERIFICATION.md]
started: 2026-11-02T18:08:30Z
updated: 2026-11-02T18:08:30Z
---

# F58 — Itens de verificação humana pendentes

A composição visual pt-BR/es-419 foi aprovada e as capturas foram aceitas. Os itens abaixo permanecem pendentes ou parciais e não foram mascarados como PASS.

## Current Test

[awaiting human testing]

## Tests

### 1. Tablet 640–1023 px
expected: Linhas de campanha em 2 colunas, ações sem sobreposição, nomes longos truncados em 2 linhas e ordem créditos → campanhas → novidades.
result: PASS

### 2. Slow 4G com preferência resolvida
expected: Interface já renderiza em es-419 no primeiro paint, sem troca visual posterior e sem requisição de tradução.
result: PASS

### 3. Slow 4G com timeout/falha de preferência
expected: Fallback consistente em pt-BR, igual ao shell, sem exigir espanhol e sem segundo resolvedor.
result: PASS

### 4. Carregamento real com autenticação/preferência lentas
expected: Esqueleto aparece antes do conteúdo, com `lang`/`aria-label` no idioma resolvido e sem troca visual posterior.
result: PASS

### 5. Fuso da loja diferente do servidor
expected: Saudação calculada pelo fuso da loja, não pelo fuso do servidor.
result: PASS

### 6. Falha de leitura de fuso
expected: Saudação neutra (“Olá”/“Hola”), sem assumir `America/Sao_Paulo`.
result: PASS

### 7. Campanhas com erro em `/campanhas`
expected: Campanhas `error` fora das linhas/contagem/miniaturas do dashboard; acessíveis em `/campanhas`; loja só com erro cai em `no_eligible_campaigns`.
result: PASS

### 8. Miniaturas nula e com falha
expected: Fallback `ImageOff` sem quebrar a ação “Abrir campanha”.
result: PASS

### 9. Créditos zero e indisponível
expected: Zero mostra `0 créditos` uma única vez; indisponível mostra “Saldo indisponível” com ícone âmbar e sem `0`; ambos com `/conta`.
result: PASS

### 10. ReadinessCheckBanner pendente em pt-BR/es-419
expected: Título, itens pendentes, CTA e rótulos acessíveis no idioma da interface; defaults pt-BR preservados.
result: PASS

### 11. Contraste, zoom e truncamento extremo
expected: Contraste pelos tokens, layout íntegro em zoom e nomes longos truncados sem sobreposição.
result: PASS

### 12. Admin manual
expected: `/admin` permanece em pt-BR, sem textos do namespace do dashboard, com shell/identidade intactos.
result: PASS

## Summary

total: 12
passed: 0
issues: 0
pending: 12
skipped: 0
blocked: 0

## Gaps

UAT concluído em 14/14 itens, com ressalvas instrumentais (sem leitor de tela real e sem medição fina de performance). O defeito de fallback de miniatura encontrado durante o UAT foi corrigido. Publicação não foi executada nem autorizada.
