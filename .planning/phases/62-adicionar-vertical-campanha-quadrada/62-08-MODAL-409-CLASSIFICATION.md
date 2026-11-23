# 62-08 — Modal da Jarra na aba real: GET 200 e 409 no POST

> **SUPERSEDIDA (2026-11-23).** O POST manual real retornou **403
> `confirmation_expired`**, sem operação/reserva. Ver
> `62-08-MODAL-POST-403-CONFIRMATION-EXPIRED.md`. O 409 do console era de uma
> tentativa anterior e o corpo não foi preservado.

**Status:** **INVESTIGADO NA ABA REAL; GET 200 `eligible`; 409 CLASSIFICADO NO RAMO DO POST; RETRY DE 401 REMOVIDO; `62-08` NÃO CONCLUÍDO.**
**Data:** 2026-11-23.
**Aba afetada:** Microsoft Edge, aba ativa
`http://localhost:3000/campanhas/c06b16f5-f126-429c-b5b0-9567fe4adb95`.
**Sessão:** a mesma aba/sessão do responsável; cookies não foram removidos.
**Nenhum token, cookie ou segredo foi registrado.**

## Captura na aba afetada

O clique foi feito no chip real da própria aba, com interceptação read-only de
`window.fetch` no console do DevTools.

| Item | Resultado |
|---|---|
| Origem/porta da página | `http://localhost:3000` |
| URL chamada | `/api/campaign/c06b16f5…/format-additions` (mesma origem) |
| Método | **GET** |
| HTTP | **200** |
| `state` | **eligible** |
| `sourceOrigin` | **new_flow_1_1** |
| `costCredits` | **1** |
| `confirmationToken` | presente (apenas booleano; valor não registrado) |
| Corpo relevante | `{ state: "eligible", sourceOrigin: "new_flow_1_1", costCredits: 1 }` |
| Texto da modal | **“Custo: 1 crédito”** |
| Botão | **“Confirmar adição” habilitado** |
| `data-state` / `data-reason` | `eligible` / `null` |
| Exceção JavaScript no GET | **nenhuma** |

O GET disparado pelo clique **não** leva a modal a indisponível.

## Erro real no console da aba

A aba registrava **um** erro de rede:

```
http://localhost:3000/api/campaign/c…/format-additions:1
Failed to load resource: the server responded with a status of 409 (Conflict)
```

O GET não possui caminho que devolva 409. Na rota, 409 vem do **POST** de
confirmação (`operation_exists`, `retry_not_allowed`, `source_changed`,
`gate_blocked` etc.). O corpo dessa resposta **não foi preservado**: o DevTools
foi aberto depois da requisição e o painel Network informou “Request unavailable
… Try reloading the inspected page”. A classificação técnica confirmada é
**409 Conflict**; o código específico do corpo não pôde ser recuperado.

## Versão do código servida na aba

Antes da correção, a aba carregava:

- `/_next/static/chunks/app/(app)/campanhas/%5Bid%5D/page.js` contendo
  `TRANSIENT_401_RETRY_DELAY_MS` e `status===401` — ou seja, **já tinha o retry
  de 401 da hipótese anterior**;
- `main-app.js?v=1795474290654` / `webpack.js?v=1795474290654`, enquanto o
  servidor atual servia `v=1795474803422` (shell ligeiramente anterior).

Após a correção e um **reload na mesma aba/sessão**, o mesmo chunk passou a
conter `operation_exists`, `confirmation_failed` e `data-reason`, e **não**
contém mais `TRANSIENT_401_RETRY_DELAY_MS`. O GET continuou **200 `eligible`**,
com custo e confirmação habilitada.

## Ramo que levava a “indisponível”

No `submit` do POST, qualquer resposta não-OK era colapsada:

```ts
if (!response.ok || json === null || !("state" in json)) {
  setFailed(true);
  setDto((prev) =>
    prev ? { ...prev, state: "unavailable", reason: "failed" } : prev,
  );
  return;
}
```

Isso descartava `error.code`/`reason` do 409 e exibia a mensagem de falha com
promessa de estorno, perdendo a classificação técnica. Era esse o ramo que
levava a modal a “indisponível”, **não** o GET.

## Correção aplicada

1. **Retry de 401 removido** — a hipótese não se confirmou; o GET da aba real é
   200. Não foi adicionada nova espera/retry.
2. **Classificação preservada:** `rejectionReason()` lê somente
   `error.code` ou `reason` com formato seguro `[a-z0-9_]{1,64}`; mensagens
   cruas do servidor não são expostas.
3. **Mensagens específicas** para `operation_exists`, `retry_not_allowed`,
   `source_changed`, `source_not_eligible` e falha genérica
   (`confirmation_failed`), em pt-BR e es-419.
4. **Diagnóstico no DOM:** `data-state` e `data-reason` no diálogo, sem token,
   cookie, mensagem crua ou segredo.
5. **Sem forçar elegibilidade e sem remover gate:** o POST continua sujeito a
   todas as validações; apenas a classificação e a mensagem deixam de ser
   genéricas.

## Validação

- Mesma aba/sessão do Edge, recarregada sem remover cookies: GET **200
  `eligible`**, corpo sem token, modal com **“Custo: 1 crédito”** e
  **“Confirmar adição” habilitado**, sem exceção JavaScript.
- Chunk novo servido na aba, com o código de classificação e sem o retry.
- Ramo 409 do POST coberto por testes unitários (`operation_exists`, gate com
  `reason` técnico e falha sem código). O POST real **não foi executado**, para
  não iniciar geração/cobrança.
- Suíte afetada: **7 arquivos / 127 testes PASS**.
- Typecheck: **0**; OpenSpec strict: **1/0**; `git diff --check`: limpo.

## Limitação explícita

O código específico do 409 original (`operation_exists`, `source_changed`,
`gate_blocked` ou outro) **não foi recuperado**, porque o corpo não foi
preservado pelo DevTools. A correção preserva e exibe qualquer código seguro
quando o POST voltar a responder; não se declara que aquele gate/conflito
específico foi removido.

## Garantias

| Verificação | Resultado |
|---|---|
| Cookies removidos | **não** |
| 401 simulado | **não** |
| POST / geração / cobrança | **não executados** |
| IA / provider | **não executados** |
| Adições da Jarra | **0** |
| Status da campanha | `ready` (inalterado) |
| Operação primária | `delivered` (inalterada) |
| Saldo da loja | **8** (inalterado) |
| Flags/configurações | **não alteradas** |

App segue em `http://localhost:3000`. `62-08` permanece **não concluído**.
