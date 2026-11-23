# 62-08 — Orientação do chip vertical da Jarra Finesse

**Status:** **CORRIGIDO E VALIDADO; PÁGINA 200; CHIP COM ORIENTAÇÃO; CONFIRMAÇÃO DE 1 CRÉDITO DISPONÍVEL; SEM GERAÇÃO/COBRANÇA; `62-08` NÃO CONCLUÍDO.**
**Data:** 2026-11-23.
**Campanha:** `c06b16f5-f126-429c-b5b0-9567fe4adb95` — Jarra Finesse 1l.
**Store:** `3dc7d274-0b57-45ba-883a-7b235056feda` — Loja Mega Vale.
**Owner:** `bcceac95-501a-4ed3-87a5-314c8e76f546`.

## Reprodução antes da correção

GET autenticado `GET /api/campaign/c06b16f5…/format-additions`:

| Campo | Valor |
|---|---|
| HTTP | **200** |
| `state` | **eligible** |
| `reason` | **null** |
| `sourceOrigin` | **new_flow_1_1** |
| `costCredits` | **1** |
| `confirmationToken` | presente (não registrado) |

Não havia bloqueio de backend. A campanha tem `status=ready`, operação primária
`delivered` e artefato `product_1_1_campaign_artifacts` 1024×1024 JPEG; nenhuma
adição existente. A fonte foi baixada/validada pelo fluxo normal do GET
(`new_flow_1_1`); o transporte `node:http` injetado no preview da página **não**
era a causa e não foi usado para contornar validação.

A página respondia 200, mas o chip 9:16 acionável continuava com o estado/ajuda
`absent/not_requested`: **“Vertical 9:16: Não incluído”** e explicação
“Não incluído. Este formato não foi incluído na criação da campanha.” O clique
já abria a ação (`onFormatAction`), mas a orientação dizia o contrário.

## Causa concreta

`CampaignFormatChips` derivava o nome acessível e a ajuda apenas de
`CampaignFormatPresentationEntry`. Para campanha 1:1 sem adição, o 9:16 é
`absent/not_requested`; mesmo com `onFormatAction` disponível, o componente
mantinha o texto informativo de “não incluído”.

## Correção

- Novos textos no namespace `campaign-detail` (pt-BR/es-419):
  - `formatAddition.availableForGeneration`: “Disponível para gerar” /
    “Disponible para generar”;
  - `formatAddition.generateGuidance`: “Clique para gerar o formato vertical.
    Custo: 1 crédito.” / “Haz clic para generar el formato vertical. Costo:
    1 crédito.”
- `CampaignFormatChips` ganhou `actionHelpText` e `actionStateLabel` opcionais.
  Eles são usados **somente** quando:
  - é o chip 9:16;
  - `onFormatAction` está presente;
  - o estado é `absent` com `reason=not_requested`.
- Nesse caso:
  - `aria-label` = “Vertical 9:16: Disponível para gerar”;
  - descrição hidden/popover = “Clique para gerar o formato vertical. Custo:
    1 crédito.”;
  - o clique continua chamando `onFormatAction` (abre o modal).
- A página de detalhe passa os textos; **lista/dashboard não passam** e mantêm
  os chips informativos (“Não incluído”);
- Estados de incompatibilidade, indisponibilidade e estorno continuam usando as
  explicações específicas existentes; o override só vale para
  `absent/not_requested` com ação.

## Validação na Jarra

| Requisição | Resultado |
|---|---|
| `GET /campanhas/c06b16f5…` | **200** |
| `GET /campanhas/c06b16f5…?format=1:1` | **200** |
| `GET /campanhas/c06b16f5…?format=9:16` | **200** |
| `GET /api/campaign/c06b16f5…/format-additions` | **200**, `eligible`, `reason=null`, `costCredits=1` |

Conteúdo da página:

- ação “Adicionar vertical 9:16” presente;
- `aria-label` do chip: **“Vertical 9:16: Disponível para gerar”**;
- ajuda: **“Clique para gerar o formato vertical. Custo: 1 crédito.”**;
- o antigo label “Vertical 9:16: Não incluído” **não** aparece no chip;
- rótulos “Vertical 9:16” e “Quadrado 1:1” preservados.

Estado do banco após a validação:

| Métrica | Valor |
|---|---|
| Adições da Jarra | **0** |
| Operações de crédito | **1** (primária `delivered`) |
| Saldo da loja | **8** |

Nenhum POST de confirmação, geração ou cobrança foi executado.

## Testes

- `campaign-format-chips.test.tsx`: novo teste do chip acionável (label,
  descrição e `onFormatAction`) e teste de preservação do chip informativo sem
  ação; testes existentes de lista/dashboard permanecem.
- `campaign-detail-format.test.tsx`: novo teste do clique no chip vertical
  abrindo o modal e exibindo “Custo: 1 crédito” (fetch mockado).
- `catalogs.test.ts`: chaves novas adicionadas em pt-BR/es-419.
- Rodada afetada: **3 arquivos / 58 testes PASS**; diálogo/lista/dashboard:
  **4 arquivos / 66 testes PASS**.
- `npm.cmd run typecheck`: **0**.
- `git diff --check`: limpo.

## Limitações

- O clique não foi automatizado em navegador real (sem Playwright/Puppeteer); o
  teste jsdom cobre o clique no chip, o modal e o custo, e o GET real da Jarra
  devolve `eligible`/1 crédito. O responsável pode clicar manualmente.
- O app segue em modo dev (`npm run dev`); não é build de produção.
- Nenhuma flag, migration, segredo, banco, provider, IA ou geração foi alterado.

## Estado final

- `http://localhost:3000` permanece em execução.
- Jarra Finesse com página 200 e chip orientando a geração de 1 crédito.
- Confirmação **disponível**, não enviada automaticamente; geração não
  executada.
- `62-08` segue **não concluído**.

## Ressalva sobre a captura anterior

A correção da ajuda do chip **não explica, por si só,** a mensagem de
indisponibilidade observada na captura anterior. O GET atual responde `eligible`
e permite nova tentativa, mas o estado daquele momento não foi preservado nesta
evidência: não há registro do status/`state`/`reason` daquela execução.

Portanto, não se atribui a falha anterior apenas ao texto do chip, nem se afirma
outra causa específica sem evidência. A correção documentada aqui cobre o
rótulo/orientação atuais; a causa da indisponibilidade anterior permanece **não
comprovada**.
