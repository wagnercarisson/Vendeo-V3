---
phase: 62-adicionar-vertical-campanha-quadrada
plan: 05
subsystem: campaign-format-addition
tags: [route, token, ui, modal, detail, offline, awaiting-review]

requires:
  - phase: 62-adicionar-vertical-campanha-quadrada
    provides: orquestração aceita do 62-04 (abertura, preparação, expansão, entrega, falha/unknown)
provides:
  - GET/POST autenticados da adição com token HMAC curto
  - modal de confirmação/acompanhamento e ação no chip do detalhe
  - seleção `?format=9:16`, preview e download assinados
affects: [62-05, 62-06]

key-files:
  created:
    - src/app/api/campaign/[id]/format-additions/route.ts
    - src/app/api/campaign/[id]/format-additions/__tests__/route.test.ts
    - src/lib/campaign/format-addition/confirmation-token.ts
    - src/lib/campaign/format-addition/__tests__/confirmation-token.test.ts
    - src/components/campaign/add-vertical-dialog.tsx
    - src/components/campaign/__tests__/add-vertical-dialog.test.tsx
    - src/app/(app)/campanhas/[id]/__tests__/format-addition.test.tsx
  modified:
    - src/app/(app)/campanhas/[id]/page.tsx
    - src/app/(app)/campanhas/[id]/client.tsx
    - src/components/campaign/campaign-format-chips.tsx
    - src/components/campaign/__tests__/campaign-format-chips.test.tsx
    - src/lib/product-1-1/__tests__/non-activation.contract.test.ts
    - src/lib/campaign/square-base/__tests__/boundaries.contract.test.ts
    - src/lib/product-two-format/orchestration/__tests__/joint-boundaries.contract.test.ts
    - src/__tests__/app/campaign-detail-format.test.tsx

key-decisions:
  - "GET é read-only: sem ponte, reserva, preparação, geração ou saldo; só resolve vínculo/fonte/elegibilidade."
  - "POST aceita apenas formato + token; requestId/checksum vêm do token verificado, never from client."
  - "Token HMAC-SHA256 de 10 min, vinculado a campanha/fonte/custo/intent; segredo ausente falha fechado."
  - "authorizeProductFlow e pilotSpendResolver são reais no root, derivados da decisão server-side e do gate do piloto."
  - "Flag dedicada desligada bloqueia apenas novas adições/retries; estado ativo continua visível."
  - "Chip do detalhe abre modal; lista/dashboard permanecem sem ação e o link entregue continua sendo `<a>`."
  - "O detalhe só seleciona o vertical com arte/preview comprovados; download vertical é URL assinada."

requirements-completed: [ADD-ELIG-01, ADD-LINK-03, ADD-READ-10, ADD-GATE-09, FMT-ADD-12, PAGE-ADD-13]

duration: ~70 min
completed: 2026-11-23
---

# Phase 62 Plan 05 — rota, token e jornada do detalhe

**Preflight read-only, confirmação com token server-issued, acompanhamento no modal e seleção segura do vertical 9:16**

> **Status: ACEITO TECNICAMENTE EM 2026-11-23 — LOCAL/OFFLINE.** O plano 62-05
> está concluído com as correções C6–C11. A migration do 62-02 não foi aplicada.
> Nenhum banco, Storage, provider, geração, flag em ambiente, merge, push, deploy,
> sync ou archive foi acionado. `62-06` foi autorizado separadamente e para no seu
> Review Stop.

## Aceite final do revisor (2026-11-23)

- **Veredito:** `62-05` **aprovado tecnicamente, local/offline**.
- **Reexecução final do revisor:** **9 arquivos / 159 testes PASS**, OpenSpec
  strict válido e `git diff --check` limpo. A contagem **9/158** permanece como
  evidência histórica da reexecução anterior.
- **Gates do executor (separados):** foco **7 arquivos / 146 testes**, boundaries
  **2 arquivos / 13 testes**, afetados **23 arquivos / 414 testes**, typecheck/lint
  **0**, build **0 (102/102)**, global **860 arquivos + 2 skipped / 10.738 testes
  + 10 skipped**, OpenSpec **1/0** e diff-check limpo.
- **Histórico preservado:** C6–C11, o aceite do 62-04 e as limitações de prova
  offline permanecem documentados, sem reescrever os vereditos anteriores.

## Performance

- **Tasks:** 3/3 executadas
- **Files modified:** 15 (7 criados, 8 alterados)

## Commits

| Commit | Conteúdo |
|---|---|
| `fd4b060f` | plano reconciliado: R7, contratos atuais, injeções reais e guard estreito |
| `1c20029b` | rota/token/modal/detalhe + testes e reconciliação de guards |
| `96bcec61` | plano: correções C6–C9 (retomada, polling, download, fonte) |
| `c6c69bf9` | retomada idempotente, polling contínuo, download seguro e incerteza da fonte |
| `eb1f7f3a` | plano: correção C10 (sessões da modal) |
| `e61926a5` | isolamento de sessão e descarte de respostas obsoletas |
| `2dca1d31` | plano: correção C11 (submitting por identidade do POST) |
| `f9e2f866` | liberação do submitting independente da sequência de respostas |

## Correções C6–C9 (revisão final)

