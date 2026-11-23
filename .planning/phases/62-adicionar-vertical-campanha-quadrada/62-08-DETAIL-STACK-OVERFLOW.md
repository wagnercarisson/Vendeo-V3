# 62-08 — Correção do stack overflow na página de detalhe (F62)

**Status:** **CORRIGIDO E VALIDADO NO NEXT LOCAL; PÁGINA 200; CONFIRMAÇÃO DISPONÍVEL; SEM GERAÇÃO/COBRANÇA; `62-08` NÃO CONCLUÍDO.**
**Data:** 2026-11-23.
**Branch / HEAD de partida:** `feat/campaign-add-vertical` / `78940ca4`.
**Alvo:** Next local `http://localhost:3000`; DB `127.0.0.1:57782/postgres`; API/Storage `127.0.0.1:57781`.
**Produção, provider, crédito, geração, flags, migrations, segredos, merge, push e deploy:** não acionados.

## Sintoma reproduzido

Campanha autenticada da Padaria da Esquina:

`14278411-c1fd-4884-9760-ee0dcf98da06`

| Requisição | Antes |
|---|---|
| `GET /campanhas/14278411…` | **500** — `RangeError: Maximum call stack size exceeded` (`digest 211981331`) |
| `GET /campanhas/14278411…?format=1:1` | **500** |
| `GET /campanhas/14278411…?format=9:16` | **500** |
| Fixture F62 `e6e26446…` (entregue) | **200** |
| Fixture F62 `91c69085…` (sem adição) | **200** |

O erro ocorria no pipe da resposta (`failed to pipe response`), depois que a página já havia executado as leituras e até um retorno simples `<div>`.

## Origem (evidência)

1. **Leitura server-side:** todas as etapas concluíram — `requirePageUser`, loja/locale, campanha, adição, operação, copy/recovery, probe.
2. **Props:** `JSON.stringify({props, messages, locale})` concluiu com **5.490 bytes** (Padaria) vs **5.031 bytes** (F62 sem adição). Sem ciclos; profundidade 4; diferenças apenas em `campaignId`, `createdAt/updatedAt`, `productName`, `isPublicationCopyEdited`, `operationId`, `imageUrl` e `copy/recovery`.
3. **Serialização RSC:** `renderToReadableStream` com as props reais concluiu (`4.921` vs `4.761` bytes).
4. **Render isolado:** `renderToStaticMarkup` de `CampaignPageClient` concluiu para ambas.
5. **Layout:** retorno simples `<div>` com layout bare ainda deu 500 na Padaria e 200 na F62 — não era o layout.
6. **Bisect na página:**
   - `f62debug=skip-probe` → **200**;
   - `f62debug=probe-only` → **200**;
   - `f62debug=skip-url` (probe sem assinatura) → **500**;
   - `f62debug=download-only` → **500**;
   - `f62debug=download-no-store` → **500**;
   - `f62debug=download-node-http` → **200**.

**Causa:** o download binário do JPEG da Padaria (1024×1024, 278.311 bytes, JPEG normal, sem EXIF/profile) via `storage-js`/`fetch`/`Blob` dentro do Server Component disparava o stack overflow no pipe da resposta do Next. `sharp` e a leitura de metadados não eram o gatilho; o mesmo arquivo via `node:http` é entregue normalmente. A fixture F62 (43.187 bytes) não reproduzia.

## Correção mínima

- Novo helper `src/lib/product-1-1/artifact/node-http-storage-download.ts`:
  - baixa o objeto via `node:http`/`node:https` com `Authorization`/`apikey` do service role;
  - path canônico com segmentos encodados;
  - limite de 10 MB (mesmo limite do bucket);
  - falha fechada em status ≠ 200, corpo grande ou erro de rede.
- `ProductOneToOneArtifactStore` ganhou um terceiro parâmetro opcional
  `downloadBytes`; `probeArtifact` usa esse transporte **somente** para os bytes,
  mantendo a validação por `sharp`/dimensões/metadados. Sem o parâmetro, o
  comportamento anterior (`storage-js`) permanece.
- A página de detalhe injeta o helper **apenas** no probe 1:1 do preview. O
  `VerticalArtifactStore`, o download route e os demais callers não mudaram.
- A validação do probe foi **preservada**; nenhuma funcionalidade foi removida.

## Testes

- `artifact-store.contract.test.ts`: +2 testes (downloader injetado é usado e
  `storage.download` não é chamado; falha do downloader ⇒ `indeterminate`).
- `node-http-storage-download.test.ts`: 3 testes com servidor HTTP local
  (bytes exatos, 404, content-length acima do limite).
- Resultado: **2 arquivos / 42 testes PASS**.
- `npm.cmd run typecheck`: **0**.
- `git diff --check`: limpo.

## Resultado HTTP real depois da correção

| Requisição | Depois |
|---|---|
| `GET /campanhas/14278411…` | **200** (12.321.635 bytes no dev) |
| `GET /campanhas/14278411…?format=1:1` | **200** |
| `GET /campanhas/14278411…?format=9:16` | **200** |
| Fixtures F62 (entregue, sem adição, adição aberta) | **200** |

Conteúdo da página da Padaria:

- ação **“Adicionar vertical 9:16”** presente;
- rótulos “Vertical 9:16” e “Quadrado 1:1” presentes;
- nenhum `confirmationToken` embutido no HTML (o modal busca ao abrir).

Endpoint de confirmação (GET read-only):

- `GET /api/campaign/14278411…/format-additions` → **200**;
- `state=eligible`, `costCredits=1`, `confirmationToken` presente;
- nenhum POST de confirmação foi feito.

Antes/depois da carga da página:

| Métrica | Antes | Depois |
|---|---|---|
| Adições da campanha | 0 | 0 |
| Operações de crédito | 1 (primária) | 1 |
| Saldo da loja | 3 | 3 |

Portanto, a confirmação de **1 crédito** está **disponível**, mas **não foi
enviada automaticamente** e nenhuma geração/cobrança ocorreu.

## Limitações

- O clique no chip não foi automatizado (não há Playwright/Puppeteer instalado
  no repositório). A ação está presente e ligada ao `AddVerticalDialog`; o
  endpoint GET devolve o estado `eligible`/1 crédito que o modal consome. O
  responsável fará o clique e a geração manualmente.
- O dev server foi iniciado com `NODE_OPTIONS=--stack-trace-limit=200` para
  diagnóstico; isso não altera o comportamento da aplicação.
- A página continua em modo dev (`npm run dev`), não é build de produção.
- Nenhuma flag, migration, segredo ou regra de negócio foi alterada.

## Estado final

- `http://localhost:3000` permanece em execução.
- A página da Padaria está funcionando e a confirmação do vertical está
  disponível para o teste manual.
- Nenhuma geração foi executada; nenhum crédito foi cobrado.
- `62-08` segue **não concluído**; provider pago, validação visual e release não
  foram autorizados.
