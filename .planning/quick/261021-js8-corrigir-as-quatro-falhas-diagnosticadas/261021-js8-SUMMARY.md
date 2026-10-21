---
id: 261021-js8
title: Corrigir as quatro falhas diagnosticadas na quick 261021-jl9
status: complete
scope: correcao-test-only
date: 2026-10-21
branch: integracao/landing-app-atual
head_start: ccd09b65
source_diagnosis: .planning/quick/261021-jl9-investigar-as-quatro-falhas-preexistente/
product_code_changes: none
process:
  command_invoked: true
  command: /gsd-quick
  artifacts: PLAN.md + SUMMARY.md + STATE.md
gates:
  target_files:
    command: npx --no-install vitest run src/lib/product-1-1/__tests__/copy-recovery.contract.test.ts src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts
    result: 2 files passed; 132/132; exit 0
  gate_suites:
    command: npx --no-install vitest run src/lib/product-1-1/__tests__/pilot-spend-control.behavioral.test.ts src/lib/product-1-1/__tests__/pilot-spend-control.contract.test.ts src/lib/product-1-1/__tests__/resolve-pilot-spend-gate.test.ts src/lib/product-1-1/__tests__/operational-pilot-spend-gate.contract.test.ts
    result: 4 files passed; 51/51; exit 0
  typecheck: pass — `npm run typecheck` exit 0
  lint: pass — `npm run lint` exit 0
  git_diff_check: pass — clean
  paid_calls: none
  provider: none (simulado)
  database: none
  migrations: none
  commit_push_deploy: local commit only
---

# Quick 261021-js8 — Correção test-only das quatro falhas

## Resultado

As quatro falhas diagnosticadas na `261021-jl9` foram corrigidas **exclusivamente em
testes**, sem alteração de código de produto. Resultado: `132/132` nos dois arquivos e
`51/51` nas suítes do gate. Typecheck, lint e `git diff --check` limpos.

**Nenhum defeito funcional foi evidenciado** — não houve validação produtiva nesta rodada.

## 1. `copy-recovery.contract.test.ts` (falhas 1–3)

### Abordagem adotada

Optou-se por **manter o gate ARMADO** e reconciliar o harness com o contrato atual, em vez
de mockar `resolvePilotSpendGate` como `inactive`. Assim, a rota continua exercitando o
caminho real gate → runner → provider:

1. O mock de Supabase (`routeHarness.client.rpc`) passou a responder às RPCs do piloto com
   envelopes FECHADOS, incluindo a identidade enviada:
   - `product_1_1_pilot_begin_paid_call` → `{ success:true, outcome:"acquired", call_id,
     campaign_id, operation_id, kind, attempt_seq }`;
   - `product_1_1_pilot_end_paid_call` → `{ success:true, state:"released" }`;
   - `product_1_1_pilot_mark_unknown` / `product_1_1_pilot_block_global` → sucesso.
2. O provider simulado ganhou `prepare()` (alvo fixo `openai/gpt-4o/chat-completions`) e
   `invokePrepared()`, ambos contabilizando em `providerCalls` pelo mesmo `simulateProvider()`
   usado por `invoke()`.
3. `AiModelPricingService` foi mockado com pricing determinístico
   (`inputCostUsd: 0.1`, `outputCostUsd: 0.5`, `versionId: "test-copy-recovery"`), porque o
   runner exige pricing cadastrado (não `code_default`) quando o gate está armado.

### Asserções preservadas

- VENCEDOR: `acquired_completed`, estado `completed`, **`providerCalls === 1`**.
- ACOMPANHAMENTO: primeira chamada gera **1** chamada ao provider; segunda não gera
  chamada adicional (`providerCalls === 1`), com `outcome: "accompanied"`.
- Corpo real mínimo: não retorna 400, conclui e devolve `acquired_completed` com 1 chamada.
- Nenhuma asserção foi enfraquecida ou removida.

### Cobertura do caminho com gate ativo

As RPCs e o gate reais são exercitados no contrato da rota. A semântica do gate
(bloqueio, pricing ausente, sucesso, timeout/rede, `markUnknown`) permanece coberta em
`pilot-spend-control.behavioral.test.ts` (gate ativo + provider simulado).

## 2. `legacy-frontier.guard.test.ts` (falha 4)

Acrescentada uma única entrada à `AUTHORIZED_FRONTIER_CHANGES`:

- `path: "src/lib/credit/credit-service.ts"`
- `authorization: "F50.2 (leitura de enrollment do teste gratuito — aditiva/read-only)"`
- `commit: "05e81d90"`

`BASE_SHA` (`335bfb70`), `LEGACY_FRONTIER_PATHS`, o conjunto exato (32 caminhos), a
comparação de conteúdo contra o commit aprovado e os testes negativos **não foram alterados**.
Como o caminho entra em `ADDITIONAL_AUTHORIZED_FILES`, qualquer modificação futura no arquivo
continua detectada por diferença de conteúdo.

## 3. Evidências

```text
npx --no-install vitest run \
  src/lib/product-1-1/__tests__/copy-recovery.contract.test.ts \
  src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts
→ Test Files 2 passed (2); Tests 132 passed (132); exit 0
```

```text
npx --no-install vitest run \
  src/lib/product-1-1/__tests__/pilot-spend-control.behavioral.test.ts \
  src/lib/product-1-1/__tests__/pilot-spend-control.contract.test.ts \
  src/lib/product-1-1/__tests__/resolve-pilot-spend-gate.test.ts \
  src/lib/product-1-1/__tests__/operational-pilot-spend-gate.contract.test.ts
→ Test Files 4 passed (4); Tests 51 passed (51); exit 0
```

- `npm run typecheck` → exit 0 (sem saída de erro).
- `npm run lint` → exit 0 (sem saída de erro).
- `git diff --check` → limpo.

## 4. Diff

Somente dois arquivos de teste:

- `src/lib/product-1-1/__tests__/copy-recovery.contract.test.ts` — RPCs do piloto no mock,
  `prepare`/`invokePrepared` no provider simulado e pricing determinístico.
- `src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts` — uma entrada de allowlist
  vinculada a `05e81d90`.

Nenhum arquivo de produto, dependência, banco, política, flag ou configuração foi tocado.
Sem merge para `main`, push, deploy, tag ou lifecycle OpenSpec.

## 5. Nota de escopo

A correção não exigiu código de produto nem ampliação de escopo. O comportamento funcional
do aplicativo não foi alterado; portanto, **nenhum defeito funcional foi evidenciado** nesta
rodada. A validação é exclusivamente de contrato/harness e de governança da fronteira.

## 6. Follow-up LOW aceito (não bloqueante)

A revisão final dos commits `742abe9b`/`5301bc9a` identificou que o mock das RPCs do piloto
modela apenas o caminho de sucesso: `begin` sempre devolve `acquired`, `end`/`mark_unknown`/
`block_global` sempre devolvem sucesso e não há asserção de que a RPC `begin` foi chamada.
Isso deixa a **cobertura do wiring do gate parcial neste contrato**; a identidade do `begin`
é preservada e validada, e o fluxo até o provider é exercitado.

Os bloqueios/erros do gate permanecem cobertos nas suítes específicas
(`pilot-spend-control.behavioral.test.ts`, `pilot-spend-control.contract.test.ts`,
`resolve-pilot-spend-gate.test.ts` e `operational-pilot-spend-gate.contract.test.ts`).

O achado foi **aceito como não bloqueante**. Registro completo e melhoria futura (não
executada) em `261021-js8-deferred-items.md`. Nenhum código ou teste foi alterado por este
registro.
