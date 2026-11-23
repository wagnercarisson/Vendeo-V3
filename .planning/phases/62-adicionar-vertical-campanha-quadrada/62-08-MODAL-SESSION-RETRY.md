# 62-08 — Modal da Jarra: 401 transitório e releitura read-only

**Status:** **CORRIGIDO E VALIDADO EM CHROME REAL; CLIQUE ABRE CUSTO + CONFIRMAÇÃO; `62-08` NÃO CONCLUÍDO.**
**Data:** 2026-11-23.
**Campanha:** `c06b16f5-f126-429c-b5b0-9567fe4adb95` — Jarra Finesse 1l.
**Origem da página:** `http://localhost:3000`.
**URL chamada pela modal:** mesmo origem,
`http://localhost:3000/api/campaign/c06b16f5…/format-additions` (GET relativo).
**Nenhum token, cookie ou segredo foi registrado.**

## Sintoma e reprodução

Em Chrome real (Playwright + Chrome instalado), a página foi aberta e o chip
“Vertical 9:16: Disponível para gerar” foi clicado. No caminho normal:

| Item | Resultado |
|---|---|
| Origem/porta da página | `http://localhost:3000` |
| URL efetivamente chamada | `/api/campaign/c06b16f5…/format-additions` (mesma origem) |
| HTTP | **200** |
| `state` | **eligible** |
| `reason` | `null` |
| `sourceOrigin` | `new_flow_1_1` |
| `costCredits` | **1** |
| `confirmationToken` | presente (apenas booleano verificado) |
| Texto da modal | **“Custo: 1 crédito”** |
| Botão | **“Confirmar adição” habilitado** |
| Erros de console/página | **nenhum** |

O caminho normal **não** reproduziu indisponibilidade. A diferença apareceu no
trace do servidor e em uma reprodução controlada da sessão.

## Causa identificada

O trace do Next registrou, no clique que falhou (22:09:16 UTC), **apenas** o
`handle-request` do middleware (~7 ms), **sem** o span da rota
`/api/campaign/[id]/format-additions/route`. O middleware devolve
`401 { error: "Unauthorized" }` para GET de API sem `claims.sub` — inclusive
quando a sessão está no meio da renovação de token.

A modal tratava **qualquer** resposta não-OK como falha terminal:

```ts
if (!response.ok || json === null) {
  setFailed(true);
  setDto({ state: "unavailable" });
  clearTimer();
  return;
}
```

Ou seja, um 401 transitório (corrida de refresh do middleware) encerrava a
modal em indisponibilidade, **sem nova tentativa**, enquanto a consulta direta
feita depois — já com a sessão renovada — retornava `eligible`. O trace confirma
que a requisição que falhou não chegou à rota; a causa é anterior à elegibilidade
da fonte, não uma recusa de fonte/flag.

## Correção mínima

Em `src/components/campaign/add-vertical-dialog.tsx`, o GET passou a ser feito
por uma função `requestOnce()`. Quando a primeira resposta é **401** e não é
polling silencioso, a modal aguarda **250 ms** e faz **uma única releitura**
read-only do mesmo endpoint. A resposta da releitura segue o fluxo normal de
validação.

- Abort/sessão obsoleta continuam interrompendo a leitura.
- Polling silencioso não dispara retry.
- Um segundo 401 ainda resulta em indisponibilidade; não há loop.
- Nenhuma validação de fonte, flag, autorização ou token foi removida.
- Nenhum estado `eligible` é forçado: a releitura chama o mesmo GET validado.

## Prova em navegador real

Reprodução controlada do 401 transitório, **sem mock de fetch**: a página foi
carregada autenticada, os cookies foram removidos, o chip foi clicado e os
cookies foram restaurados assim que o 401 chegou.

| Evento | Tempo relativo | Resultado |
|---|---|---|
| Primeiro GET | t0 | **401** (middleware) |
| Cookies restaurados | t0 | sessão novamente disponível |
| Releitura automática | **+258 ms** | **200** |
| Estado da releitura | — | **`eligible`**, `new_flow_1_1`, 1 crédito |
| Modal após a releitura | — | **“Custo: 1 crédito”** |
| Botão | — | **“Confirmar adição” habilitado** |
| Erros de console/página | — | **nenhum** |

O clique normal (sem interferência) também foi executado no mesmo Chrome e
abriu a modal com custo e confirmação habilitada. Portanto, o critério foi
atendido em navegador real, não apenas por GET isolado.

## Testes e gates

- Novo teste: 401 transitório → releitura → custo + confirmação habilitada.
- Novo teste: 401 persistente → no máximo 2 GETs, sem confirmação.
- Suíte afetada: **7 arquivos / 126 testes PASS**.
- `npm.cmd run typecheck`: **0**.
- OpenSpec strict: **1/0**.
- `git diff --check`: limpo.

## Garantias

| Verificação | Resultado |
|---|---|
| POST de confirmação | **não executado** |
| IA / provider / geração | **não executados** |
| Cobrança | **não executada** |
| Adições da Jarra | **0** |
| Status da campanha | `ready` (inalterado) |
| Operação primária | `delivered` (inalterada) |
| Saldo da loja | **8** (inalterado) |
| Flags/configurações | **não alteradas nesta correção** |

## Estado final

- App rodando em `http://localhost:3000`.
- Clique real no chip abre a modal com **“Custo: 1 crédito”** e **“Confirmar
  adição” habilitado**.
- A confirmação não foi enviada; a geração continua sendo ação manual.
- `62-08` permanece **não concluído**.
