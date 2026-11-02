---
status: passed
phase: 58-f58-composi-o-operacional-do-dashboard
source: [58-VERIFICATION.md, evidence/58-05-human-visual.md]
started: 2026-11-02T18:08:30Z
updated: 2026-11-02T19:10:00Z
---

# F58 — Validação humana executada

Composição visual aprovada em pt-BR e es-419. O checklist funcional foi executado e registrado em `evidence/58-05-human-visual.md`; os resultados abaixo refletem a observação real, com as ressalvas instrumentais indicadas.

## Current Test

[completed — see `evidence/58-05-human-visual.md`]

## Tests

### 1. Tablet 640–1023 px
expected: Painel único com linhas verticais, ações legíveis e sem sobreposição; nomes longos em duas linhas.
result: PASS — captura a 768 px.

### 2. Slow 4G com preferência resolvida
expected: Esqueleto localizado e conteúdo final no idioma resolvido, sem troca visual posterior.
result: PASS com ressalva — pt-BR e es-419 observados; sem medição fina de performance.

### 3. Slow 4G com timeout/falha de preferência
expected: Fallback consistente em pt-BR, igual ao shell, sem segundo resolvedor.
result: PASS — proxy local atrasou somente `user_preferences`; log `preferences_read_timeout`.

### 4. Carregamento real com autenticação/preferência lentas
expected: Esqueleto antes do conteúdo, com `lang`/`aria-label` no idioma resolvido.
result: PASS com ressalva — esqueleto localizado observado; atraso específico de autenticação não foi injetado.

### 5. Fuso da loja diferente do servidor
expected: Saudação calculada pelo fuso da loja, não pelo servidor.
result: PASS — servidor com `TZ=Asia/Tokyo` manteve o período do fuso da loja.

### 6. Falha de leitura de fuso
expected: Saudação neutra (“Olá”/“Hola”), sem assumir `America/Sao_Paulo`.
result: PASS — observado em harness local de componentes, pt-BR/es-419.

### 7. Campanhas com erro em `/campanhas`
expected: Campanhas `error` fora das linhas/contagem/miniaturas do dashboard; acessíveis em `/campanhas`.
result: PASS — 59 disponíveis no dashboard; 3 erros em `/campanhas?status=error`.

### 8. Miniaturas nula e com falha
expected: Fallback `ImageOff` sem quebrar a ação “Abrir campanha”.
result: PASS — 3 fallbacks e ações preservadas; defeito pré-hidratação encontrado e corrigido.

### 9. Créditos zero e indisponível
expected: Zero mostra `0 créditos` uma única vez; indisponível mostra “Saldo indisponível” com ícone âmbar e sem `0`; ambos com `/conta`.
result: PASS — zero real com Lar & Amor; indisponível em harness local de componentes.

### 10. ReadinessCheckBanner pendente em pt-BR/es-419
expected: Título, itens pendentes, CTA e rótulos acessíveis no idioma da interface; defaults pt-BR preservados.
result: PASS — observado em harness local de componentes.

### 11. Contraste, zoom e truncamento extremo
expected: Contraste pelos tokens, layout íntegro em zoom e nomes longos truncados sem sobreposição.
result: PASS com ressalva — contraste medido (19,28:1 / 7,87:1 / 8,85:1), zoom e texto longo sem overflow; leitor de tela real não executado.

### 12. Admin manual
expected: `/admin` permanece em pt-BR, sem textos do namespace do dashboard, com shell/identidade intactos.
result: PASS — aberto com preferência es-419 e permaneceu em pt-BR.

## Summary

total: 14
passed: 14
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

Nenhum gap de implementação. Ressalvas: leitor de tela real não executado; medição fina de performance não realizada; atraso específico de autenticação não injetado; falha de crédito, falha de fuso e readiness foram observadas em harness de componentes, não como teste integrado completo do dashboard. Publicação não foi executada nem autorizada.