- **C6 — retomada:** POST retoma `processing`/`unknown` via continuação com reserva/economia duráveis, sem nova cobrança; GET emite token de retomada pelo `requestId` original mesmo com flag desligada; replay R1 vem antes de R2 e não devolve R2; flag desligada bloqueia só novas aberturas.
- **C7 — polling:** o modal reagenda a consulta após cada resposta `processing`/`unknown`, sem sobreposição, parando em terminal/fechar/desmontar; oferece ação de retomada quando há token.
- **C8 — download:** preview vertical OK + falha da assinatura de download ⇒ `downloadDisabled=true` e nenhuma URL do quadrado, nos caminhos novo e legado.
- **C9 — fonte:** ranking preserva `indeterminate`/leitura incerta sobre rejeição de path da outra origem.
- **C10 — sessão:** cada abertura é uma sessão; fechar/desmontar/trocar campanha invalida GET/POST, callbacks, timers e `finally`. Respostas antigas são ignoradas, terminal não regride e entrega é concluída uma única vez. Nada é cancelado/estornado no servidor.
- **C11 — submitting:** a identidade do POST em andamento é separada da sequência de aplicação; o POST atual libera seu próprio botão mesmo após um GET posterior, e um POST antigo nunca libera o de outro POST/sessão.

## Contrato implementado

- **GET `/api/campaign/[id]/format-additions`:** ownership/UUID, leitura do vínculo, fonte
  reutilizável (`new_flow_1_1` / legado 1024 opt-in), elegibilidade, custo 1,
  origem, incompatibilidade e estado. Emite `requestId` + `confirmationToken`
  somente quando há ação. Sem ponte, reserva, preparação, geração ou saldo.
- **POST:** CSRF/ownership, Zod estrito (`format` + `confirmationToken`), token
  verificado (HMAC/TTL/segredo), `intent`/`requestId`/checksum extraídos do token,
  replay terminal sem nova operação, retry só após `refunded`, revalidação da
  fonte e comparação de checksum. Injeta `authorizeProductFlow` real e
  `pilotSpendResolver` real no composition root.
- **Flag:** desligada bloqueia novas adições/retries; `delivered`/`processing`/
  `unknown` continuam visíveis/reconciliáveis.
- **Detalhe:** lê a adição sem path/URL; `?format=9:16` só seleciona com
  preview/arte comprovados; `?format=1:1`/ausência mantêm o quadrado; refunded/
  processing/unknown/read failure falham fechado e não prometem vertical.
- **Chip/modal:** ação opcional default-preserving; modal com confirmação,
  acompanhamento, unknown/refunded/incompatível, ESC, foco e polling read-only.
  Fechar não cancela/estorna. Lista/dashboard permanecem sem ação.
- **Token:** `confirmation-token.ts` HMAC-SHA256, TTL 10 min, segredo
  `FORMAT_ADDITION_CONFIRMATION_SECRET`; ausência ⇒ 503/fail-closed.

## Gates

| Gate | Resultado |
|---|---|
| Foco 62-05 (rota/token/página/legado/modal/chip/guard) | **7 arquivos / 146 testes PASS** |
| Boundaries reconciliados (square-base + joint) | **2 arquivos / 13 testes PASS** |
| Diretórios afetados (rota, format-addition, detalhe, campanha, guards) | **23 arquivos / 414 testes PASS** |
| `typecheck` | exit **0** |
| `lint` | exit **0** |
| `build` | exit **0** — 102/102 páginas |
| Suíte global | **exit 0** — 860 arquivos + 2 skipped (862); **10.738 testes PASS** + 10 skipped |
| OpenSpec strict | **1 passed, 0 failed** |
| `git diff --check` | limpo |

## Limitações e desvios

- **Guard estendido de forma estreita:** a nova rota foi adicionada ao mapa de
  importadores do Produto 1:1 apenas com três pares exatos (eligibility,
  authorization, pilot gate). Nenhum prefixo genérico foi liberado.
- **Secret de confirmação:** a ativação exige
  `FORMAT_ADDITION_CONFIRMATION_SECRET`; nenhum ambiente foi alterado e, sem o
  segredo, GET/POST falham fechado.
- **Testes offline:** banco/Storage/provider/rotas externas são fakes; não há
  prova de RLS, locks, concorrência PostgREST, Storage real ou provider real.
- **Download vertical:** usa URL assinada com opção de download; a rota dedicada
  de download permanece para o `62-06`.
- **`62-06` não iniciado.** O detalhe não recebe ação em lista/dashboard.
- **Retomada:** o GET emite token de retomada para operações abertas; o POST usa a continuação durável. O modal pode ser reaberto/fechado sem cancelar ou estornar.
- **Polling:** consultas consecutivas `processing` são reagendadas; sem prova de longa duração em produção.
- **Download:** sem URL de download válida para o vertical, o botão fica indisponível; não herda a URL do quadrado.
- **Sessão:** respostas de GET/POST de uma sessão fechada/desmontada são ignoradas; a modal não cancela/estorna no servidor.
- **Submitting:** o POST libera seu próprio botão mesmo se um GET posterior já atualizou o estado; não fica preso.

## Next

`62-06` autorizado explicitamente após o aceite final. Não iniciar `62-07` sem novo Review Stop.

---

*Phase: 62-adicionar-vertical-campanha-quadrada*
*Completed: 62-05 aceito local/offline, 2026-11-23*
