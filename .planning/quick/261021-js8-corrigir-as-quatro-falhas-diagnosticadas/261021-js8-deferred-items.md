---
id: 261021-js8
title: Follow-up LOW aceito — fidelidade do mock das RPCs do piloto no contrato da rota
status: accepted-non-blocking
date: 2026-10-21
source_review: revisão dos commits 742abe9b e 5301bc9a
scope: cobertura-de-teste
code_or_test_changes: none
---

# Follow-up LOW — mock do gate do piloto é success-only

## Origem

Achado da revisão final dos commits `742abe9b` (testes) e `5301bc9a` (documentação),
aceito pelo responsável como **follow-up não bloqueante** em 2026-10-21.

## Achado

No `copy-recovery.contract.test.ts`, o mock das RPCs do piloto modela apenas o caminho de
sucesso:

- `product_1_1_pilot_begin_paid_call` retorna **sempre** `{ success:true, outcome:"acquired" }`
  (`:207-220`). Não há responder para `existing_in_flight`, `closed` nem para os erros reais
  (`pilot_cap_not_configured`, `pilot_requires_reconciliation`, `pilot_stream_busy`,
  `pilot_busy`, `pilot_cap_reached`).
- `end_paid_call`, `mark_unknown` e `block_global` retornam sempre sucesso (`:221-230`),
  sem modelar falha, `idempotent` ou `call_id` de resposta.
- Não há asserção de que a RPC de `begin` foi efetivamente chamada; a suíte prova que o
  fluxo chega ao provider com o gate armado, mas **não prova o wiring do gate por si só**.
- `prepare()` ignora `target` e devolve sempre `primary` (`:247-263`). Isso é correto para
  os casos atuais (todos com `attempt_seq: 1`), mas não cobre fallback.

## O que está coberto neste contrato

- Identidade do `begin` é ecoada e validada pelo `spend-control` (envelope fechado).
- Vencedor executa **exatamente uma** chamada ao provider.
- Acompanhante não faz chamada adicional.
- Corpo real mínimo não retorna 400 e conclui com uma tentativa.

## Onde bloqueios/erros estão cobertos

A semântica do gate permanece coberta nas suítes específicas:

- `src/lib/product-1-1/__tests__/pilot-spend-control.behavioral.test.ts` — gate bloqueado,
  pricing ausente/inválido, sucesso via `invokePrepared` + `endPaidCall`, timeout/rede com
  `markUnknown` e falha M3 de `markUnknown`.
- `src/lib/product-1-1/__tests__/pilot-spend-control.contract.test.ts` — contrato do
  protocolo/persistência do gate.
- `src/lib/product-1-1/__tests__/resolve-pilot-spend-gate.test.ts` e
  `operational-pilot-spend-gate.contract.test.ts` — resolução tri-estado do gate.

## Impacto

- **Nenhum impacto funcional ou de produção**: a correção é test-only e não altera código de
  produto.
- **Cobertura**: lacuna de integração no contrato da rota, não de comportamento do gate.
- **Risco**: baixo; o comentário “envelopes fechados … como as RPCs reais” é mais amplo que
  a implementação para `end`/`mark`/`block`.

## Decisão e melhoria futura (não executada)

Aceito como **não bloqueante**. Se esta suíte for usada como prova do wiring do gate,
acrescentar em mudança própria:

1. um responder/configuração para `begin` (sucesso, `existing_in_flight`, `closed`, erro);
2. um contador de chamadas da RPC `begin` e asserção de que o gate foi acionado;
3. casos de falha em `end`/`markUnknown` no nível da rota.

Nenhum código, teste, allowlist ou configuração foi alterado por este registro.
