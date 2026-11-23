# 62-08 — Preparação local: lojas normais × lojas de teste

**Status:** **HOMOLOGAÇÃO PREPARADA; LOJA DE TESTE TOTALMENTE ELEGÍVEL; LOJA NORMAL COM AUTORIZAÇÃO LIBERADA, MAS SEM FONTE ELEGÍVEL; `62-08` NÃO CONCLUÍDO.**
**Data:** 2026-11-23.
**Ambiente:** Next local (`http://localhost:3000`) + Supabase de homologação.
**Instância canônica:** `127.0.0.1:57781` (ambiente `isolated`).
**Escopo:** somente homologação; produção não foi acessada nem alterada.

## Controles existentes usados

Nenhuma exceção por campanha, nenhuma conversão de loja normal em loja de teste
e nenhum gate contornado. Foram usadas apenas as superfícies administrativas
existentes:

| Controle | Requisição | Resultado |
|---|---|---|
| Flag geral | `PUT /api/admin/feature-flags` — `product_1_1_all_stores_enabled=true` | **200** |
| Stage geral | `POST /api/admin/product-flow-authorizations` — `stage=all_stores`, `scope=all_stores` | **200**, `granted=true` |

- Flag `operationId`: `9275a3ff-60cf-439c-bd80-d6d9a2df3910`.
- Stage `operationId`: `8e1c84d7-b3e4-4d1f-8439-c549c7069b7c`.
- Evento append-only: `seq=17 | granted | all_stores | all_stores |
  127.0.0.1:57781`.
- Motivo registrado: preparação F62-08 na homologação, sem geração nem IA.

A loja de teste já estava autorizada pelo stage `test_stores` (evento `seq=15`) e
pela flag `product_1_1_test_stores_enabled=true`; nada precisou ser alterado
para ela.

## Autorização server-side (antes → depois)

Avaliação feita com `resolveProductFlowAuthorization(resolveEligibilityContext(
store))`, a mesma função usada pelo gate do POST, em modo somente leitura.

| Loja | Escopo | Antes | Depois |
|---|---|---|---|
| Normal (`p916test-s13-deliver-11`) | `all_stores` | negada — `stage_not_enabling` | **permitida — `all_stores`** |
| Teste (Loja Mega Vale) | `test_stores` | permitida — `test_stores` | **permitida — `test_stores`** |

Após ligar a flag geral, a loja de teste passou a registrar
`usedGeneralPrecedence=true`; o stage `test_stores` continua válido.

## Elegibilidade da fonte

| Loja | Campanha | Status da campanha | Fonte | Resultado |
|---|---|---|---|---|
| Normal | `d4917c9b-93cf-493f-b6ff-2e5876afdac7` | `generating` | `new_flow_1_1` | `not_reusable` — `campaign_not_ready` |
| Normal | idem | `generating` | `legacy_campaign` | `not_reusable` — `campaign_not_ready` |
| Teste | `c06b16f5-f126-429c-b5b0-9567fe4adb95` (Jarra) | `ready` | `new_flow_1_1` | **reutilizável — 1024×1024 JPEG** |
| Teste | idem | `ready` | `legacy_campaign` | `not_reusable` — `path_not_canonical` |

Derivação final da adição (mesma função do GET):

- Normal: `incompatible` / `campaign_not_ready`.
- Teste: `eligible` / `new_flow_1_1` / `1` crédito.

### GET autenticado real (lojas de teste)

| Campanha | HTTP | `state` | `reason` | `sourceOrigin` | `costCredits` |
|---|---|---|---|---|---|
| Jarra `c06b16f5…` | **200** | **eligible** | `null` | `new_flow_1_1` | **1** |
| Padaria `14278411…` | **200** | **eligible** | `null` | `new_flow_1_1` | **1** |

O GET da campanha normal não pôde ser feito por sessão autenticada: os usuários
sintéticos das lojas normais têm `auth.users.instance_id` nulo e a Auth admin
responde `User not found`. Por isso, a autorização e a fonte foram conferidas
pelas mesmas funções server-side, sem token/cookie e sem POST.

## Bloqueio concreto da loja normal

O ambiente de homologação **não possui nenhuma campanha `ready` em loja
normal**:

| Universo de lojas normais | Quantidade |
|---|---|
| Lojas normais | 20 |
| Com campanha | 18 |
| Campanhas `generating` | 18 |
| Campanhas `ready` | **0** |
| Sem campanha | 2 (`Wagner Bebidas`, `Lar & Amor`) |

As 18 campanhas existentes estão todas em `generating`, inclusive a escolhida
para a checagem, cuja operação de crédito primária está `delivered`, mas sem
artefato 1:1 registrado. A fonte é recusada por `campaign_not_ready` — gate
legítimo, não contornado.

Consequência: a **autorização** de lojas normais está liberada, mas **não há
fonte 1:1 elegível** para concluir o fluxo de adição vertical em loja normal sem
criar/gerar uma campanha nova, o que está fora do escopo autorizado (sem IA,
sem geração e sem exceção por campanha).

## Garantias de não execução

| Verificação | Resultado |
|---|---|
| Adições nas três campanhas | **0** |
| Status da campanha normal | `generating` (inalterado) |
| Status da campanha da Jarra | `ready` (inalterado) |
| Operação primária (normal/teste) | `delivered` / `delivered` (inalteradas) |
| Saldo da Loja Mega Vale | **8** (inalterado) |
| POST de confirmação | **não executado** |
| IA / provider / geração / cobrança | **não executados** |

## Conclusão operacional

- **Lojas de teste:** liberadas e com fonte elegível — GET `eligible`, 1 crédito,
  confirmação disponível (não enviada).
- **Lojas normais:** autorização server-side liberada pelos controles
  existentes, porém **sem fonte elegível** na homologação; portanto **não estão
  plenamente liberadas para gerar**.
- App local segue em execução em `http://localhost:3000`.
- `62-08` permanece **não concluído**.
